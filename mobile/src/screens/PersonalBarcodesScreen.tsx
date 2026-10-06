import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  RefreshControl
} from 'react-native';
import { api } from '../services/api';
import { PersonalBarcodeItem } from '../types';
import { BarcodeModal } from '../components/BarcodeModal';

interface PersonalBarcodesScreenProps {
  currentUserId?: string;
  onRequestLogin: () => void;
  onOpenHistory?: (barcode: string) => void;
}

export const PersonalBarcodesScreen: React.FC<PersonalBarcodesScreenProps> = ({
  currentUserId,
  onRequestLogin,
  onOpenHistory
}) => {
  const [items, setItems] = useState<PersonalBarcodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para ver en checador (BarcodeModal)
  const [activeBarcode, setActiveBarcode] = useState<string | null>(null);
  const [activeProductName, setActiveProductName] = useState('');

  // Estados para modal de edición
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PersonalBarcodeItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOriginalPrice, setEditOriginalPrice] = useState('');
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreBranch, setEditStoreBranch] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados para modal de creación manual
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStoreName, setNewStoreName] = useState('Walmart');
  const [newStoreBranch, setNewStoreBranch] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!currentUserId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getPersonalBarcodes(currentUserId);
      setItems(data);
    } catch (err: any) {
      console.error('Error al cargar banco personal:', err);
      Alert.alert('Error', err.message || 'No se pudo cargar tu banco personal de códigos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const handleOpenEdit = (item: PersonalBarcodeItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(item.price ? String(item.price) : '');
    setEditOriginalPrice(item.originalPrice ? String(item.originalPrice) : '');
    setEditStoreName(item.storeName || '');
    setEditStoreBranch(item.storeBranch || '');
    setEditNotes(item.notes || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !currentUserId) return;
    if (!editName.trim()) {
      Alert.alert('Datos requeridos', 'Por favor ingresa el nombre del producto');
      return;
    }

    setSavingEdit(true);
    try {
      const priceNum = editPrice ? parseFloat(editPrice) : null;
      const origNum = editOriginalPrice ? parseFloat(editOriginalPrice) : null;

      await api.updatePersonalBarcode(editingItem.id, {
        userId: currentUserId,
        name: editName.trim(),
        price: priceNum,
        originalPrice: origNum,
        storeName: editStoreName.trim() || null,
        storeBranch: editStoreBranch.trim() || null,
        notes: editNotes.trim() || null
      });

      Alert.alert('Actualizado', 'Código personal actualizado correctamente');
      setEditModalVisible(false);
      fetchItems();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo actualizar el código');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (item: PersonalBarcodeItem) => {
    Alert.alert(
      'Eliminar de mi banco',
      `¿Deseas eliminar "${item.name}" de tus códigos personales?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            try {
              await api.deletePersonalBarcode(item.id, currentUserId);
              setItems(prev => prev.filter(i => i.id !== item.id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar el código');
            }
          }
        }
      ]
    );
  };

  const handlePublish = (item: PersonalBarcodeItem) => {
    const itemPrice = item.price ? Number(item.price) : 0;
    if (itemPrice <= 0) {
      Alert.alert(
        'Precio Requerido',
        'Para publicar una oferta a la comunidad necesitas asignar un precio. Edita el código primero para agregar el precio de la liquidación.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Editar Precio', onPress: () => handleOpenEdit(item) }
        ]
      );
      return;
    }

    Alert.alert(
      'Publicar en la Comunidad',
      `¿Deseas publicar "${item.name}" ($${itemPrice.toFixed(2)}) en el Banco de Ofertas general? Todos los cazadores podrán verlo y sumarás +10 puntos de reputación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '🚀 Publicar Ahora',
          onPress: async () => {
            if (!currentUserId) return;
            try {
              await api.publishPersonalBarcode(item.id, {
                userId: currentUserId,
                storeName: item.storeName || 'Walmart',
                storeBranch: item.storeBranch || 'Sucursal Principal'
              });
              Alert.alert('🎉 ¡Publicado!', 'La oferta ahora es visible para toda la comunidad (+10 pts).');
              fetchItems();
            } catch (err: any) {
              Alert.alert('Error al Publicar', err.message || 'No se pudo publicar');
            }
          }
        }
      ]
    );
  };

  const handleSaveNew = async () => {
    if (!currentUserId) return;
    if (!newBarcode.trim() || newBarcode.trim().length < 4) {
      Alert.alert('Código inválido', 'Ingresa un código de barras de al menos 4 dígitos');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresa el nombre del producto');
      return;
    }

    setSavingNew(true);
    try {
      const priceNum = newPrice ? parseFloat(newPrice) : undefined;
      await api.savePersonalBarcode({
        userId: currentUserId,
        barcode: newBarcode.trim(),
        name: newName.trim(),
        price: priceNum,
        storeName: newStoreName.trim() || undefined,
        storeBranch: newStoreBranch.trim() || undefined,
        notes: newNotes.trim() || undefined
      });

      Alert.alert('Guardado', 'Código agregado a tu banco personal');
      setCreateModalVisible(false);
      setNewBarcode('');
      setNewName('');
      setNewPrice('');
      setNewStoreBranch('');
      setNewNotes('');
      fetchItems();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el código');
    } finally {
      setSavingNew(false);
    }
  };

  // Filtrado local por término de búsqueda
  const filteredItems = items.filter(i => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      i.name.toLowerCase().includes(q) ||
      i.barcode.toLowerCase().includes(q) ||
      (i.storeName && i.storeName.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>🗂️ Mi Banco de Códigos</Text>
            <Text style={styles.subtitle}>
              Tus códigos guardados para ti. Úsalos en el checador o publícalos cuando decidas.
            </Text>
          </View>
          {currentUserId && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setCreateModalVisible(true)}
            >
              <Text style={styles.addBtnText}>+ Agregar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Buscador */}
        {currentUserId && (
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar en mis códigos por nombre o dígito..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Si no ha iniciado sesión */}
      {!currentUserId ? (
        <View style={styles.loginCardContainer}>
          <Text style={styles.loginCardIcon}>🔒</Text>
          <Text style={styles.loginCardTitle}>Tu Banco Personal está Protegido</Text>
          <Text style={styles.loginCardSub}>
            Inicia sesión para guardar códigos de barras privados, llevar tu propia lista de productos para el checador y decidir cuáles compartir con la comunidad.
          </Text>
          <TouchableOpacity style={styles.loginActionBtn} onPress={onRequestLogin}>
            <Text style={styles.loginActionBtnText}>👤 Iniciar Sesión / Crear Cuenta</Text>
          </TouchableOpacity>
        </View>
      ) : loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Cargando tu banco de códigos...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#38bdf8"
            />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>Aún no tienes códigos guardados</Text>
              <Text style={styles.emptySub}>
                Al escanear un producto con la cámara, puedes elegir "Guardar en Mi Banco" para guardarlo en privado para ti, o agregarlo con el botón "+ Agregar".
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setCreateModalVisible(true)}
              >
                <Text style={styles.emptyAddBtnText}>+ Agregar Mi Primer Código</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Header de la tarjeta */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.barcodeText}>📟 {item.barcode}</Text>
                </View>

                {/* Badge de estado: Privado vs Publicado */}
                <View style={[styles.statusBadge, item.isPublished ? styles.badgePublic : styles.badgePrivate]}>
                  <Text style={styles.statusBadgeText}>
                    {item.isPublished ? '🌐 Publicado' : '🔒 Privado'}
                  </Text>
                </View>
              </View>

              {/* Detalles de precio y tienda */}
              <View style={styles.cardDetailsRow}>
                {item.price ? (
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>Precio Guardado</Text>
                    <Text style={styles.detailPrice}>${Number(item.price).toFixed(2)}</Text>
                  </View>
                ) : (
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>Precio</Text>
                    <Text style={styles.detailPriceNone}>Sin precio registrado</Text>
                  </View>
                )}

                {item.storeName && (
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>Tienda</Text>
                    <Text style={styles.detailStore} numberOfLines={1}>
                      {item.storeName} {item.storeBranch ? `(${item.storeBranch})` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {item.notes && (
                <Text style={styles.notesText} numberOfLines={2}>
                  💬 {item.notes}
                </Text>
              )}

              {/* Botones de acción */}
              <View style={styles.actionsRow}>
                {/* 1. Ver en checador físico (BarcodeModal) */}
                <TouchableOpacity
                  style={styles.checadorBtn}
                  onPress={() => {
                    setActiveBarcode(item.barcode);
                    setActiveProductName(item.name);
                  }}
                >
                  <Text style={styles.checadorBtnText}>📱 Ver en Checador</Text>
                </TouchableOpacity>

                {/* 2. Publicar a la comunidad si aún no lo está */}
                {!item.isPublished && (
                  <TouchableOpacity
                    style={styles.publishBtn}
                    onPress={() => handlePublish(item)}
                  >
                    <Text style={styles.publishBtnText}>🌐 Publicar</Text>
                  </TouchableOpacity>
                )}

                {/* Si ya está publicado, opción de ver historial */}
                {item.isPublished && onOpenHistory && (
                  <TouchableOpacity
                    style={styles.historyBtn}
                    onPress={() => onOpenHistory(item.barcode)}
                  >
                    <Text style={styles.historyBtnText}>📈 Historial</Text>
                  </TouchableOpacity>
                )}

                {/* 3. Editar datos */}
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleOpenEdit(item)}
                >
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>

                {/* 4. Eliminar */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal para ver en checador físico */}
      {activeBarcode && (
        <BarcodeModal
          visible={Boolean(activeBarcode)}
          onClose={() => setActiveBarcode(null)}
          barcode={activeBarcode}
          productName={activeProductName}
          showSaveActions={false}
          readOnly={true}
        />
      )}

      {/* Modal de Edición de Código Personal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ Editar Código Personal</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSub}>
                Modifica el nombre o precio que guardaste para ti mismo:
              </Text>

              <Text style={styles.inputLabel}>Nombre del Producto *</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ej. Detergente Ariel 5kg"
                placeholderTextColor="#64748b"
              />

              <View style={styles.modalRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Precio Visto ($)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editPrice}
                    onChangeText={setEditPrice}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Precio Original ($)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editOriginalPrice}
                    onChangeText={setEditOriginalPrice}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Tienda</Text>
              <TextInput
                style={styles.modalInput}
                value={editStoreName}
                onChangeText={setEditStoreName}
                placeholder="Ej. Walmart, Soriana, Aurrera"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Sucursal</Text>
              <TextInput
                style={styles.modalInput}
                value={editStoreBranch}
                onChangeText={setEditStoreBranch}
                placeholder="Ej. Sucursal Universidad"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Notas personales</Text>
              <TextInput
                style={[styles.modalInput, { height: 70 }]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Pasillo de ofertas, últimas 2 piezas..."
                placeholderTextColor="#64748b"
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Guardar Cambios</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Agregar Nuevo Código Manualmente a Mi Banco */}
      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>➕ Nuevo Código en Mi Banco</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSub}>
                Guarda un código de barras en tu colección personal privada:
              </Text>

              <Text style={styles.inputLabel}>Dígitos del Código de Barras *</Text>
              <TextInput
                style={styles.modalInput}
                value={newBarcode}
                onChangeText={setNewBarcode}
                placeholder="Ej. 009800125111"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Nombre del Producto *</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Ej. Nutella 350g, Galletas Oreo..."
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Precio ($) opcional</Text>
              <TextInput
                style={styles.modalInput}
                value={newPrice}
                onChangeText={setNewPrice}
                placeholder="Ej. 25.00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
              />

              <View style={styles.modalRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Tienda</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newStoreName}
                    onChangeText={setNewStoreName}
                    placeholder="Ej. Walmart"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Sucursal</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newStoreBranch}
                    onChangeText={setNewStoreBranch}
                    placeholder="Ej. Miramontes"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Notas personales (opcional)</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Notas de ubicación o recordatorio..."
                placeholderTextColor="#64748b"
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveNew}
                  disabled={savingNew}
                >
                  {savingNew ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Guardar en Mi Banco</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc'
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    maxWidth: 240
  },
  addBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: '#f8fafc',
    fontSize: 14
  },
  clearSearchBtn: {
    padding: 4
  },
  clearSearchText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold'
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4
  },
  barcodeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#38bdf8'
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  badgePrivate: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  badgePublic: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981'
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f8fafc'
  },
  cardDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8
  },
  detailBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 8
  },
  detailLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase'
  },
  detailPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#34d399',
    marginTop: 2
  },
  detailPriceNone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontStyle: 'italic'
  },
  detailStore: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
    marginTop: 2
  },
  notesText: {
    fontSize: 12,
    color: '#cbd5e1',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    padding: 6,
    borderRadius: 6,
    marginBottom: 10
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4
  },
  checadorBtn: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  checadorBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  publishBtn: {
    flex: 1.5,
    backgroundColor: '#059669',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  publishBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  historyBtn: {
    flex: 1.5,
    backgroundColor: '#475569',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  historyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  editBtn: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  editBtnText: {
    fontSize: 14
  },
  deleteBtn: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  deleteBtnText: {
    fontSize: 14
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  emptyAddBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10
  },
  emptyAddBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  },
  loginCardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loginCardIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  loginCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8
  },
  loginCardSub: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24
  },
  loginActionBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12
  },
  loginActionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc'
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#94a3b8',
    padding: 4
  },
  modalSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 8
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14
  },
  modalRow: {
    flexDirection: 'row',
    marginTop: 4
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  modalCancelBtnText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 14
  },
  modalSaveBtn: {
    flex: 1.5,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  modalSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  }
});
