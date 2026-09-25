import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions
} from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
import {
  analyzeAndFormatBarcode,
  BarcodeVariation
} from '../utils/barcodeFormatter';

const JsBarcode = require('jsbarcode');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type BarcodeFormat = 'EAN13' | 'CODE128' | 'UPC' | 'CODE39';

interface BarcodeModalProps {
  visible: boolean;
  onClose: () => void;
  barcode: string;
  productName?: string;
  showSaveActions?: boolean;
  onConfirmAndRegister?: (verifiedCode: string) => void;
  onViewHistory?: (verifiedCode: string) => void;
}

interface FormatOption {
  key: BarcodeFormat;
  label: string;
  stores: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    key: 'EAN13',
    label: 'EAN-13',
    stores: 'Walmart, Bodega Aurrera, Soriana, Chedraui',
    description: 'Estándar oficial de 13 dígitos para tiendas de autoservicio en México.'
  },
  {
    key: 'CODE128',
    label: 'Code 128',
    stores: 'Etiquetas de Liquidación Walmart / SAM\'s',
    description: 'Formato de alta densidad utilizado en etiquetas de remate (.03, .02, .01) e inventario.'
  },
  {
    key: 'UPC',
    label: 'UPC-A',
    stores: 'SAM\'s Club, Costco, Importaciones USA',
    description: 'Estándar habitual en mercancía americana y clubes de precio mayoristas.'
  },
  {
    key: 'CODE39',
    label: 'Code 39',
    stores: 'Almacén y Logística',
    description: 'Código alfanumérico clásico para identificación de tarimas y lotes.'
  }
];

