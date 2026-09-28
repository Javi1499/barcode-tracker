import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { api } from './api';

// Completar sesión de navegador si la app regresa de un redirect de OAuth
WebBrowser.maybeCompleteAuthSession();

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl?: string;
  reputation: number;
  authProvider: 'email' | 'google' | 'facebook' | 'apple';
  createdAt?: string;
}

const STORAGE_KEY = '@barcode_tracker_user';

/**
 * Decodificador seguro de JWT payload para extraer email/nombre sin dependencias externas
 */
function decodeJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    for (
      let bc = 0, bs = 0, buffer: any, idx = 0;
      (buffer = base64.charAt(idx++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (str += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Extrae parámetros tanto del hash fragment (#) como del query string (?)
 */
function extractParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hashPart = url.includes('#') ? url.split('#')[1] : '';
  const combined = [queryPart, hashPart].filter(Boolean).join('&');

  if (!combined) return params;

  combined.split('&').forEach(item => {
    const [key, value] = item.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  });

  return params;
}

export const AuthService = {
  /**
   * Obtiene el usuario guardado localmente en el dispositivo
   */
  async getStoredUser(): Promise<UserProfile | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error al leer usuario de almacenamiento:', e);
    }
    return null;
  },

  /**
   * Cierra la sesión activa en el dispositivo
   */
  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
  },

  /**
   * Registro seguro de cuenta nueva con correo electrónico y contraseña
   */
  async registerWithEmail(email: string, password: string, name?: string): Promise<UserProfile> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Por favor ingresa un correo electrónico válido.');
    }
    if (!password || password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres para ser segura.');
    }

    const user = await api.registerWithEmail({
      email: cleanEmail,
      password,
      name: name?.trim()
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  /**
   * Inicio de sesión seguro con correo electrónico y contraseña
   */
  async loginWithEmail(email: string, password: string): Promise<UserProfile> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Por favor ingresa un correo electrónico válido.');
    }
    if (!password) {
      throw new Error('Por favor ingresa tu contraseña.');
    }

    const user = await api.loginWithEmail({
      email: cleanEmail,
      password
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  /**
   * Inicia sesión o registra al usuario con Google, Facebook o Apple
   * usando flujos reales de OAuth 2.0 mediante WebBrowser y AuthSession
   */
  async loginWithSocial(
    provider: 'google' | 'facebook' | 'apple'
  ): Promise<UserProfile> {

    const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    const appleClientId = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;

    // Si aún no se han configurado los Client IDs en eas.json
    if (provider === 'google' && !googleClientId) {
      throw new Error(
        'Falta configurar EXPO_PUBLIC_GOOGLE_CLIENT_ID en eas.json con tu ID de Google Cloud Console. Puedes usar la opción de abajo "Entrar con Correo" para ingresar de inmediato.'
      );
    }

    if (provider === 'facebook' && !facebookAppId) {
      throw new Error(
        'Falta configurar EXPO_PUBLIC_FACEBOOK_APP_ID en eas.json con tu App ID de Meta for Developers. Puedes usar la opción de abajo "Entrar con Correo" para ingresar de inmediato.'
      );
    }

    if (provider === 'apple' && !appleClientId) {
      throw new Error(
        'Falta configurar EXPO_PUBLIC_APPLE_CLIENT_ID en eas.json con tu Services ID de Apple Developer. Puedes usar la opción de abajo "Entrar con Correo" para ingresar de inmediato.'
      );
    }

    // 1. Configurar URI de retorno de OAuth compatible con las políticas de Google y Meta
    // Google prohíbe esquemas personalizados (barcodetracker://) en Web Client IDs y exige HTTPS.
    // Usamos el proxy oficial de Expo para redirección segura.
    const googleRedirectUri =
      process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ||
      'https://auth.expo.io/@javi_1499/barcode-tracker';

    const redirectUri =
      provider === 'google'
        ? googleRedirectUri
        : AuthSession.makeRedirectUri({ scheme: 'barcodetracker' });

    let authUrl = '';

    if (provider === 'google') {
      const nonce = Math.random().toString(36).substring(2);
      authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(googleClientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token%20id_token&` +
        `scope=${encodeURIComponent('openid email profile')}&` +
        `nonce=${encodeURIComponent(nonce)}&` +
        `prompt=select_account`;
    } else if (provider === 'facebook') {
      authUrl =
        `https://www.facebook.com/v12.0/dialog/oauth?` +
        `client_id=${encodeURIComponent(facebookAppId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent('email,public_profile')}`;
    } else if (provider === 'apple') {
      authUrl =
        `https://appleid.apple.com/auth/authorize?` +
        `client_id=${encodeURIComponent(appleClientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code%20id_token&` +
        `scope=name%20email&` +
        `response_mode=fragment`;
    }

    // 2. Abrir la ventana real de autenticación de terceros en el navegador seguro
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('Inicio de sesión cancelado.');
    }

    let fetchedEmail: string | undefined;
    let fetchedName: string | undefined;
    let fetchedAvatar: string | undefined;
    let fetchedProviderId: string | undefined;

    if (result.type === 'success' && result.url) {
      const params = extractParams(result.url);
      const accessToken = params['access_token'];
      const idToken = params['id_token'];

      // Consulta de perfil según el proveedor con el token recibido
      if (provider === 'google' && accessToken) {
        try {
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            fetchedEmail = profile.email;
            fetchedName = profile.name;
            fetchedAvatar = profile.picture;
            fetchedProviderId = profile.sub;
          }
        } catch (err) {
          console.warn('Error al consultar perfil de Google:', err);
        }
      } else if (provider === 'facebook' && accessToken) {
        try {
          const fbRes = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
          );
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            fetchedEmail = fbData.email || `${fbData.id}@facebook.com`;
            fetchedName = fbData.name;
            fetchedAvatar = fbData.picture?.data?.url;
            fetchedProviderId = fbData.id;
          }
        } catch (err) {
          console.warn('Error al consultar perfil de Facebook:', err);
        }
      }

      // Si no se obtuvo del endpoint o es Apple, decodificar el ID Token JWT
      if (!fetchedEmail && idToken) {
        const decoded = decodeJwtPayload(idToken);
        if (decoded) {
          fetchedEmail = decoded.email;
          fetchedName = decoded.name;
          fetchedAvatar = decoded.picture;
          fetchedProviderId = decoded.sub;
        }
      }
    }

    // Si se obtuvieron las credenciales reales del usuario desde el flujo OAuth
    if (fetchedEmail) {
      const payload = {
        provider,
        providerId: fetchedProviderId || `${provider}_${Date.now()}`,
        email: fetchedEmail.toLowerCase(),
        name: fetchedName || `Cazador ${provider.toUpperCase()}`,
        avatarUrl: fetchedAvatar
      };

      const user = await api.socialLogin(payload);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return user;
    }

    // Si el proveedor no regresó datos o se requiere configurar Client IDs personalizados
    throw new Error(
      `No se pudo completar el flujo OAuth con ${provider.toUpperCase()}. Si necesitas configurar tu Client ID de OAuth en producción, puedes especificarlo o usar la opción "Personalizar nombre y correo".`
    );
  }
};
