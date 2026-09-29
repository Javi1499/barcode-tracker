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

  // CASO 2: Tiene 12 dígitos (Estándar oficial UPC-A)
  // En supermercados como Walmart, Sam's Club, Aurrera y Soriana, gran cantidad de mercancía
  // (marcas globales, abarrotes, importaciones, etc.) utiliza códigos UPC-A de 12 dígitos.
  // NO se debe alterar ni agregar un 13º dígito por defecto, ya que corrompe el SKU del producto en tienda.
  if (digitsOnly.length === 12) {
    const base11 = digitsOnly.slice(0, 11);
    const expectedUpcCheck = calculateUpcCheckDigit(base11);
    const currentUpcCheck = parseInt(digitsOnly[11], 10);
    const isUpcValid = expectedUpcCheck === currentUpcCheck;

    // Variante 1 (POR DEFECTO): UPC-A Estándar con los 12 dígitos exactos
    variations.unshift({
      code: digitsOnly,
      format: 'UPC',
      label: 'UPC-A Estándar (12 dígitos)',
      tag: isUpcValid ? 'Estándar Oficial' : 'UPC-A (12d)',
      description: 'Estándar oficial de 12 dígitos para Walmart, Sam\'s Club y marcas globales.'
    });

    // Si el 12º dígito de la etiqueta tiene error de imprenta, ofrecer corrección UPC
    if (!isUpcValid && expectedUpcCheck !== -1) {
      const correctedUpc = `${base11}${expectedUpcCheck}`;
      variations.push({
        code: correctedUpc,
        format: 'UPC',
        label: 'UPC-A con Verificador Corregido',
        tag: 'Dígito Corregido',
        description: `Se recalculó el 12º dígito a '${expectedUpcCheck}' según la norma matemática de UPC-A.`
      });
    }

    // Variante 2: Convertir a EAN-13 anteponiendo un cero (algunos checadores leen UPC como EAN-13 con 0 inicial)
    const eanWithZero = `0${digitsOnly}`;
    variations.push({
      code: eanWithZero,
      format: 'EAN13',
      label: 'EAN-13 con Cero Inicial (13d)',
      tag: 'Variante EAN',
      description: 'Código de 12 dígitos adaptado con prefijo 0 para terminales que exigen 13 dígitos.'
    });

    // Variante 3: Por si fue una cenefa de estante recortada que omitió el 13vo dígito de un EAN-13
    const check13 = calculateEan13CheckDigit(digitsOnly);
    const completedEan13 = `${digitsOnly}${check13}`;
    variations.push({
      code: completedEan13,
      format: 'EAN13',
      label: 'EAN-13 Acompletado (13d)',
      tag: 'Cenefa Incompleta',
      description: `Variante alternativa asumiendo etiqueta de estante incompleta (+ '${check13}').`
    });

    return {
      original: clean,
      isModified: false,
      optimizedCode: digitsOnly,
      optimizedFormat: 'UPC',
      variations
    };
  }

  // CASO 3: Tiene 11 dígitos (UPC al que le falta el 12º dígito verificador)
  if (digitsOnly.length === 11) {
    const upcCheck = calculateUpcCheckDigit(digitsOnly);
    const fullUpc = `${digitsOnly}${upcCheck}`;
    const fullEan = `0${fullUpc}`;

    variations.unshift({
      code: fullUpc,
      format: 'UPC',
      label: 'UPC-A Acompletado (12 dígitos)',
      tag: 'Recomendado',
      description: `Se autocompletó con el 12º dígito verificador '${upcCheck}' para el estándar UPC-A.`
    });

    variations.push({
      code: fullEan,
      format: 'EAN13',
      label: 'EAN-13 con Prefijo 0 (13d)',
      tag: 'Variante EAN',
      description: `Código completado con dígito '${upcCheck}' y prefijo '0' para checadores de autoservicio.`
    });

    return {
      original: clean,
      isModified: true,
      optimizedCode: fullUpc,
      optimizedFormat: 'UPC',
      reason: `Código de 11 dígitos. Se calculó el 12º dígito verificador ('${upcCheck}') para completar el estándar UPC-A.`,
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
