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
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    setLoading(true);
    setSelectedProvider(provider);

    try {
      const user = await AuthService.loginWithSocial(provider);
      Alert.alert(
        '¡Bienvenido Cazador!',
        `Has iniciado sesión como @${user.username} mediante ${provider.toUpperCase()}. Tienes ${user.reputation} puntos de reputación iniciales.`
      );
      resetForm();
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

  const handleEmailAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert('Correo Requerido', 'Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (!password) {
      Alert.alert('Contraseña Requerida', 'Por favor ingresa tu contraseña.');
      return;
    }

    if (authMode === 'REGISTER') {
      if (password.length < 8) {
        Alert.alert(
          'Contraseña Débil',
          'Por motivos de seguridad, la contraseña debe tener al menos 8 caracteres.'
        );
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert(
          'Contraseñas no coinciden',
          'La confirmación de la contraseña no coincide. Por favor revísala.'
        );
        return;
      }
    }

    setLoading(true);
    setSelectedProvider(null);

    try {
      let user: UserProfile;
      if (authMode === 'REGISTER') {
        user = await AuthService.registerWithEmail(cleanEmail, password, name);
        Alert.alert(
          '¡Cuenta Creada!',
          `Bienvenido @${user.username}. Tu cuenta ha sido protegida con tu contraseña y tienes ${user.reputation} puntos de reputación iniciales.`
        );
      } else {
        user = await AuthService.loginWithEmail(cleanEmail, password);
        Alert.alert(
          '¡Bienvenido Cazador!',
          `Has iniciado sesión como @${user.username}.`
        );
      }

      resetForm();
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Error en autenticación con correo:', err);
      Alert.alert(
        authMode === 'REGISTER' ? 'Error al Registrar Cuenta' : 'Error al Iniciar Sesión',
        err.message || 'No se pudo conectar con el servidor.'
      );
    } finally {
      setLoading(false);
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
            <Text style={styles.title}>
              {authMode === 'LOGIN' ? 'Inicia Sesión' : 'Crea tu Cuenta'}
            </Text>
            <Text style={styles.subtitle}>
              {authMode === 'LOGIN'
                ? 'Accede con tu cuenta segura para registrar liquidaciones y consultar precios comunitarios.'
                : 'Regístrate con tu correo y una contraseña segura para unirte a la red de cazadores de ofertas.'}
            </Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>
                  {selectedProvider
                    ? `Conectando con ${selectedProvider.toUpperCase()}...`
                    : authMode === 'REGISTER'
                    ? 'Creando y asegurando tu cuenta...'
                    : 'Verificando credenciales...'}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonsContainer}>
                {/* Selector de Pestañas: Iniciar Sesión vs Registrarse */}
                <View style={styles.tabSelector}>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      authMode === 'LOGIN' && styles.tabBtnActive
                    ]}
                    onPress={() => setAuthMode('LOGIN')}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        authMode === 'LOGIN' && styles.tabBtnTextActive
                      ]}
                    >
                      Iniciar Sesión
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      authMode === 'REGISTER' && styles.tabBtnActive
                    ]}
                    onPress={() => setAuthMode('REGISTER')}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        authMode === 'REGISTER' && styles.tabBtnTextActive
                      ]}
                    >
                      Crear Cuenta
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Formulario con Correo y Contraseña */}
                <View style={styles.customInputsCard}>
                  {authMode === 'REGISTER' && (
                    <>
                      <Text style={styles.customLabel}>Nombre o Alias (Opcional):</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej. Javier Cazador"
                        placeholderTextColor="#64748b"
                        value={name}
                        onChangeText={setName}
                      />
                    </>
                  )}

                  <Text style={styles.customLabel}>Correo Electrónico *:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />

                  <Text style={styles.customLabel}>Contraseña *:</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder={
                        authMode === 'REGISTER'
                          ? 'Mínimo 8 caracteres'
                          : 'Ingresa tu contraseña'
                      }
                      placeholderTextColor="#64748b"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(prev => !prev)}
                    >
                      <Text style={styles.eyeBtnText}>
                        {showPassword ? '🙈' : '👁️'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {authMode === 'REGISTER' && (
                    <Text style={styles.passwordHint}>
                      🔒 Mínimo 8 caracteres para asegurar tu cuenta contra accesos no autorizados.
                    </Text>
                  )}

                  {authMode === 'REGISTER' && (
                    <>
                      <Text style={styles.customLabel}>Confirmar Contraseña *:</Text>
                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          style={styles.passwordInput}
                          placeholder="Repite tu contraseña"
                          placeholderTextColor="#64748b"
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                        />
                      </View>
                    </>
                  )}

                  <TouchableOpacity
                    style={styles.emailSubmitBtn}
                    onPress={handleEmailAuth}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emailSubmitBtnText}>
                      {authMode === 'LOGIN'
                        ? '⚡ Iniciar Sesión'
                        : '✨ Crear Cuenta de Cazador'}
                    </Text>
                  </TouchableOpacity>

                  {/* Toggle entre Iniciar Sesión y Registrarse */}
                  <TouchableOpacity
                    style={styles.switchModeBtn}
                    onPress={() => {
                      setAuthMode(prev => (prev === 'LOGIN' ? 'REGISTER' : 'LOGIN'));
                    }}
                  >
                    <Text style={styles.switchModeText}>
                      {authMode === 'LOGIN'
                        ? '¿No tienes cuenta? Regístrate aquí'
                        : '¿Ya tienes una cuenta? Inicia sesión aquí'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Divisor */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>O INGRESA CON REDES SOCIALES</Text>
                  <View style={styles.dividerLine} />
                </View>

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

                {/* Continuar como invitado */}
                <TouchableOpacity style={styles.guestBtn} onPress={onClose}>
                  <Text style={styles.guestBtnText}>Continuar explorando como invitado</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.privacyNote}>
              <Text style={styles.privacyNoteText}>
                Tus credenciales están encriptadas con algoritmos seguros. Nadie más puede acceder a tu cuenta ni atribuirse tus liquidaciones.
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
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155'
  },
  dividerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  emailSubmitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  emailSubmitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14
  },
  // Pestañas Iniciar Sesión / Crear Cuenta
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  tabBtnActive: {
    backgroundColor: '#0284c7'
  },
  tabBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600'
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  // Campo de Contraseña
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569'
  },
  passwordInput: {
    flex: 1,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  eyeBtnText: {
    fontSize: 16
  },
  passwordHint: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 5,
    lineHeight: 15
  },
  switchModeBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6
  },
  switchModeText: {
    color: '#38bdf8',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center'
  }
});
