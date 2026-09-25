import * as ImagePicker from 'expo-image-picker';
import { scanFromURLAsync, BarcodeType } from 'expo-camera';
import { Alert } from 'react-native';

const SUPPORTED_BARCODE_FORMATS: BarcodeType[] = [
  'ean13',
  'upc_a',
  'ean8',
  'code128',
  'code39',
  'qr',
  'upc_e',
  'itf14'
];

/**
 * Servicio encargado de la adquisición y extracción de códigos de barras
 * tanto en vivo (cámara) como procesado estático (galería).
 */
export const BarcodeScannerService = {
  /**
   * Abre el selector de la galería del dispositivo para que el usuario elija una fotografía
   * de una etiqueta o producto físico y extrae su código de barras.
   */
  async pickAndScanFromGallery(): Promise<string | null> {
    try {
      // 1. Solicitar permisos de acceso a la biblioteca de imágenes
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permiso Denegado',
          'Se necesita acceso a la galería para poder leer códigos de barras desde fotografías.'
        );
        return null;
      }

      // 2. Abrir la galería para seleccionar la fotografía
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Permite al usuario recortar hacia la etiqueta/código
        quality: 1
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return null;
      }

      const selectedAsset = pickerResult.assets[0];

      // 3. Extracción nativa de código de barras desde la imagen usando expo-camera
      const detectedBarcode = await this.decodeBarcodeFromImageUri(selectedAsset.uri);

      if (!detectedBarcode) {
        Alert.alert(
          'No se detectó código',
          'No se encontró un código de barras claro en la imagen seleccionada. Asegúrate de enfocar bien las barras o digítalo manualmente.'
        );
        return null;
      }

      return detectedBarcode;
    } catch (error) {
      console.error('Error al procesar imagen de galería:', error);
      Alert.alert('Error', 'Ocurrió un fallo al intentar leer la imagen.');
      return null;
    }
  },

  /**
   * Decodificador nativo de imagen utilizando el motor de escaneo de expo-camera.
   */
  async decodeBarcodeFromImageUri(uri: string): Promise<string | null> {
    try {
      if (typeof scanFromURLAsync === 'function') {
        const results = await scanFromURLAsync(uri, SUPPORTED_BARCODE_FORMATS);
        if (results && results.length > 0 && results[0].data) {
          return results[0].data;
        }
      }
    } catch (err) {
      console.warn('scanFromURLAsync falló o no soportado en esta plataforma:', err);
    }

    // Fallback: Web BarcodeDetector si se ejecuta en navegador
    if (typeof (globalThis as any).BarcodeDetector !== 'undefined') {
      try {
        const barcodeDetector = new (globalThis as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
        });
        const response = await fetch(uri);
        const blob = await response.blob();
        const barcodes = await barcodeDetector.detect(blob);
        if (barcodes && barcodes.length > 0) {
          return barcodes[0].rawValue;
        }
      } catch (e) {
        console.warn('BarcodeDetector web falló:', e);
      }
    }

    return null;
  }
};
