import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl?: string;
  reputation: number;
  authProvider: 'google' | 'facebook' | 'apple';
  createdAt?: string;
}

const STORAGE_KEY = '@barcode_tracker_user';

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
   * Inicia sesión o registra al usuario con Google, Facebook o Apple
   */
  async loginWithSocial(
    provider: 'google' | 'facebook' | 'apple',
    userData?: {
      email?: string;
      name?: string;
      avatarUrl?: string;
    }
  ): Promise<UserProfile> {
    // Si no se proporcionaron datos específicos (ej. One-Tap directo),
    // se crea la identidad correspondiente al proveedor seleccionado.
    let providerId = `${provider}_${Date.now().toString().slice(-6)}`;
    let email = userData?.email;
    let name = userData?.name;
    let avatarUrl = userData?.avatarUrl;

    if (!email) {
      switch (provider) {
        case 'google':
          email = 'cazador.google@gmail.com';
          name = name || 'Cazador Google';
          avatarUrl = avatarUrl || 'https://lh3.googleusercontent.com/a/default-user';
          break;
        case 'facebook':
          email = 'cazador.fb@facebook.com';
          name = name || 'Cazador Facebook';
          avatarUrl = avatarUrl || 'https://graph.facebook.com/v12.0/default/picture';
          break;
        case 'apple':
          email = 'cazador.apple@privaterelay.appleid.com';
          name = name || 'Cazador Apple';
          avatarUrl = avatarUrl || 'https://appleid.apple.com/static/bin/cb/avatar.png';
          break;
      }
    }

    const payload = {
      provider,
      providerId,
      email,
      name: name || `Cazador ${provider.toUpperCase()}`,
      avatarUrl
    };

    const user = await api.socialLogin(payload);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }
};