export const BarcodeModal: React.FC<BarcodeModalProps> = ({
  visible,
  onClose,
  barcode,
  productName,
  showSaveActions = false,
  onConfirmAndRegister,
  onViewHistory
}) => {
  // Estado del código activo a renderizar (por defecto el optimizado/acompletado para checador)
  const [activeCode, setActiveCode] = useState<string>(() => {
    return analyzeAndFormatBarcode(barcode).optimizedCode;
  });
  const [selectedFormat, setSelectedFormat] = useState<BarcodeFormat>(() => {
    return analyzeAndFormatBarcode(barcode).optimizedFormat;
  });

  // Sincronizar cuando cambia el barcode o se abre el modal
  useEffect(() => {
    if (visible && barcode) {
      const initAnalysis = analyzeAndFormatBarcode(barcode);
      setActiveCode(initAnalysis.optimizedCode);
      setSelectedFormat(initAnalysis.optimizedFormat);
    }
  }, [barcode, visible]);

  // Analizar dinámicamente si el código activo requiere autocompletado o corrección de cenefa
  const analysis = useMemo(() => analyzeAndFormatBarcode(activeCode), [activeCode]);

  // Codificar código a patrón binario ('1010011...') con fallback seguro
  const encodedData = useMemo(() => {
    const cleanCode = activeCode.trim();
    let formatToUse = selectedFormat;
    let encoderModule;

    try {
      encoderModule = JsBarcode.getModule(formatToUse);
      const instance = new encoderModule(cleanCode, {});
      if (instance.valid && !instance.valid()) {
        throw new Error('Código no válido para este formato');
      }
      const result = instance.encode();
      const binaryString = Array.isArray(result)
        ? result.map((r: any) => r.data).join('')
        : result.data;
      return { success: true, binary: binaryString, usedFormat: formatToUse };
    } catch (e: any) {
      // Fallback automático a CODE128 que soporta cualquier longitud o caracteres
      try {
        const FallbackModule = JsBarcode.getModule('CODE128');
        const fallbackInstance = new FallbackModule(cleanCode, {});
        const res = fallbackInstance.encode();
        return {
          success: true,
          binary: res.data,
          usedFormat: 'CODE128',
          fallbackNotice: `El valor no cumple con las reglas estrictas de ${formatToUse}. Se renderizó en Code 128 para garantizar su lectura.`
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  }, [activeCode, selectedFormat]);

  const currentOption = FORMAT_OPTIONS.find(f => f.key === selectedFormat) || FORMAT_OPTIONS[0];

  // Dimensiones del SVG
  const svgWidth = Math.min(SCREEN_WIDTH - 64, 320);
  const barcodeHeight = 90;
  const totalSvgHeight = 110;

  // Calcular barras a partir del string binario
  const bars = useMemo(() => {
    if (!encodedData.success || !encodedData.binary) return [];
    const binary = encodedData.binary;
    const unitWidth = svgWidth / binary.length;
    const calculatedBars: { x: number; width: number }[] = [];

    let start: number | null = null;
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        if (start === null) start = i;
      } else {
        if (start !== null) {
          calculatedBars.push({
            x: start * unitWidth,
            width: (i - start) * unitWidth
          });
          start = null;
        }
      }
    }
    if (start !== null) {
      calculatedBars.push({
        x: start * unitWidth,
        width: (binary.length - start) * unitWidth
      });
    }

    return calculatedBars;
  }, [encodedData, svgWidth]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Código de Barras Físico</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {productName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Ajuste o Corrección Rápida de Dígitos para el Checador */}
            <View style={styles.quickEditSection}>
              <View style={styles.quickEditHeader}>
                <Text style={styles.quickEditTitle}>✏️ Modificar o Corregir Dígitos:</Text>
                <Text style={styles.quickEditBadge}>{activeCode.length} dígitos</Text>
              </View>
              <View style={styles.quickEditInputContainer}>
                <TextInput
                  style={styles.quickEditInput}
                  value={activeCode}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/[^0-9A-Za-z]/g, '');
                    setActiveCode(cleaned);
                  }}
                  keyboardType="numeric"
                  placeholder="Código..."
                  placeholderTextColor="#64748b"
                  maxLength={25}
                  selectTextOnFocus
                />
                {activeCode.length > 0 && (
                  <TouchableOpacity
                    style={styles.quickEditClearBtn}
                    onPress={() => setActiveCode('')}
                  >
                    <Text style={styles.quickEditClearText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.quickEditHelper}>
                El código de barras se actualiza y recalcula automáticamente abajo.
              </Text>
            </View>

            {/* Tarjeta de Código de Barras en Alto Contraste (Fondo Blanco para escáneres láser) */}
            <View style={styles.barcodeCard}>
              {encodedData.success ? (
                <View style={styles.barcodeWrapper}>
                  <Svg width={svgWidth} height={totalSvgHeight}>
                    <G>
                      {bars.map((bar, index) => (
                        <Rect
                          key={index}
                          x={bar.x}
                          y={8}
                          width={bar.width}
                          height={barcodeHeight}
                          fill="#000000"
                        />
                      ))}
                    </G>
                  </Svg>
                  {/* Número legible por humanos */}
                  <Text style={styles.humanReadableText}>{activeCode}</Text>
                  <View style={styles.badgeRow}>
                    <Text style={styles.formatBadgeText}>
                      Formato: {encodedData.usedFormat}
                    </Text>
                    {activeCode !== barcode && (
                      <View style={styles.completedTag}>
                        <Text style={styles.completedTagText}>✨ Acompletado</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>No se pudo generar el código con estos dígitos.</Text>
                </View>
              )}
            </View>

            {/* Banner Estilo Barcode Guru: Detección y Autocompletado de Etiqueta de Tienda */}
            {analysis.isModified && (
              <View style={styles.autoCompleteCard}>
                <View style={styles.autoCompleteHeader}>
                  <Text style={styles.autoCompleteIcon}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoCompleteTitle}>
                      Etiqueta de Tienda Detectada (Modo Barcode Guru)
                    </Text>
                    <Text style={styles.autoCompleteDesc}>
                      {analysis.reason}
                    </Text>
                  </View>
                </View>

                <Text style={styles.variationsTitle}>
                  Selecciona la variante para tu checador:
                </Text>

                <View style={styles.variationsGrid}>
                  {analysis.variations.map((v: BarcodeVariation, idx: number) => {
                    const isSelected = activeCode === v.code;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.variationCard,
                          isSelected && styles.variationCardActive
                        ]}
                        onPress={() => {
                          setActiveCode(v.code);
                          setSelectedFormat(v.format);
                        }}
                      >
                        <View style={styles.variationHeader}>
                          <Text style={[styles.variationTag, isSelected && styles.variationTagActive]}>
                            {v.tag}
                          </Text>
                          <Text style={[styles.variationFmt, isSelected && styles.variationFmtActive]}>
                            {v.format}
                          </Text>
                        </View>
                        <Text style={[styles.variationCode, isSelected && styles.variationCodeActive]}>
                          {v.code}
                        </Text>
                        <Text style={styles.variationDesc} numberOfLines={2}>
                          {v.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Aviso de brillo para verificadores */}
            <View style={styles.tipBox}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText}>
                Sube el brillo de tu pantalla al 100% para que los verificadores de Walmart y Sam's lean el código sin reflejos.
              </Text>
            </View>

            {/* Selector Manual de Formatos */}
            <Text style={styles.sectionHeading}>Cambiar Formato de Código:</Text>
            <View style={styles.formatChipsContainer}>
              {FORMAT_OPTIONS.map(fmt => (
                <TouchableOpacity
                  key={fmt.key}
                  style={[
                    styles.formatChip,
                    selectedFormat === fmt.key && styles.formatChipActive
                  ]}
                  onPress={() => setSelectedFormat(fmt.key)}
                >
                  <Text
                    style={[
                      styles.formatChipText,
                      selectedFormat === fmt.key && styles.formatChipTextActive
                    ]}
                  >
                    {fmt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Descripción del Formato Seleccionado */}
            <View style={styles.formatDetailCard}>
              <Text style={styles.formatDetailStore}>
                🏬 Usado en: <Text style={styles.storeHighlight}>{currentOption.stores}</Text>
              </Text>
              <Text style={styles.formatDetailDesc}>{currentOption.description}</Text>
              {encodedData.fallbackNotice && (
                <Text style={styles.fallbackNoticeText}>
                  ℹ️ {encodedData.fallbackNotice}
                </Text>
              )}
            </View>

            {/* Bloque de Decisión y Guardado para el Cazador de Ofertas */}
            {showSaveActions && (
              <View style={styles.hunterDecisionCard}>
                <Text style={styles.hunterDecisionTitle}>
                  ¿Qué precio mostró el checador de la tienda?
                </Text>
                <Text style={styles.hunterDecisionSub}>
                  Pasa el código anterior por la terminal de la tienda. Si lo leyó y viste la liquidación, regístrala en la app:
                </Text>

                <TouchableOpacity
                  style={styles.confirmRegisterBtn}
                  onPress={() => onConfirmAndRegister && onConfirmAndRegister(activeCode)}
                >
                  <Text style={styles.confirmRegisterBtnText}>
                    ✅ Sí lo leyó el verificador → Registrar Precio
                  </Text>
                  <Text style={styles.confirmRegisterBtnSubtext}>
                    Guardar reporte físico para la comunidad
                  </Text>
                </TouchableOpacity>

                {onViewHistory && (
                  <TouchableOpacity
                    style={styles.viewHistoryBtn}
                    onPress={() => onViewHistory(activeCode)}
                  >
                    <Text style={styles.viewHistoryBtnText}>
                      📈 Consultar Historial Previo de este Código
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Botón Listo / Descartar */}
            <TouchableOpacity
              style={[styles.doneBtn, showSaveActions && styles.discardBtn]}
              onPress={onClose}
            >
              <Text style={styles.doneBtnText}>
                {showSaveActions ? '✕ Descartar / Escanear otro código' : 'Cerrar'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#1e293b',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800'
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2
  },
  closeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeIconText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: 'bold'
  },
  barcodeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 14
  },
  barcodeWrapper: {
    alignItems: 'center',
    width: '100%'
  },
  humanReadableText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 6,
    fontFamily: 'monospace'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  formatBadgeText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  completedTag: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  completedTagText: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '800'
  },
  errorBox: {
    padding: 20,
    alignItems: 'center'
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center'
  },
  autoCompleteCard: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14
  },
  autoCompleteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  autoCompleteIcon: {
    fontSize: 20,
    marginRight: 8,
    marginTop: 1
  },
  autoCompleteTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800'
  },
  autoCompleteDesc: {
    color: '#cbd5e1',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3
  },
  variationsTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  variationsGrid: {
    gap: 8
  },
  variationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  variationCardActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)'
  },
  variationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  variationTag: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  variationTagActive: {
    color: '#38bdf8'
  },
  variationFmt: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700'
  },
  variationFmtActive: {
    color: '#cbd5e1'
  },
  variationCode: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: 'monospace'
  },
  variationCodeActive: {
    color: '#38bdf8'
  },
  variationDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 14
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: '#eab308',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  tipIcon: {
    fontSize: 18,
    marginRight: 8
  },
  tipText: {
    flex: 1,
    color: '#fef08a',
    fontSize: 11.5,
    lineHeight: 15
  },
  sectionHeading: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8
  },
  formatChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  formatChip: {
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  formatChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  formatChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  formatChipTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  formatDetailCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  formatDetailStore: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginBottom: 4
  },
  storeHighlight: {
    color: '#38bdf8',
    fontWeight: '700'
  },
  formatDetailDesc: {
    color: '#cbd5e1',
    fontSize: 11.5,
    lineHeight: 16
  },
  fallbackNoticeText: {
    color: '#f59e0b',
    fontSize: 10.5,
    marginTop: 6,
    fontStyle: 'italic'
  },
  doneBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center'
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  hunterDecisionCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1.5,
    borderColor: '#22c55e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14
  },
  hunterDecisionTitle: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center'
  },
  hunterDecisionSub: {
    color: '#cbd5e1',
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12
  },
  confirmRegisterBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8
  },
  confirmRegisterBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900'
  },
  confirmRegisterBtnSubtext: {
    color: '#bbf7d0',
    fontSize: 11,
    marginTop: 2
  },
  viewHistoryBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center'
  },
  viewHistoryBtnText: {
    color: '#38bdf8',
    fontSize: 12.5,
    fontWeight: '700'
  },
  discardBtn: {
    backgroundColor: '#334155'
  },
  quickEditSection: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  quickEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  quickEditTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700'
  },
  quickEditBadge: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700'
  },
  quickEditInputContainer: {
    position: 'relative'
  },
  quickEditInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    color: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 38,
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: '800',
    fontFamily: 'monospace',
    borderWidth: 1.5,
    borderColor: '#38bdf8'
  },
  quickEditClearBtn: {
    position: 'absolute',
    right: 8,
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  quickEditClearText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  quickEditHelper: {
    color: '#94a3b8',
    fontSize: 10.5,
    marginTop: 6
  }
});
