import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
import {
  analyzeAndFormatBarcode,
  BarcodeVariation
} from '../utils/barcodeFormatter';
import { api } from '../services/api';

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
  readOnly?: boolean;
  brokenReportsCount?: number;
  workingVotesCount?: number;
  isReportedBroken?: boolean;
  currentUserId?: string;
  onFeedbackSubmitted?: (type: 'WORKING' | 'BROKEN', newCounts: { working: number; broken: number }) => void;
}

interface FormatOption {
  key: BarcodeFormat;
  label: string;
  stores: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    key: 'UPC',
    label: 'UPC-A (12 dígitos)',
    stores: 'Walmart, SAM\'s Club, Aurrera, Marcas Globales',
    description: 'Estándar oficial de 12 dígitos para marcas globales, abarrotes y productos importados.'
  },
  {
    key: 'EAN13',
    label: 'EAN-13 (13 dígitos)',
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
  onViewHistory,
  readOnly = false,
  brokenReportsCount,
  workingVotesCount,
  isReportedBroken = false,
  currentUserId,
  onFeedbackSubmitted
}) => {
  // Estado del código activo a renderizar (si es readOnly se respeta el código tal cual)
  const [activeCode, setActiveCode] = useState<string>(() => {
    if (readOnly) return barcode.trim();
    return analyzeAndFormatBarcode(barcode).optimizedCode;
  });
  const [selectedFormat, setSelectedFormat] = useState<BarcodeFormat>(() => {
    return analyzeAndFormatBarcode(barcode).optimizedFormat;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);

  // Estados de votación y reportes de la comunidad
  const [workingCount, setWorkingCount] = useState<number>(workingVotesCount ?? 0);
  const [brokenCount, setBrokenCount] = useState<number>(brokenReportsCount ?? 0);
  const [reportedBroken, setReportedBroken] = useState<boolean>(
    Boolean(isReportedBroken || (brokenReportsCount !== undefined && brokenReportsCount >= 5))
  );
  const [userVoted, setUserVoted] = useState<'WORKING' | 'BROKEN' | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>(
    'El verificador no reconoce el código'
  );

  // Sincronizar cuando cambia el barcode o se abre el modal
  useEffect(() => {
    if (visible && barcode) {
      if (readOnly) {
        setActiveCode(barcode.trim());
      } else {
        const initAnalysis = analyzeAndFormatBarcode(barcode);
        setActiveCode(initAnalysis.optimizedCode);
        setSelectedFormat(initAnalysis.optimizedFormat);
      }
      setWorkingCount(workingVotesCount ?? 0);
      setBrokenCount(brokenReportsCount ?? 0);
      setReportedBroken(
        Boolean(isReportedBroken || (brokenReportsCount !== undefined && brokenReportsCount >= 5))
      );
      setUserVoted(null);
    }
  }, [barcode, visible, readOnly, workingVotesCount, brokenReportsCount, isReportedBroken]);

  const handleVote = async (type: 'WORKING' | 'BROKEN', reason?: string) => {
    try {
      setIsSubmittingFeedback(true);
      const codeToSend = (barcode || activeCode).trim();
      const res = await api.submitBarcodeFeedback({
        barcode: codeToSend,
        type,
        reason,
        userId: currentUserId
      });

      setUserVoted(type);
      if (res.data) {
        setWorkingCount(res.data.workingVotesCount);
        setBrokenCount(res.data.brokenReportsCount);
        if (res.data.isReportedBroken) {
          setReportedBroken(true);
        }
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(type, {
            working: res.data.workingVotesCount,
            broken: res.data.brokenReportsCount
          });
        }
      }
      setShowReportModal(false);
      Alert.alert(
        type === 'WORKING' ? '¡Gracias!' : 'Reporte Registrado',
        res.message || (type === 'WORKING' ? 'Se registró que funciona en checador.' : 'Reporte de error guardado.')
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar el reporte');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

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

  // Dimensiones del SVG y Margen de Silencio (Quiet Zone)
  // Las normas GS1 y los escáneres ópticos de tiendas (Walmart, Sam's, Aurrera)
  // exigen OBLIGATORIAMENTE un margen blanco a los costados para detectar el código.
  const quietZone = 30; // Margen blanco obligatorio a cada lado
  const cardInnerWidth = Math.min(SCREEN_WIDTH - 64, 340);
  const svgWidth = cardInnerWidth;
  const barcodeHeight = 115; // Mayor altura para facilitar el escaneo láser
  const totalSvgHeight = 130;

  // Calcular barras a partir del string binario CON ZONA DE SILENCIO
  const bars = useMemo(() => {
    if (!encodedData.success || !encodedData.binary) return [];
    const binary = encodedData.binary;
    const printableWidth = svgWidth - (quietZone * 2);
    const unitWidth = printableWidth / binary.length;
    const calculatedBars: { x: number; width: number }[] = [];

    let start: number | null = null;
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        if (start === null) start = i;
      } else {
        if (start !== null) {
          calculatedBars.push({
            x: quietZone + (start * unitWidth),
            width: (i - start) * unitWidth
          });
          start = null;
        }
      }
    }
    if (start !== null) {
      calculatedBars.push({
        x: quietZone + (start * unitWidth),
        width: (binary.length - start) * unitWidth
      });
    }

    return calculatedBars;
  }, [encodedData, svgWidth, quietZone]);

  // Dimensiones para Modo Checador en Pantalla Completa (100% blanco)
  const fsQuietZone = 36;
  const fsSvgWidth = Math.min(SCREEN_WIDTH - 32, 380);
  const fsBarcodeHeight = 150;
  const fsBars = useMemo(() => {
    if (!encodedData.success || !encodedData.binary) return [];
    const binary = encodedData.binary;
    const printableWidth = fsSvgWidth - (fsQuietZone * 2);
    const unitWidth = printableWidth / binary.length;
    const calculatedBars: { x: number; width: number }[] = [];

    let start: number | null = null;
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        if (start === null) start = i;
      } else {
        if (start !== null) {
          calculatedBars.push({
            x: fsQuietZone + (start * unitWidth),
            width: (i - start) * unitWidth
          });
          start = null;
        }
      }
    }
    if (start !== null) {
      calculatedBars.push({
        x: fsQuietZone + (start * unitWidth),
        width: (binary.length - start) * unitWidth
      });
    }

    return calculatedBars;
  }, [encodedData, fsSvgWidth, fsQuietZone]);

  return (
    <>
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
            {/* Aviso de Fiabilidad tras 5 reportes */}
            {(brokenCount >= 5 || reportedBroken) && (
              <View style={styles.brokenWarningBanner}>
                <View style={styles.brokenWarningIconCol}>
                  <Text style={styles.brokenWarningIcon}>⚠️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.brokenWarningTitle}>Aviso de Fiabilidad del Código</Text>
                  <Text style={styles.brokenWarningText}>
                    Este código puede que ya no esté funcionando o fue reportado con error.
                  </Text>
                  <Text style={styles.brokenWarningCount}>
                    ({brokenCount} {brokenCount === 1 ? 'reporte' : 'reportes'} de cazadores en checador)
                  </Text>
                </View>
              </View>
            )}

            {/* Ajuste o Bloqueo de Dígitos */}
            {readOnly ? (
              <View style={styles.lockedSection}>
                <View style={styles.lockedHeader}>
                  <Text style={styles.lockedIcon}>🔒</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockedTitle}>Código Registrado de la Comunidad</Text>
                    <Text style={styles.lockedSub}>
                      Este producto ya fue creado y verificado por la comunidad. Los dígitos están protegidos para evitar inconsistencias.
                    </Text>
                  </View>
                </View>
                <View style={styles.lockedDigitsBadge}>
                  <Text style={styles.lockedDigitsLabel}>Dígitos:</Text>
                  <Text style={styles.lockedDigitsValue}>{activeCode}</Text>
                </View>
              </View>
            ) : (
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
            )}

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
                    {!readOnly && activeCode !== barcode && (
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

            {/* Botón para abrir Modo Checador en Pantalla Completa */}
            {encodedData.success && (
              <TouchableOpacity
                style={styles.fullscreenBtn}
                onPress={() => setIsFullscreen(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.fullscreenBtnIcon}>🔍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fullscreenBtnTitle}>
                    Modo Checador (Pantalla Completa)
                  </Text>
                  <Text style={styles.fullscreenBtnSubtitle}>
                    Fondo 100% blanco y código ampliado sin bordes oscuros
                  </Text>
                </View>
                <Text style={styles.fullscreenBtnArrow}>➔</Text>
              </TouchableOpacity>
            )}

            {/* Calificar y Reportar Código en Tienda */}
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackTitle}>¿Pasaste este código por el checador?</Text>
              <Text style={styles.feedbackSubtitle}>
                Califica si funcionó en la terminal física o repórtalo para alertar a la comunidad:
              </Text>

              <View style={styles.feedbackButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.feedbackBtn,
                    styles.workingBtn,
                    userVoted === 'WORKING' && styles.feedbackBtnActiveWorking
                  ]}
                  disabled={isSubmittingFeedback || userVoted !== null}
                  onPress={() => handleVote('WORKING')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.feedbackBtnIcon}>👍</Text>
                  <View style={styles.feedbackBtnCol}>
                    <Text style={styles.feedbackBtnText}>
                      {userVoted === 'WORKING' ? '¡Confirmado!' : 'Sí funciona'}
                    </Text>
                    <Text style={styles.feedbackCountText}>
                      {workingCount} {workingCount === 1 ? 'voto' : 'votos'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.feedbackBtn,
                    styles.brokenBtn,
                    userVoted === 'BROKEN' && styles.feedbackBtnActiveBroken
                  ]}
                  disabled={isSubmittingFeedback || userVoted !== null}
                  onPress={() => setShowReportModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.feedbackBtnIcon}>⚠️</Text>
                  <View style={styles.feedbackBtnCol}>
                    <Text style={styles.feedbackBtnText}>
                      {userVoted === 'BROKEN' ? 'Reportado' : 'No funciona'}
                    </Text>
                    <Text style={styles.feedbackCountText}>
                      {brokenCount} {brokenCount === 1 ? 'reporte' : 'reportes'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Banner Estilo Barcode Guru: Detección y Autocompletado de Etiqueta de Tienda (Solo si es editable) */}
            {!readOnly && analysis.isModified && (
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

    {/* Modal de Pantalla Completa (100% Blanco para checadores de tienda) */}
    <Modal
      visible={isFullscreen}
      transparent={false}
      animationType="slide"
      onRequestClose={() => setIsFullscreen(false)}
    >
      <View style={styles.fsContainer}>
        {/* Header con controles de pantalla completa */}
        <View style={styles.fsHeader}>
          <TouchableOpacity
            style={styles.fsRotateBtn}
            onPress={() => setIsRotated(prev => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.fsRotateBtnText}>🔄 {isRotated ? 'Vista Normal' : 'Girar 90°'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fsCloseBtn}
            onPress={() => setIsFullscreen(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.fsCloseBtnText}>✕ Cerrar</Text>
          </TouchableOpacity>
        </View>

        {/* Área Central del Código en Pantalla Completa con fondo blanco puro */}
        <View style={[styles.fsBarcodeArea, isRotated && styles.fsBarcodeAreaRotated]}>
          {(brokenCount >= 5 || reportedBroken) && (
            <View style={styles.fsWarningPill}>
              <Text style={styles.fsWarningPillText}>
                ⚠️ Código con {brokenCount} {brokenCount === 1 ? 'reporte' : 'reportes'} de falla en checador
              </Text>
            </View>
          )}

          {productName ? (
            <Text style={styles.fsProductName} numberOfLines={2}>
              {productName}
            </Text>
          ) : null}

          <View style={styles.fsSvgCard}>
            <Svg width={fsSvgWidth} height={fsBarcodeHeight + 20}>
              <G>
                {fsBars.map((bar, index) => (
                  <Rect
                    key={index}
                    x={bar.x}
                    y={10}
                    width={bar.width}
                    height={fsBarcodeHeight}
                    fill="#000000"
                  />
                ))}
              </G>
            </Svg>

            <Text style={styles.fsHumanReadableText}>{activeCode}</Text>
            <Text style={styles.fsFormatBadge}>FORMATO: {encodedData.usedFormat}</Text>
          </View>
        </View>

        {/* Pie de pantalla completa con recomendación técnica */}
        <View style={styles.fsFooter}>
          <Text style={styles.fsFooterTip}>
            💡 Coloca la pantalla frente al rayo láser del verificador a 10-15 cm con el brillo al máximo.
          </Text>
        </View>
      </View>
    </Modal>

    {/* Modal para Reportar Falla o Error del Código */}
    <Modal
      visible={showReportModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowReportModal(false)}
    >
      <View style={styles.reportModalOverlay}>
        <View style={styles.reportModalCard}>
          <View style={styles.reportModalHeader}>
            <Text style={styles.reportModalIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportModalTitle}>Reportar Error en Código</Text>
              <Text style={styles.reportModalSub}>
                Selecciona por qué no funcionó en el verificador:
              </Text>
            </View>
          </View>

          <View style={styles.reasonsList}>
            {[
              'El verificador no reconoce el código',
              'El lector láser no lo puede escanear',
              'Corresponde a otro producto',
              'Etiqueta vencida o error de dígitos',
              'Otro motivo'
            ].map((reason, idx) => {
              const isSelected = selectedReason === reason;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.reasonOption,
                    isSelected && styles.reasonOptionSelected
                  ]}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.reasonRadio, isSelected && styles.reasonRadioSelected]}>
                    {isSelected && <View style={styles.reasonRadioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.reasonOptionText,
                      isSelected && styles.reasonOptionTextSelected
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.reportModalActions}>
            <TouchableOpacity
              style={styles.cancelReportBtn}
              onPress={() => setShowReportModal(false)}
              disabled={isSubmittingFeedback}
            >
              <Text style={styles.cancelReportBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitReportBtn}
              onPress={() => handleVote('BROKEN', selectedReason)}
              disabled={isSubmittingFeedback}
            >
              {isSubmittingFeedback ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitReportBtnText}>Enviar Reporte</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
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
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 12,
    width: '100%'
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
  },
  // Botón Modo Checador
  fullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  fullscreenBtnIcon: {
    fontSize: 20
  },
  fullscreenBtnTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800'
  },
  fullscreenBtnSubtitle: {
    color: '#bae6fd',
    fontSize: 11,
    marginTop: 1
  },
  fullscreenBtnArrow: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  // Estilos de Pantalla Completa (100% Blanco para checadores de tienda)
  fsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    paddingVertical: 44,
    paddingHorizontal: 16
  },
  fsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8
  },
  fsRotateBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  fsRotateBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700'
  },
  fsCloseBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20
  },
  fsCloseBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  fsBarcodeArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 20
  },
  fsBarcodeAreaRotated: {
    transform: [{ rotate: '90deg' }]
  },
  fsProductName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    maxWidth: '90%'
  },
  fsSvgCard: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 12
  },
  fsHumanReadableText: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 12,
    fontFamily: 'monospace'
  },
  fsFormatBadge: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1
  },
  fsFooter: {
    alignItems: 'center',
    paddingHorizontal: 20
  },
  fsFooterTip: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17
  },
  // Estilos de Aviso de Fiabilidad tras 5 reportes
  brokenWarningBanner: {
    flexDirection: 'row',
    backgroundColor: '#451a03',
    borderColor: '#d97706',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    gap: 12
  },
  brokenWarningIconCol: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#78350f',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brokenWarningIcon: {
    fontSize: 20
  },
  brokenWarningTitle: {
    color: '#fbbf24',
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 2
  },
  brokenWarningText: {
    color: '#fef3c7',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17
  },
  brokenWarningCount: {
    color: '#fde68a',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500'
  },
  // Estilos de Código Bloqueado (Read Only para productos comunitarios)
  lockedSection: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  lockedIcon: {
    fontSize: 22
  },
  lockedTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700'
  },
  lockedSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16
  },
  lockedDigitsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8
  },
  lockedDigitsLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600'
  },
  lockedDigitsValue: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1.5
  },
  // Estilos de Calificación y Reporte
  feedbackSection: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  feedbackTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2
  },
  feedbackSubtitle: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12
  },
  feedbackButtonsRow: {
    flexDirection: 'row',
    gap: 10
  },
  feedbackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8
  },
  workingBtn: {
    backgroundColor: '#064e3b',
    borderColor: '#059669'
  },
  brokenBtn: {
    backgroundColor: '#451a03',
    borderColor: '#d97706'
  },
  feedbackBtnActiveWorking: {
    backgroundColor: '#047857',
    borderColor: '#34d399'
  },
  feedbackBtnActiveBroken: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444'
  },
  feedbackBtnIcon: {
    fontSize: 18
  },
  feedbackBtnCol: {
    flex: 1
  },
  feedbackBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  feedbackCountText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    marginTop: 1
  },
  fsWarningPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  fsWarningPillText: {
    color: '#92400e',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center'
  },
  // Estilos del Modal de Reporte
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  reportModalCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  reportModalIcon: {
    fontSize: 26
  },
  reportModalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  reportModalSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  reasonsList: {
    gap: 8,
    marginBottom: 18
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10
  },
  reasonOptionSelected: {
    borderColor: '#ef4444',
    backgroundColor: '#451a03'
  },
  reasonRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reasonRadioSelected: {
    borderColor: '#ef4444'
  },
  reasonRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444'
  },
  reasonOptionText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500'
  },
  reasonOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '700'
  },
  reportModalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  },
  cancelReportBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#334155'
  },
  cancelReportBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  submitReportBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#dc2626'
  },
  submitReportBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  }
});
