/**
 * Utilidades para formateo, autocompletado y cálculo de dígitos verificadores
 * estilo "Barcode Guru" para códigos de barras de supermercados (Walmart, Sam's, Aurrera, Soriana).
 */

/**
 * Calcula el dígito verificador oficial de un código EAN-13 a partir de sus primeros 12 dígitos.
 */
export function calculateEan13CheckDigit(base12: string): number {
  const digits = base12.replace(/\D/g, '');
  if (digits.length < 12) return -1;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    // Posiciones impares x1 (índices pares 0,2,4...), posiciones pares x3 (índices impares 1,3,5...)
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Calcula el dígito verificador oficial de un código UPC-A a partir de sus primeros 11 dígitos.
 */
export function calculateUpcCheckDigit(base11: string): number {
  const digits = base11.replace(/\D/g, '');
  if (digits.length < 11) return -1;

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(digits[i], 10);
    // En UPC: posiciones impares x3, pares x1
    sum += i % 2 === 0 ? digit * 3 : digit * 1;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

export interface BarcodeVariation {
  code: string;
  format: 'EAN13' | 'UPC' | 'CODE128';
  label: string;
  tag: string;
  description: string;
}

export interface BarcodeAnalysis {
  original: string;
  isModified: boolean;
  optimizedCode: string;
  optimizedFormat: 'EAN13' | 'UPC' | 'CODE128';
  reason?: string;
  variations: BarcodeVariation[];
}

/**
 * Analiza un código (especialmente de etiquetas de estante, cenefas o liquidación de empleados)
 * y genera las variantes autocompletadas para que el checador de la tienda lo lea correctamente.
 */
export function analyzeAndFormatBarcode(rawCode: string): BarcodeAnalysis {
  const clean = rawCode.trim();
  const digitsOnly = clean.replace(/\D/g, '');
  const variations: BarcodeVariation[] = [];

  // Siempre incluimos el original
  variations.push({
    code: clean,
    format: 'CODE128',
    label: 'Original de Etiqueta',
    tag: 'Tal como viene',
    description: 'Código exacto impreso en la etiqueta de precio del empleado.'
  });

  // CASO 1: Tiene 13 dígitos
  if (digitsOnly.length === 13) {
    const base12 = digitsOnly.slice(0, 12);
    const expectedCheck = calculateEan13CheckDigit(base12);
    const currentCheck = parseInt(digitsOnly[12], 10);

    if (expectedCheck === currentCheck) {
      // EAN-13 100% Válido
      variations.unshift({
        code: digitsOnly,
        format: 'EAN13',
        label: 'EAN-13 Válido',
        tag: 'Estándar',
        description: 'Código EAN-13 completo y verificado para checadores de autoservicio.'
      });
      return {
        original: clean,
        isModified: false,
        optimizedCode: digitsOnly,
        optimizedFormat: 'EAN13',
        variations
      };
    } else {
      // El dígito verificador de la etiqueta no coincide (común en errores de impresión de cenefas)
      const corrected = `${base12}${expectedCheck}`;
      variations.unshift({
        code: corrected,
        format: 'EAN13',
        label: 'EAN-13 Corregido',
        tag: 'Recomendado',
        description: `Se recalculó el dígito verificador final a '${expectedCheck}' para que el checador lo reconozca.`
      });
      return {
        original: clean,
        isModified: true,
        optimizedCode: corrected,
        optimizedFormat: 'EAN13',
        reason: `La etiqueta tiene dígito verificador '${currentCheck}', pero el estándar matemático requiere '${expectedCheck}'.`,
        variations
      };
    }
  }

  // CASO 2: Tiene 12 dígitos (Típica etiqueta de estante donde omitieron el check digit de EAN-13 o es UPC-A)
  if (digitsOnly.length === 12) {
    // 2.A: Asumir que son los 12 dígitos de EAN-13 y falta el 13vo dígito verificador
    const check13 = calculateEan13CheckDigit(digitsOnly);
    const completedEan13 = `${digitsOnly}${check13}`;

    // 2.B: Asumir que es UPC-A (12 dígitos) y convertirlo a EAN-13 anteponiendo un 0
    const eanWithZero = `0${digitsOnly}`;

    variations.unshift({
      code: completedEan13,
      format: 'EAN13',
      label: 'EAN-13 Acompletado',
      tag: 'Cenefa Walmart',
      description: `Se calculó el 13º dígito verificador '${check13}' que los empleados omiten en la etiqueta.`
    });

    variations.push({
      code: digitsOnly,
      format: 'UPC',
      label: 'UPC-A Estándar (12d)',
      tag: 'Sam\'s / USA',
      description: 'Formato estándar de 12 dígitos para mercancía de Sam\'s Club o importación.'
    });

    variations.push({
      code: eanWithZero,
      format: 'EAN13',
      label: 'EAN-13 con Prefijo 0',
      tag: 'Checador Walmart',
      description: 'UPC adaptado con cero inicial para bases de datos de autoservicios en México.'
    });

    return {
      original: clean,
      isModified: true,
      optimizedCode: completedEan13,
      optimizedFormat: 'EAN13',
      reason: 'Las etiquetas de precio en tienda frecuentemente omiten el último dígito verificador. Se calculó para formar el EAN-13 completo.',
      variations
    };
  }

  // CASO 3: Tiene 11 dígitos (UPC al que le falta el dígito verificador)
  if (digitsOnly.length === 11) {
    const upcCheck = calculateUpcCheckDigit(digitsOnly);
    const fullUpc = `${digitsOnly}${upcCheck}`;
    const fullEan = `0${fullUpc}`;

    variations.unshift({
      code: fullEan,
      format: 'EAN13',
      label: 'EAN-13 para Checador',
      tag: 'Recomendado',
      description: `Código completado con dígito '${upcCheck}' y prefijo '0' para el checador de Walmart.`
    });

    variations.push({
      code: fullUpc,
      format: 'UPC',
      label: 'UPC-A Acompletado (12d)',
      tag: 'Sam\'s Club',
      description: `Se autocompletó con el dígito verificador '${upcCheck}'.`
    });

    return {
      original: clean,
      isModified: true,
      optimizedCode: fullEan,
      optimizedFormat: 'EAN13',
      reason: 'Etiqueta incompleta de 11 dígitos. Se calculó el verificador y se formateó para lectura en checadores.',
      variations
    };
  }

  // CASO 4: Códigos cortos de 6 a 10 dígitos (SKUs internos de tienda / Item Number)
  if (digitsOnly.length >= 6 && digitsOnly.length <= 10) {
    // Relleno a 12 y 13 dígitos
    const padded12 = digitsOnly.padStart(12, '0');
    const checkPadded = calculateEan13CheckDigit(padded12);
    const paddedEan13 = `${padded12}${checkPadded}`;

    variations.unshift({
      code: clean,
      format: 'CODE128',
      label: 'Code 128 Liquidación',
      tag: 'Etiqueta Amarilla',
      description: 'Formato directo de alta densidad para códigos cortos o internos de liquidación.'
    });

    variations.push({
      code: paddedEan13,
      format: 'EAN13',
      label: 'EAN-13 Rellenado con Ceros',
      tag: 'SKU Convertido',
      description: 'Código rellenado con ceros a la izquierda y verificador para checadores.'
    });

    return {
      original: clean,
      isModified: false,
      optimizedCode: clean,
      optimizedFormat: 'CODE128',
      reason: 'Código corto o SKU interno. Code 128 es el formato idóneo para estas etiquetas.',
      variations
    };
  }

  // Fallback general para cualquier otra cadena
  return {
    original: clean,
    isModified: false,
    optimizedCode: clean,
    optimizedFormat: 'CODE128',
    variations
  };
}
