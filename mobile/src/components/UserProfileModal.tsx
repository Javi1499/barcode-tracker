import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image
} from 'react-native';
import { UserProfile } from '../services/authService';
import { api } from '../services/api';

interface UserProfileModalProps {
  visible: boolean;
  user: UserProfile;
  onClose: () => void;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  user,
  onClose,
  onLogout,
  onSwitchAccount
}) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user?.id) {
      loadProfile();
    }
  }, [visible, user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.getUserProfile(user.id);
      setProfileData(res);
    } catch {
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  };

  const providerLabel: Record<string, string> = {
    email: 'Correo y Contraseña',
    google: 'Google',
    facebook: 'Facebook',
    apple: 'Apple'
  };
  const currentProviderText = providerLabel[user.authProvider] || 'Correo';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Perfil de Cazador</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Tarjeta de Identidad */}
            <View style={styles.userCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {user.name ? user.name[0].toUpperCase() : 'C'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user.name || user.username}</Text>
                <Text style={styles.userHandle}>@{user.username}</Text>
                <View style={styles.providerTag}>
                  <Text style={styles.providerTagText}>
                    🔗 Conectado con {currentProviderText}
                  </Text>
                </View>
              </View>
            </View>

            {/* Métricas de Reputación */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>⭐ {user.reputation}</Text>
                <Text style={styles.statLabel}>Reputación</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {profileData?.stats?.totalDealsReported ?? 0}
                </Text>
                <Text style={styles.statLabel}>Ofertas Cazadas</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {profileData?.stats?.totalCommunityVotes ?? 0}
                </Text>
                <Text style={styles.statLabel}>Votos Recibidos</Text>
              </View>
            </View>

            {/* Rango de Cazador */}
            <View style={styles.rankBanner}>
              <Text style={styles.rankIcon}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rankTitle}>
                  {profileData?.rank || 'Cazador de Liquidaciones'}
                </Text>
                <Text style={styles.rankSub}>
                  Gana 10 puntos de reputación por cada precio de oferta física que reportes en tienda.
                </Text>
              </View>
            </View>

            {/* Botones de Acción */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => {
                  onClose();
                  onSwitchAccount();
                }}
              >
                <Text style={styles.switchBtnText}>🔄 Cambiar de Cuenta</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                <Text style={styles.logoutBtnText}>🚪 Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '85%'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeBtnText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: 'bold'
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900'
  },
  userName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800'
  },
  userHandle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 1
  },
  providerTag: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  providerTagText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700'
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
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
  statValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800'
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 10.5,
    marginTop: 4,
    textAlign: 'center'
  },
  rankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20
  },
  rankIcon: {
    fontSize: 24,
    marginRight: 12
  },
  rankTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '800'
  },
  rankSub: {
    color: '#cbd5e1',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16
  },
  actionButtons: {
    gap: 10
  },
  switchBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  switchBtnText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700'
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700'
  }
});
