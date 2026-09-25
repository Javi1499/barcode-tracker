import React, { useState, useEffect } from 'react';
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

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = Math.min(width * 0.75, 280);

interface ScannerScreenProps {
  onBarcodeDetected: (barcode: string, lookupData?: any) => void;
  onViewHistory?: (barcode: string) => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({
  onBarcodeDetected,
  onViewHistory
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

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

  // 1. Escaneo en vivo con Cámara -> Primero abre verificación/edición
  const handleCameraBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned || isLoading) return;
    console.log('📷 Código detectado por cámara:', result.data, result.type);
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
          isCameraReady
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
          isCameraReady && !scanned ? handleCameraBarcodeScanned : undefined
        }
      />

      {/* Capa de interfaz de usuario sobre el video de la cámara */}
      <View style={styles.overlayContainer}>
        {/* Cabecera Superior Semitransparente */}
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Cazador de Liquidaciones</Text>
          <Text style={styles.headerSubtitle}>
            Apunta al código del producto o etiqueta de cenefa
          </Text>
        </View>

        {/* Zona Central de Escaneo: 100% Transparente para que la cámara se vea clara */}
        <View style={styles.centerTargetArea}>
          <View style={styles.scanTargetBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.redLaserLine} />
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
              onPress={() => setScanned(false)}
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
        onConfirmAndRegister={(verifiedCode) => {
          setPreviewModalVisible(false);
          onBarcodeDetected(verifiedCode, lookupData?.data || null);
        }}
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
    marginTop: 4
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
  bottomControlsArea: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center'
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
    gap: 10
  },
  actionIconButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
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
