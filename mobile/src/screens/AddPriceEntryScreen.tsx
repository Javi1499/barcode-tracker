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
  initialTargetMode?: 'COMMUNITY' | 'PERSONAL';
  onSuccess: () => void;
  onCancel: () => void;
  onRequestLogin?: () => void;
}

export const AddPriceEntryScreen: React.FC<AddPriceEntryScreenProps> = ({
  barcode,
  initialData,
  currentUserId,
  initialTargetMode = 'COMMUNITY',
  onSuccess,
  onCancel,
  onRequestLogin
}) => {
  const isExisting = Boolean(initialData?.product);
  const createdById = initialData?.product?.createdById || initialData?.data?.product?.createdById;
  const isCreator = Boolean(isExisting && currentUserId && createdById === currentUserId);

  const [destinationMode, setDestinationMode] = useState<'COMMUNITY' | 'PERSONAL'>(initialTargetMode);
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
    // Validar que el usuario esté autenticado para registrar/guardar
    if (!currentUserId) {
      Alert.alert(
        'Cuenta Requerida',
        'Para guardar productos en tu banco privado o publicar ofertas en la comunidad, necesitas iniciar sesión.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Iniciar Sesión',
            onPress: () => {
              if (onRequestLogin) onRequestLogin();
            }
          }
        ]
      );
      return;
    }

    if ((!isExisting || isCreator) && !productName.trim()) {
      Alert.alert('Faltan Datos', 'Por favor ingresa el nombre del producto.');
      return;
    }

    const priceNum = parseFloat(reportedPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Precio Inválido', 'Ingresa un precio numérico válido mayor a 0.');
      return;
    }

    setLoading(true);
    try {
      if (destinationMode === 'PERSONAL') {
        // Guardar exclusivamente en el banco privado del usuario
        await api.savePersonalBarcode({
          userId: currentUserId,
          barcode,
          name: productName.trim() || initialData?.product?.name || 'Producto personal',
          price: priceNum,
          originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
          storeName: storeName.trim() || undefined,
          storeBranch: storeBranch.trim() || undefined,
          notes: notes.trim() || undefined
        });

        Alert.alert(
          '🔒 Guardado en Mi Banco',
          'El código de barras se ha guardado en tu colección personal privada. Puedes consultarlo o publicarlo cuando quieras.',
          [{ text: 'Aceptar', onPress: onSuccess }]
        );
      } else {
        // Publicar en la comunidad general
        if (!storeName.trim() || !storeBranch.trim()) {
          setLoading(false);
          Alert.alert('Faltan Datos', 'Ingresa la tienda y la sucursal donde encontraste la oferta.');
          return;
        }

        const response = await api.addPriceEntry({
          barcode,
          productName: !isExisting || isCreator ? productName.trim() : undefined,
          reportedPrice: priceNum,
          originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
          storeName: storeName.trim(),
          storeBranch: storeBranch.trim(),
          priceType,
          notes: notes.trim() || undefined,
          userId: currentUserId
        });

        Alert.alert(
          '🎉 ¡Liquidación Publicada!',
          response.comparison?.message || 'Tu aporte ha sido publicado para la comunidad de cazadores (+10 pts).',
          [{ text: 'Aceptar', onPress: onSuccess }]
        );
      }
    } catch (err: any) {
      console.error('Error al guardar precio:', err);
      Alert.alert('Error', err.message || 'No se pudo guardar la información.');
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
          {destinationMode === 'PERSONAL'
            ? 'Guardar en Mi Banco Propio'
            : isExisting
            ? 'Actualizar Precio de Liquidación'
            : 'Publicar Nuevo Producto en Comunidad'}
        </Text>
        <Text style={styles.barcodeLabel}>Código: {barcode}</Text>

        {/* Selector de Destino: Comunidad vs Mi Banco Propio */}
        <View style={styles.destinationTabs}>
          <TouchableOpacity
            style={[
              styles.destTab,
              destinationMode === 'COMMUNITY' && styles.destTabActive
            ]}
            onPress={() => setDestinationMode('COMMUNITY')}
          >
            <Text
              style={[
                styles.destTabText,
                destinationMode === 'COMMUNITY' && styles.destTabTextActive
              ]}
            >
              🌐 Publicar a Comunidad
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.destTab,
              destinationMode === 'PERSONAL' && styles.destTabActivePersonal
            ]}
            onPress={() => setDestinationMode('PERSONAL')}
          >
            <Text
              style={[
                styles.destTabText,
                destinationMode === 'PERSONAL' && styles.destTabTextActive
              ]}
            >
              🔒 Mi Banco Privado
            </Text>
          </TouchableOpacity>
        </View>

        {/* Banner informativo del modo seleccionado */}
        <View style={[styles.destInfoCard, destinationMode === 'PERSONAL' ? styles.destInfoPersonal : styles.destInfoCommunity]}>
          <Text style={styles.destInfoText}>
            {destinationMode === 'PERSONAL'
              ? '🔒 Este código se guardará exclusivamente para ti. Podrás usarlo en el checador y decidir más tarde si lo publicas.'
              : '🌐 Esta oferta será compartida en el Banco de Ofertas para que toda la comunidad la vea (+10 puntos de reputación).'}
          </Text>
        </View>

        {/* Banner de inicio de sesión obligatorio */}
        {!currentUserId && (
          <TouchableOpacity
            style={styles.guestWarningCard}
            onPress={onRequestLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.guestWarningIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestWarningTitle}>Inicio de Sesión Requerido</Text>
              <Text style={styles.guestWarningSubtitle}>
                Para registrar en tu banco o en la comunidad necesitas iniciar sesión con tu cuenta. Toca aquí para ingresar.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Notificación si ya existía en la base de datos */}
        {isExisting && initialData.latestPriceEntry && destinationMode === 'COMMUNITY' && (
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
        {!isExisting || destinationMode === 'PERSONAL' || isCreator ? (
          <View style={styles.field}>
            {isCreator && isExisting && (
              <View style={styles.creatorBanner}>
                <Text style={styles.creatorBannerText}>
                  👑 Creado por ti: Puedes corregir el nombre si te equivocaste originalmente.
                </Text>
              </View>
            )}
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
            <Text style={styles.existingProductProtect}>
              🔒 Nombre protegido por su creador ({initialData?.product?.createdBy?.username ? `@${initialData.product.createdBy.username}` : 'autor'})
            </Text>
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
          style={[styles.submitBtn, !currentUserId && styles.submitBtnLocked]}
          onPress={currentUserId ? handleSubmit : (onRequestLogin || handleSubmit)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {!currentUserId
                ? '🔒 Iniciar Sesión para Guardar'
                : destinationMode === 'PERSONAL'
                ? '🔒 Guardar en Mi Banco Personal'
                : isExisting
                ? '🌐 Publicar Nuevo Precio en Historial'
                : '🌐 Publicar Producto y Liquidación'}
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
  submitBtnLocked: {
    backgroundColor: '#334155',
    borderColor: '#475569',
    borderWidth: 1
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16
  },
  guestWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderWidth: 1,
    borderColor: '#eab308',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12
  },
  guestWarningIcon: {
    fontSize: 24
  },
  guestWarningTitle: {
    color: '#facc15',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2
  },
  guestWarningSubtitle: {
    color: '#fde047',
    fontSize: 12.5,
    lineHeight: 17
  },
  destinationTabs: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  destTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  destTabActive: {
    backgroundColor: '#0284c7'
  },
  destTabActivePersonal: {
    backgroundColor: '#059669'
  },
  destTabText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13
  },
  destTabTextActive: {
    color: '#ffffff'
  },
  destInfoCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1
  },
  destInfoCommunity: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderColor: 'rgba(2, 132, 199, 0.3)'
  },
  destInfoPersonal: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderColor: 'rgba(5, 150, 105, 0.3)'
  },
  destInfoText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17
  },
  creatorBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: '#eab308',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8
  },
  creatorBannerText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '600'
  },
  existingProductProtect: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4
  }
});

