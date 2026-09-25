import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { api } from '../services/api';

interface CommunityDealsScreenProps {
  onSelectProduct: (barcode: string) => void;
}

export const CommunityDealsScreen: React.FC<CommunityDealsScreenProps> = ({ onSelectProduct }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async (query = '') => {
    setLoading(true);
    try {
      const data = await api.searchCommunityDeals(query);
      setDeals(data);
    } catch (err) {
      console.error('Error al buscar ofertas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchDeals(searchQuery);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Banco de Códigos Comunitario</Text>
        <Text style={styles.subtitle}>
          Consulta liquidaciones avistadas por otros cazadores en todo el país.
        </Text>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar ej. PlayStation 5, Lego, Pañales..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Buscar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dealCard}
              onPress={() => onSelectProduct(item.barcode)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.barcodeText}>{item.barcode}</Text>
              </View>

              <View style={styles.dealContent}>
                <View>
                  <Text style={styles.priceLabel}>Último precio visto:</Text>
                  <Text style={styles.dealPrice}>${item.latestDeal.price.toFixed(2)}</Text>
                </View>

                {item.latestDeal.discountPercent && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      -{item.latestDeal.discountPercent}% OFF
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.storeRow}>
                <Text style={styles.storeText}>📍 {item.latestDeal.store}</Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.hunterText}>Cazado por: @{item.latestDeal.hunter}</Text>
                <Text style={styles.detailsLink}>Ver Historial →</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se encontraron liquidaciones con ese término.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    padding: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16
  },
  searchBar: {
    flexDirection: 'row',
    gap: 8
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155'
  },
  searchButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center'
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '700'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  listContainer: {
    padding: 16,
    gap: 12
  },
  dealCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardHeader: {
    marginBottom: 8
  },
  productName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  },
  barcodeText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  dealContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6
  },
  priceLabel: {
    color: '#94a3b8',
    fontSize: 11
  },
  dealPrice: {
    color: '#22c55e',
    fontSize: 22,
    fontWeight: '900'
  },
  discountBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  discountBadgeText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 12
  },
  storeRow: {
    marginTop: 6
  },
  storeText: {
    color: '#cbd5e1',
    fontSize: 13
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  hunterText: {
    color: '#64748b',
    fontSize: 11
  },
  detailsLink: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center'
  }
});
