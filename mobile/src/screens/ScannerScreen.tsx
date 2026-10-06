import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { BarcodeScannerService } from '../services/barcodeScannerService';
import { api } from '../services/api';
import { analyzeAndFormatBarcode } from '../utils/barcodeFormatter';
import { BarcodeModal } from '../components/BarcodeModal';
import { playScanBeep, initSoundService, setSoundEnabled } from '../services/soundService';

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = Math.min(width * 0.75, 280);

interface ScannerScreenProps {
  onBarcodeDetected: (barcode: string, lookupData?: any) => void;
  onViewHistory?: (barcode: string) => void;
  onSaveToPersonalBank?: (barcode: string, lookupData?: any) => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({
  onBarcodeDetected,
  onViewHistory,
  onSaveToPersonalBank
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Modo de escaneo: 'MANUAL' (con botón disparador, evita falsos escaneos) vs 'AUTO' (continuo)
  const [scanMode, setScanMode] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [isScanningActive, setIsScanningActive] = useState(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estados para el visor previo del código (flujo de verificación de checador)
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewBarcode, setPreviewBarcode] = useState('');
  const [previewProductName, setPreviewProductName] = useState('');
  const [lookupData, setLookupData] = useState<any>(null);

  // Estado para el modal de entrada manual
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Estado para el paso 1 de Verificación y Edición de código detectado
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [detectedCode, setDetectedCode] = useState('');
  const [scanOrigin, setScanOrigin] = useState<'camera' | 'gallery'>('camera');

  // Estado y preferencia del bip de escaneo (verificador de precio)
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    initSoundService().then(enabled => {
      setSoundEnabledState(enabled);
    });
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundEnabled(next);
  };

  // Limpiar temporizador al desmontar
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Solicitar permisos al montar
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Manejo de código detectado (Común para Cámara, Galería y Manual)
  // Genera el preview del código formateado para checador físico antes de guardar
  const handleProcessBarcode = async (rawCode: string) => {
    const cleanedCode = rawCode.trim();
    if (!cleanedCode) return;

    // Analizar y autocompletar si es etiqueta incompleta
    const analysis = analyzeAndFormatBarcode(cleanedCode);
    const codeToSearch = analysis.optimizedCode;

    setPreviewBarcode(cleanedCode);
    setIsLoading(true);

    try {
      // Consultar nombre del producto o historial si ya fue avistado antes
      const res = await api.lookupBarcode(codeToSearch);
      setLookupData(res);
      if (res.exists && res.data?.product?.name) {
        setPreviewProductName(res.data.product.name);
      } else {
        setPreviewProductName('Producto nuevo / Sin registrar');
      }
    } catch {
      setLookupData(null);
      setPreviewProductName('Producto para verificar');
    } finally {
      setIsLoading(false);
      // Abrir el preview de alta resolución para pasar al checador de la tienda
      setPreviewModalVisible(true);
    }
  };

  // Disparador manual para capturar el código enfocado a propósito
  const handleTriggerScan = () => {
    if (scanned || isLoading) return;
    setIsScanningActive(true);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    scanTimeoutRef.current = setTimeout(() => {
      setIsScanningActive(false);
      Alert.alert(
        'Código no detectado',
        'No se detectó un código claro en el recuadro. Acerca la cámara, ajusta el enfoque o prueba encender la linterna.',
        [{ text: 'Entendido' }]
      );
    }, 4500);
  };

  // 1. Escaneo en vivo con Cámara -> Primero abre verificación/edición
  const handleCameraBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned || isLoading) return;

    // Si está en modo manual, sólo procesar si el usuario presionó el botón disparador
    if (scanMode === 'MANUAL' && !isScanningActive) {
      return;
    }

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanningActive(false);

