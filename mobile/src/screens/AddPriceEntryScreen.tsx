import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { api } from '../services/api';
import { PriceType } from '../types';

interface AddPriceEntryScreenProps {
  barcode: string;
  initialData?: any; // Datos del lookup si ya existía
  currentUserId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AddPriceEntryScreen: React.FC<AddPriceEntryScreenProps> = ({
  barcode,
  initialData,
  currentUserId,
  onSuccess,
  onCancel
}) => {
  const isExisting = Boolean(initialData?.product);

  const [productName, setProductName] = useState(initialData?.product?.name || '');
  const [reportedPrice, setReportedPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState(
    initialData?.latestPriceEntry?.price ? String(initialData.latestPriceEntry.price) : ''
  );
  const [storeName, setStoreName] = useState(
    initialData?.latestPriceEntry?.store ? initialData.latestPriceEntry.store.split('(')[0].trim() : 'Walmart'
  );
  const [storeBranch, setStoreBranch] = useState('');
  const [priceType, setPriceType] = useState<PriceType>('LIQUIDATION_FINAL');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isExisting && !productName.trim()) {
      Alert.alert('Faltan Datos', 'Por favor ingresa el nombre del producto.');
      return;
    }

    const priceNum = parseFloat(reportedPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Precio Inválido', 'Ingresa un precio numérico válido mayor a 0.');
      return;
    }

    if (!storeName.trim() || !storeBranch.trim()) {
      Alert.alert('Faltan Datos', 'Ingresa la tienda y la sucursal donde encontraste la oferta.');
      return;
    }

    setLoading(true);
    try {
      // Usar usuario autenticado o demo si es invitado
      const userIdToUse = currentUserId || '00000000-0000-0000-0000-000000000001';

      const response = await api.addPriceEntry({
        barcode,
        productName: isExisting ? undefined : productName.trim(),
        reportedPrice: priceNum,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        storeName: storeName.trim(),
        storeBranch: storeBranch.trim(),
        priceType,
        notes: notes.trim() || undefined,
        userId: userIdToUse
      });

      Alert.alert(
        '🎉 ¡Liquidación Registrada!',
        response.comparison?.message || 'Tu aporte ha sido agregado a la bitácora comunitaria.',
        [{ text: 'Aceptar', onPress: onSuccess }]
      );
    } catch (err: any) {
      console.error('Error al guardar precio:', err);
      Alert.alert('Error', err.message || 'No se pudo guardar la liquidación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕ Cancelar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {isExisting ? 'Actualizar Precio de Liquidación' : 'Registrar Nuevo Producto'}
        </Text>
        <Text style={styles.barcodeLabel}>Código: {barcode}</Text>

        {/* Notificación si ya existía en la base de datos */}
        {isExisting && initialData.latestPriceEntry && (
          <View style={styles.existingNotice}>
            <Text style={styles.noticeIcon}>ℹ️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>
                Registrado hace {initialData.latestPriceEntry.daysSinceLastReport} días a $
                {initialData.latestPriceEntry.price.toFixed(2)}
              </Text>
              <Text style={styles.noticeSub}>
                En {initialData.latestPriceEntry.store}. Agrega el nuevo precio que ves físicamente ahora.
              </Text>
            </View>
          </View>
        )}

        {/* Nombre del Producto */}
        {!isExisting ? (
          <View style={styles.field}>
            <Text style={styles.label}>Nombre del Producto *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Pantalla Samsung 55 4K Smart TV"
              placeholderTextColor="#64748b"
              value={productName}
              onChangeText={setProductName}
            />
          </View>
        ) : (
          <View style={styles.existingProductBanner}>
            <Text style={styles.existingProductLabel}>Producto:</Text>
            <Text style={styles.existingProductName}>{initialData.product.name}</Text>
          </View>
        )}

        {/* Precios */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Nuevo Precio Visto *</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="$ 0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={reportedPrice}
              onChangeText={setReportedPrice}
            />
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Precio Original (Tachado)</Text>
            <TextInput
              style={styles.input}
              placeholder="$ 0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={originalPrice}
              onChangeText={setOriginalPrice}
            />
          </View>
        </View>

        {/* Tienda y Sucursal */}
        <View style={styles.field}>
          <Text style={styles.label}>Cadena de Tienda *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Walmart, Bodega Aurrera, Soriana"
            placeholderTextColor="#64748b"
            value={storeName}
            onChangeText={setStoreName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Sucursal / Ubicación *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Sucursal Plaza Tepeyac"
            placeholderTextColor="#64748b"
            value={storeBranch}
            onChangeText={setStoreBranch}
          />
        </View>

        {/* Tipo de Liquidación */}
        <View style={styles.field}>
          <Text style={styles.label}>Tipo de Liquidación</Text>
          <View style={styles.typesRow}>
            {[
              { label: 'Remate .01', val: 'LIQUIDATION_FINAL' },
              { label: '2da Liq .02', val: 'LIQUIDATION_SECOND' },
              { label: '1ra Liq .03', val: 'LIQUIDATION_FIRST' },
              { label: 'Promoción', val: 'PROMOTION' }
            ].map(item => (
              <TouchableOpacity
                key={item.val}
                style={[
                  styles.typeChip,
                  priceType === item.val && styles.typeChipActive
                ]}
                onPress={() => setPriceType(item.val as PriceType)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    priceType === item.val && styles.typeChipTextActive
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notas adicionales */}
        <View style={styles.field}>
          <Text style={styles.label}>Notas para otros cazadores</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej. Quedan 2 piezas en vitrina de electrónica pasillo 4"
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Botón de Enviar */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isExisting ? 'Guardar Nuevo Precio en Historial' : 'Crear Producto y Guardar Precio'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  content: {
    padding: 24
  },
  backBtn: {
    marginBottom: 16
  },
  backBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold'
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4
  },
  barcodeLabel: {
    color: '#38bdf8',
    fontSize: 14,
    marginBottom: 20,
    fontWeight: '600'
  },
  existingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20
  },
  noticeIcon: {
    fontSize: 24,
    marginRight: 10
  },
  noticeTitle: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 14
  },
  noticeSub: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2
  },
  existingProductBanner: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  existingProductLabel: {
    color: '#94a3b8',
    fontSize: 12
  },
  existingProductName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2
  },
  field: {
    marginBottom: 16
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15
  },
  priceInput: {
    borderColor: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 18,
    color: '#38bdf8'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  typeChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  typeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  typeChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  typeChipTextActive: {
    color: '#ffffff'
  },
  submitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 30
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16
  }
});
