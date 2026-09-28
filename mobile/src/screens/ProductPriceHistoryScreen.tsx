import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { api } from '../services/api';
import { ProductPriceHistoryResponse } from '../types';
import { BarcodeModal } from '../components/BarcodeModal';

interface ProductPriceHistoryScreenProps {
  barcode: string;
  onAddNewPrice: () => void;
  onBack: () => void;
}

export const ProductPriceHistoryScreen: React.FC<ProductPriceHistoryScreenProps> = ({
  barcode,
  onAddNewPrice,
  onBack
}) => {
  const [data, setData] = useState<ProductPriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [barcode]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await api.getPriceHistory(barcode);
      setData(res);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Cargando bitácora de liquidaciones...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No se encontraron datos históricos para este código.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { product, stats, history } = data;
  const initialPrice = history.length > 0 ? history[history.length - 1].price : 0;
  const currentPrice = stats.currentPrice ?? 0;
  const totalDrop = initialPrice > currentPrice ? initialPrice - currentPrice : 0;
  const dropPercentage = initialPrice > 0 ? Math.round((totalDrop / initialPrice) * 100) : 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header Producto */}
      <View style={styles.headerCard}>
        <TouchableOpacity onPress={onBack} style={styles.navBack}>
          <Text style={styles.navBackText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.barcodeText}>Código: {product.barcode}</Text>

        {/* Banner de alerta si acumula 5 o más reportes de que no funciona */}
        {(product.isReportedBroken || (product.brokenReportsCount !== undefined && product.brokenReportsCount >= 5)) && (
          <View style={styles.brokenWarningCard}>
            <Text style={styles.brokenWarningIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.brokenWarningTitle}>Aviso de Fiabilidad del Código</Text>
              <Text style={styles.brokenWarningText}>
                Este código puede que ya no esté funcionando o fue reportado con error.
              </Text>
              <Text style={styles.brokenWarningSub}>
                Acumula {product.brokenReportsCount} reportes de que no pasa en el checador de la tienda.
              </Text>
            </View>
          </View>
        )}

        {/* Banner de decisión de compra */}
        <View style={[styles.decisionBadge, stats.isAtAllTimeLow ? styles.badgeGreen : styles.badgeYellow]}>
          <Text style={styles.decisionIcon}>{stats.isAtAllTimeLow ? '🔥' : '⏳'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.decisionTitle}>
              {stats.isAtAllTimeLow ? '¡PRECIO MÍNIMO HISTÓRICO!' : 'Precio en observación'}
            </Text>
            <Text style={styles.decisionSub}>
              {stats.isAtAllTimeLow
                ? 'Este producto nunca antes se había registrado tan barato. Momento ideal para comprar.'
                : 'Ha bajado de precio, pero podría seguir descendiendo de liquidación.'}
            </Text>
          </View>
        </View>

        {/* Tarjetas de Métricas de Liquidación */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Precio Actual</Text>
            <Text style={styles.statCurrentPrice}>${currentPrice.toFixed(2)}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Mínimo Histórico</Text>
            <Text style={styles.statLowPrice}>${stats.lowestPrice?.toFixed(2)}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Ahorro Total</Text>
            <Text style={styles.statDropText}>-{dropPercentage}%</Text>
          </View>
        </View>

        {/* Botón para Generar y Mostrar el Código de Barras en Pantalla */}
        <TouchableOpacity
          style={styles.generateBarcodeBtn}
          onPress={() => setBarcodeModalVisible(true)}
        >
          <Text style={styles.generateBarcodeBtnIcon}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.generateBarcodeBtnTitle}>Generar BarCode para Tienda</Text>
            <Text style={styles.generateBarcodeBtnSub}>
              Formatos Walmart, Sam's Club, Aurrera (EAN-13, Code 128, etc.)
            </Text>
          </View>
          <Text style={styles.generateBarcodeBtnArrow}>➔</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addPriceBtn} onPress={onAddNewPrice}>
          <Text style={styles.addPriceBtnText}>+ Reportar Nuevo Precio Aquí</Text>
        </TouchableOpacity>
      </View>

      {/* Línea de Tiempo Histórica de Bajada de Precios */}
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>Evolución Histórica de Precios</Text>
        <Text style={styles.sectionSubtitle}>
          Registros colaborativos de cazadores ordenados cronológicamente:
        </Text>

        {history.map((entry, index) => {
          const isLatest = index === 0;
          const dateStr = new Date(entry.createdAt).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });

          return (
            <View key={entry.id} style={styles.timelineItem}>
              {/* Indicador visual de línea vertical */}
              <View style={styles.timelineIndicator}>
                <View style={[styles.dot, isLatest ? styles.activeDot : styles.pastDot]} />
                {index < history.length - 1 && <View style={styles.verticalLine} />}
              </View>

              {/* Contenido del registro */}
              <View style={[styles.timelineCard, isLatest && styles.timelineCardHighlight]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.entryStore}>{entry.store}</Text>
                  <Text style={styles.entryDate}>{dateStr}</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.entryPrice}>${entry.price.toFixed(2)}</Text>
                  {entry.discountPercent && entry.discountPercent > 0 && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>-{entry.discountPercent}%</Text>
                    </View>
                  )}
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{entry.priceType.replace('_', ' ')}</Text>
                  </View>
                </View>

                {entry.notes && (
                  <Text style={styles.entryNotes}>💬 "{entry.notes}"</Text>
                )}

                <View style={styles.entryFooter}>
                  <Text style={styles.entryHunter}>Cazado por: @{entry.user}</Text>
                  {entry.votesCount !== undefined && (
                    <Text style={styles.entryVotes}>👍 {entry.votesCount} verificaciones</Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Modal para Generar Código de Barras Físico en Pantalla (Protegido / Read Only) */}
      <BarcodeModal
        visible={barcodeModalVisible}
        onClose={() => setBarcodeModalVisible(false)}
        barcode={product.barcode}
        productName={product.name}
        readOnly={true}
        brokenReportsCount={product.brokenReportsCount}
        workingVotesCount={product.workingVotesCount}
        isReportedBroken={product.isReportedBroken}
        onFeedbackSubmitted={(_type, newCounts) => {
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              product: {
                ...prev.product,
                workingVotesCount: newCounts.working,
                brokenReportsCount: newCounts.broken,
                isReportedBroken: newCounts.broken >= 5
              }
            };
          });
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20
  },
  loadingText: {
    color: '#cbd5e1',
    marginTop: 12,
    fontSize: 15
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  },
  navBack: {
    marginBottom: 12
  },
  navBackText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '700'
  },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  backBtnText: {
    color: '#38bdf8',
    fontWeight: '600'
  },
  headerCard: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  productName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4
  },
  barcodeText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16
  },
  brokenWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451a03',
    borderWidth: 1.5,
    borderColor: '#d97706',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12
  },
  brokenWarningIcon: {
    fontSize: 24
  },
  brokenWarningTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2
  },
  brokenWarningText: {
    color: '#fef3c7',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17
  },
  brokenWarningSub: {
    color: '#fde68a',
    fontSize: 11,
    marginTop: 3
  },
  decisionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16
  },
  badgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e'
  },
  badgeYellow: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: '#eab308'
  },
  decisionIcon: {
    fontSize: 28,
    marginRight: 12
  },
  decisionTitle: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14
  },
  decisionSub: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4
  },
  statCurrentPrice: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '800'
  },
  statLowPrice: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '800'
  },
  statDropText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '800'
  },
  generateBarcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12
  },
  generateBarcodeBtnIcon: {
    fontSize: 24,
    marginRight: 10
  },
  generateBarcodeBtnTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  generateBarcodeBtnSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2
  },
  generateBarcodeBtnArrow: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8
  },
  addPriceBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  addPriceBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15
  },
  timelineSection: {
    padding: 20
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800'
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16
  },
  timelineIndicator: {
    alignItems: 'center',
    width: 28,
    marginRight: 10
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 6
  },
  activeDot: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOpacity: 0.8,
    shadowRadius: 4
  },
  pastDot: {
    backgroundColor: '#64748b'
  },
  verticalLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#334155',
    marginVertical: 4
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  timelineCardHighlight: {
    borderColor: '#38bdf8'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  entryStore: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    flex: 1
  },
  entryDate: {
    color: '#94a3b8',
    fontSize: 12
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  entryPrice: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900'
  },
  discountBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  discountBadgeText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 12
  },
  typeBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  typeBadgeText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600'
  },
  entryNotes: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
    marginTop: 4
  },
  entryHunter: {
    color: '#64748b',
    fontSize: 11
  },
  entryVotes: {
    color: '#64748b',
    fontSize: 11
  }
});