    console.log('📷 Código detectado por cámara:', result.data, result.type);
    playScanBeep();
    setScanned(true);
    setDetectedCode(result.data ? result.data.trim() : '');
    setScanOrigin('camera');
    setVerificationModalVisible(true);
  };

  // 2. Extracción desde Fotografía en Galería -> Primero abre verificación/edición
  const handlePickFromGallery = async () => {
    setIsLoading(true);
    const extractedBarcode = await BarcodeScannerService.pickAndScanFromGallery();
    setIsLoading(false);

    if (extractedBarcode) {
      playScanBeep();
      setScanned(true);
      setDetectedCode(extractedBarcode.trim());
      setScanOrigin('gallery');
      setVerificationModalVisible(true);
    }
  };

  // 3. Confirmación tras verificar o corregir dígitos
  const handleConfirmVerification = () => {
    const clean = detectedCode.trim();
    if (!clean || clean.length < 4) {
      Alert.alert('Código Incompleto', 'Ingresa un código de barras válido (mínimo 4 dígitos).');
      return;
    }
    setVerificationModalVisible(false);
    handleProcessBarcode(clean);
  };

  // 4. Confirmación de Ingreso Manual
  const handleManualSubmit = () => {
    if (!manualCode.trim() || manualCode.trim().length < 6) {
      Alert.alert('Código Inválido', 'Ingresa un código de barras válido (mínimo 6 dígitos).');
      return;
    }
    setManualModalVisible(false);
    const code = manualCode.trim();
    setManualCode('');
    setScanned(true);
    handleProcessBarcode(code);
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>Se requieren permisos de cámara para escanear en tienda.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Conceder Permisos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isScanningEnabled = isCameraReady && !scanned && (scanMode === 'AUTO' || isScanningActive);

  return (
    <View style={styles.container}>
      {/* Visor de Cámara de Pantalla Completa con inicialización en 2 fases para Android CameraX */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        enableTorch={flashEnabled}
        onCameraReady={() => {
          console.log('📷 Hardware de cámara listo en Android');
          setIsCameraReady(true);
        }}
        barcodeScannerSettings={
          isScanningEnabled
            ? {
                barcodeTypes: [
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                  'qr'
                ]
              }
            : undefined
        }
        onBarcodeScanned={
          isScanningEnabled ? handleCameraBarcodeScanned : undefined
        }
      />

      {/* Capa de interfaz de usuario sobre el video de la cámara */}
      <View style={styles.overlayContainer}>
        {/* Cabecera Superior Semitransparente */}
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Cazador de Liquidaciones</Text>
          <Text style={styles.headerSubtitle}>
            {scanMode === 'MANUAL'
              ? 'Centra las barras en el recuadro y presiona "Capturar Código"'
              : 'Escaneando automáticamente lo que entra en cámara...'}
          </Text>

          {/* Selector de Modo: Con Botón (Manual) vs Automático */}
          <View style={styles.modeSwitchRow}>
            <TouchableOpacity
              style={[styles.modePill, scanMode === 'MANUAL' && styles.modePillActive]}
              onPress={() => {
                setScanMode('MANUAL');
                setIsScanningActive(false);
              }}
            >
              <Text style={[styles.modePillText, scanMode === 'MANUAL' && styles.modePillTextActive]}>
                🎯 Con Botón (Evita errores)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modePill, scanMode === 'AUTO' && styles.modePillActive]}
              onPress={() => {
                setScanMode('AUTO');
                setIsScanningActive(false);
              }}
            >
              <Text style={[styles.modePillText, scanMode === 'AUTO' && styles.modePillTextActive]}>
                ⚡ Automático
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Zona Central de Escaneo: 100% Transparente para que la cámara se vea clara */}
        <View style={styles.centerTargetArea}>
          <View style={styles.scanTargetBox}>
            <View style={[styles.corner, styles.topLeft, isScanningActive && styles.cornerActive]} />
            <View style={[styles.corner, styles.topRight, isScanningActive && styles.cornerActive]} />
            <View style={[styles.corner, styles.bottomLeft, isScanningActive && styles.cornerActive]} />
            <View style={[styles.corner, styles.bottomRight, isScanningActive && styles.cornerActive]} />
            <View style={[styles.redLaserLine, isScanningActive && styles.greenLaserLine]} />

            <View style={styles.aimBoxLabelContainer}>
              <Text style={[styles.aimBoxLabel, isScanningActive && styles.aimBoxLabelActive]}>
                {isScanningActive
                  ? '⚡ Escaneando código enfocado...'
                  : 'Centra aquí el código'}
              </Text>
            </View>
          </View>
        </View>

        {/* Panel Inferior de Controles Semitransparente */}
        <View style={styles.bottomControlsArea}>
          {isLoading && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color="#38bdf8" style={{ marginRight: 8 }} />
              <Text style={styles.loadingText}>Consultando banco de ofertas...</Text>
            </View>
          )}

          {/* Botón Principal Disparador para Modo Manual */}
          {scanMode === 'MANUAL' && !scanned && (
            <TouchableOpacity
              style={[
                styles.shutterButton,
                isScanningActive && styles.shutterButtonScanning
              ]}
              onPress={handleTriggerScan}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <View style={[styles.shutterIconCircle, isScanningActive && styles.shutterIconCircleScanning]}>
                {isScanningActive ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.shutterIconText}>📸</Text>
                )}
              </View>
              <View style={styles.shutterTextContainer}>
                <Text style={styles.shutterButtonTitle}>
                  {isScanningActive ? 'Capturando código...' : 'Capturar Código'}
                </Text>
                <Text style={styles.shutterButtonSubtitle}>
                  {isScanningActive
                    ? 'Mantén el código fijo en el recuadro'
                    : 'Toca aquí una vez enfocado el código'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Barra de Acciones */}
          <View style={styles.actionsBar}>
            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => setFlashEnabled(prev => !prev)}
            >
              <Text style={styles.actionIcon}>{flashEnabled ? '🔦 ON' : '💡 Flash'}</Text>
              <Text style={styles.actionSubtext}>Linterna</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionIconButton, !soundEnabled && styles.actionIconMuted]}
              onPress={toggleSound}
            >
              <Text style={styles.actionIcon}>{soundEnabled ? '🔊 Bip' : '🔇 Mudo'}</Text>
              <Text style={styles.actionSubtext}>{soundEnabled ? 'Sonido ON' : 'Sonido OFF'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionIconButton, styles.galleryButton]}
              onPress={handlePickFromGallery}
            >
              <Text style={styles.actionIcon}>🖼️ Galería</Text>
              <Text style={styles.actionSubtext}>Escanear foto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => setManualModalVisible(true)}
            >
              <Text style={styles.actionIcon}>⌨️ Manual</Text>
              <Text style={styles.actionSubtext}>Digitar</Text>
            </TouchableOpacity>
          </View>

          {scanned && !isLoading && (
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={() => {
                setScanned(false);
                setIsScanningActive(false);
              }}
            >
              <Text style={styles.rescanButtonText}>Toca para volver a escanear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Modal para Ingreso Manual de Código de Barras */}
      <Modal
        visible={manualModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ingreso Manual de Código</Text>
            <Text style={styles.modalDescription}>
              Escribe los números que vienen impresos debajo de las barras del empaque o en la etiqueta del estante.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ej. 7501055312345 o 12 dígitos"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={manualCode}
              onChangeText={setManualCode}
              maxLength={18}
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setManualModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSubmitBtn]}
                onPress={handleManualSubmit}
              >
                <Text style={styles.modalSubmitText}>Buscar / Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Paso 1: Revisar y Corregir Código Detectado por Cámara o Foto */}
      <Modal
        visible={verificationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setVerificationModalVisible(false);
          setScanned(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.originBadgeRow}>
              <View style={styles.originBadge}>
                <Text style={styles.originBadgeText}>
                  {scanOrigin === 'camera' ? '📷 Escaneado por Cámara' : '🖼️ Detectado en Foto'}
                </Text>
              </View>
              <Text style={styles.digitsLengthBadge}>
                {detectedCode.length} dígitos
              </Text>
            </View>

            <Text style={styles.modalTitle}>Revisar Código Detectado</Text>
            <Text style={styles.modalDescription}>
              Si la cámara o foto confundió algún dígito (por ejemplo, un 8 por un 0), corrígelo aquí antes de generar el código para el checador:
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.verificationInput}
                placeholder="Código de barras..."
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={detectedCode}
                onChangeText={setDetectedCode}
                maxLength={20}
                selectTextOnFocus
              />
              {detectedCode.length > 0 && (
                <TouchableOpacity
                  style={styles.clearInputBtn}
                  onPress={() => setDetectedCode('')}
                >
                  <Text style={styles.clearInputText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Ayuda contextual sobre la longitud */}
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>
                {detectedCode.length === 12
                  ? '💡 12 dígitos detectados (etiqueta cenefa). Se calculará el 13° dígito verificador para el checador.'
                  : detectedCode.length === 13
                  ? '✅ Código EAN-13 estándar completo de 13 dígitos.'
                  : detectedCode.length === 11
                  ? '💡 11 dígitos detectados (cenefa corta). Se acompletará el formato para el checador.'
                  : '🔍 Comprueba los números antes de continuar al checador.'}
              </Text>
            </View>

            <View style={styles.verificationActionButtons}>
              <TouchableOpacity
                style={styles.verificationContinueBtn}
                onPress={handleConfirmVerification}
              >
                <Text style={styles.verificationContinueText}>
                  ⚡ Generar Código para Checador
                </Text>
                <Text style={styles.verificationContinueSubtext}>
                  Ver opciones en EAN-13, Code 128 y cenefa
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.verificationCancelBtn}
                onPress={() => {
                  setVerificationModalVisible(false);
                  setScanned(false);
                }}
              >
                <Text style={styles.verificationCancelText}>
                  ✕ Cancelar y volver a escanear
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Preview para Verificador de Tienda (Flujo Barcode Guru) */}
      <BarcodeModal
        visible={previewModalVisible}
        onClose={() => {
          setPreviewModalVisible(false);
          setScanned(false);
        }}
        barcode={previewBarcode}
        productName={previewProductName}
        showSaveActions={true}
        readOnly={Boolean(lookupData?.exists)}
        brokenReportsCount={lookupData?.data?.product?.brokenReportsCount ?? lookupData?.brokenReportsCount}
        workingVotesCount={lookupData?.data?.product?.workingVotesCount ?? lookupData?.workingVotesCount}
        isReportedBroken={Boolean(lookupData?.data?.product?.isReportedBroken ?? lookupData?.isReportedBroken)}
        onConfirmAndRegister={(verifiedCode) => {
          setPreviewModalVisible(false);
          onBarcodeDetected(verifiedCode, lookupData?.data || null);
        }}
        onSaveToPersonalBank={onSaveToPersonalBank ? (verifiedCode) => {
          setPreviewModalVisible(false);
          onSaveToPersonalBank(verifiedCode, lookupData?.data || null);
        } : undefined}
        onViewHistory={onViewHistory ? (verifiedCode) => {
          setPreviewModalVisible(false);
          onViewHistory(verifiedCode);
        } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 24
  },
  permissionText: {
    color: '#f8fafc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  topHeader: {
    width: '100%',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center'
  },
  headerTitle: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center'
  },
  modeSwitchRow: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16
  },
  modePillActive: {
    backgroundColor: '#0284c7'
  },
  modePillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  modePillTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  centerTargetArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%'
  },
  scanTargetBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38bdf8'
  },
  cornerActive: {
    borderColor: '#22c55e'
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6
  },
  redLaserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.9,
    shadowRadius: 5
  },
  greenLaserLine: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    height: 3
  },
  aimBoxLabelContainer: {
    position: 'absolute',
    bottom: -32,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  aimBoxLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  aimBoxLabelActive: {
    color: '#4ade80',
    fontWeight: '700'
  },
  bottomControlsArea: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center'
  },
  shutterButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    shadowColor: '#0284c7',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  },
  shutterButtonScanning: {
    backgroundColor: '#15803d',
    borderColor: '#4ade80'
  },
  shutterIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  shutterIconCircleScanning: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)'
  },
  shutterIconText: {
    fontSize: 20
  },
  shutterTextContainer: {
    flex: 1
  },
  shutterButtonTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  shutterButtonSubtitle: {
    color: '#e0f2fe',
    fontSize: 11,
    marginTop: 1
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 12
  },
  loadingText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600'
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6
  },
  actionIconButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionIconMuted: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    opacity: 0.75
  },
  galleryButton: {
    borderColor: '#38bdf8'
  },
  actionIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  actionSubtext: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2
  },
  rescanButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12
  },
  rescanButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8
  },
  modalDescription: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: '#475569',
    marginBottom: 20
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8
  },
  modalCancelBtn: {
    backgroundColor: '#334155'
  },
  modalCancelText: {
    color: '#cbd5e1',
    fontWeight: '600'
  },
  modalSubmitBtn: {
    backgroundColor: '#0284c7'
  },
  modalSubmitText: {
    color: '#ffffff',
    fontWeight: '700'
  },
  originBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  originBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  originBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  digitsLengthBadge: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 10
  },
  verificationInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    color: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 44,
    fontSize: 20,
    letterSpacing: 3,
    fontWeight: '800',
    fontFamily: 'monospace',
    borderWidth: 2,
    borderColor: '#38bdf8'
  },
  clearInputBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  clearInputText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold'
  },
  hintContainer: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    marginBottom: 18
  },
  hintText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16
  },
  verificationActionButtons: {
    gap: 10
  },
  verificationContinueBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3
  },
  verificationContinueText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  verificationContinueSubtext: {
    color: '#dcfce7',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500'
  },
  verificationCancelBtn: {
    backgroundColor: '#334155',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center'
  },
  verificationCancelText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  }
});
