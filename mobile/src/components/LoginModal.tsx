import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { AuthService, UserProfile } from '../services/authService';

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  visible,
  onClose,
  onLoginSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'facebook' | 'apple' | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    setLoading(true);
    setSelectedProvider(provider);

    try {
      let userData: { name?: string; email?: string } | undefined;

      if (customMode && customEmail.trim()) {
        userData = {
          name: customName.trim() || undefined,
          email: customEmail.trim()
        };
      }

      const user = await AuthService.loginWithSocial(provider, userData);
      Alert.alert(
        '¡Bienvenido Cazador!',
        `Has iniciado sesión como @${user.username} mediante ${provider.toUpperCase()}. Tienes ${user.reputation} puntos de reputación iniciales.`
      );
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      if (err.message !== 'Inicio de sesión cancelado.') {
        console.error('Error al iniciar sesión:', err);
        Alert.alert('Autenticación', err.message || 'No se pudo conectar con el proveedor.');
      }
    } finally {
      setLoading(false);
      setSelectedProvider(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>🏷️⚡</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Únete a la Comunidad</Text>
            <Text style={styles.subtitle}>
              Inicia sesión para registrar ofertas, ganar reputación y guardar tu historial de precios en tiendas físicas.
            </Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>
                  Conectando con {selectedProvider?.toUpperCase()}...
                </Text>
              </View>
            ) : (
              <View style={styles.buttonsContainer}>
                {/* 1. Botón Google */}
                <TouchableOpacity
                  style={[styles.socialBtn, styles.googleBtn]}
                  onPress={() => handleSocialLogin('google')}
                  activeOpacity={0.85}
                >
                  <View style={styles.iconCircle}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Continuar con Google</Text>
                </TouchableOpacity>

                {/* 2. Botón Apple */}
                <TouchableOpacity
                  style={[styles.socialBtn, styles.appleBtn]}
                  onPress={() => handleSocialLogin('apple')}
                  activeOpacity={0.85}
                >
                  <View style={styles.iconCircleApple}>
                    <Text style={styles.appleIcon}></Text>
                  </View>
                  <Text style={styles.appleBtnText}>Continuar con Apple</Text>
                </TouchableOpacity>

                {/* 3. Botón Facebook */}
                <TouchableOpacity
                  style={[styles.socialBtn, styles.facebookBtn]}
                  onPress={() => handleSocialLogin('facebook')}
                  activeOpacity={0.85}
                >
                  <View style={styles.iconCircleFb}>
                    <Text style={styles.facebookIcon}>f</Text>
                  </View>
                  <Text style={styles.facebookBtnText}>Continuar con Facebook</Text>
                </TouchableOpacity>

                {/* Opción de personalizar email / nombre */}
                <TouchableOpacity
                  style={styles.customToggle}
                  onPress={() => setCustomMode(prev => !prev)}
                >
                  <Text style={styles.customToggleText}>
                    {customMode ? '▼ Usar inicio de sesión rápido en 1-tap' : '▶ Personalizar nombre y correo para la cuenta'}
                  </Text>
                </TouchableOpacity>

                {customMode && (
                  <View style={styles.customInputsCard}>
                    <Text style={styles.customLabel}>Tu Nombre (Opcional):</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. Javier Cazador"
                      placeholderTextColor="#64748b"
                      value={customName}
                      onChangeText={setCustomName}
                    />

                    <Text style={styles.customLabel}>Tu Correo Electrónico:</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ejemplo@correo.com"
                      placeholderTextColor="#64748b"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={customEmail}
                      onChangeText={setCustomEmail}
                    />
                    <Text style={styles.customHint}>
                      Al pulsar cualquiera de los botones de arriba, tu cuenta se creará o vinculará con estos datos.
                    </Text>
                  </View>
                )}

                {/* Continuar como invitado */}
                <TouchableOpacity style={styles.guestBtn} onPress={onClose}>
                  <Text style={styles.guestBtnText}>Continuar explorando como invitado</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.privacyNote}>
              <Text style={styles.privacyNoteText}>
                Tus datos se utilizan únicamente para atribuir los precios que reportas a tu perfil y otorgarte puntos de reputación en la comunidad.
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '90%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  logoBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  logoBadgeText: {
    fontSize: 20
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
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 20
  },
  buttonsContainer: {
    gap: 12
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3
  },
  // Google
  googleBtn: {
    backgroundColor: '#ffffff'
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  googleIcon: {
    color: '#ea4335',
    fontSize: 18,
    fontWeight: '900'
  },
  googleBtnText: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '700'
  },
  // Apple
  appleBtn: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#334155'
  },
  iconCircleApple: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  appleIcon: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold'
  },
  appleBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  // Facebook
  facebookBtn: {
    backgroundColor: '#1877f2'
  },
  iconCircleFb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  facebookIcon: {
    color: '#1877f2',
    fontSize: 20,
    fontWeight: '900'
  },
  facebookBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  // Modo Personalizado
  customToggle: {
    paddingVertical: 8,
    marginTop: 4
  },
  customToggleText: {
    color: '#38bdf8',
    fontSize: 12.5,
    fontWeight: '600'
  },
  customInputsCard: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6
  },
  customLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 6
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#475569'
  },
  customHint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15
  },
  // Invitado
  guestBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4
  },
  guestBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center'
  },
  loadingText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12
  },
  privacyNote: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  privacyNoteText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16
  }
});
