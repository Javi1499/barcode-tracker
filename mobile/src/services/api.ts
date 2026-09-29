import {
  BarcodeLookupResponse,
  ProductPriceHistoryResponse,
  AddPriceEntryPayload
} from '../types';

// Configuración dinámica de API (EAS Build o desarrollo local)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://barcode-tracker-production.up.railway.app/api';

/**
 * Parsea de manera segura respuestas que puedan no ser JSON (ej. páginas de error HTML 404/502)
 */
async function safeJsonParse(res: Response, defaultError: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Error del servidor (${res.status}): ${res.statusText || defaultError}`);
    }
    throw new Error(defaultError);
  }
}

export const api = {
  /**
   * Consulta si un código de barras ya existe en el sistema
   */
  async lookupBarcode(barcode: string): Promise<BarcodeLookupResponse> {
    const res = await fetch(`${API_BASE_URL}/products/lookup/${encodeURIComponent(barcode)}`);
    const json = await safeJsonParse(res, 'Error en lookup de producto');
    if (!res.ok) {
      throw new Error(json.message || `Error en lookup: ${res.statusText}`);
    }
    return json;
  },

  /**
   * Obtiene la serie histórica de precios para un producto
   */
  async getPriceHistory(barcode: string): Promise<ProductPriceHistoryResponse> {
    const res = await fetch(`${API_BASE_URL}/prices/history/${encodeURIComponent(barcode)}`);
    const json = await safeJsonParse(res, 'Error al obtener historial');
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error al obtener historial');
    }
    return json.data;
  },

  /**
   * Registra un nuevo avistamiento de precio (inmutable)
   */
  async addPriceEntry(payload: AddPriceEntryPayload) {
    const res = await fetch(`${API_BASE_URL}/prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await safeJsonParse(res, 'Error al guardar precio');
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error al guardar precio');
    }
    return json;
  },

  /**
   * Búsqueda en el banco de códigos de la comunidad
   */
  async searchCommunityDeals(query: string, storeName?: string) {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (storeName) params.append('storeName', storeName);

    const res = await fetch(`${API_BASE_URL}/products/community/search?${params.toString()}`);
    const json = await safeJsonParse(res, 'Error al buscar en la comunidad');
    if (!res.ok) {
      throw new Error(json.message || 'Error al buscar en la comunidad');
    }
    return json.data;
  },

  /**
   * Registro con correo electrónico y contraseña segura
   */
  async registerWithEmail(payload: { email: string; password: string; name?: string }) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await safeJsonParse(res, 'Error al registrar cuenta');
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error al registrar cuenta');
    }
    return json.data.user;
  },

  /**
   * Inicio de sesión con correo electrónico y contraseña
   */
  async loginWithEmail(payload: { email: string; password: string }) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await safeJsonParse(res, 'Error al iniciar sesión');
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error al iniciar sesión');
    }
    return json.data.user;
  },

  /**
   * Inicio de sesión / registro con Google, Facebook o Apple
   */
  async socialLogin(payload: {
    provider: 'google' | 'facebook' | 'apple';
    providerId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/auth/social-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await safeJsonParse(res, 'Error en autenticación social');
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error en autenticación social');
    }
    return json.data.user;
  },

  /**
   * Consulta el perfil y estadísticas del usuario
   */
  async getUserProfile(userId: string) {
    const res = await fetch(`${API_BASE_URL}/auth/profile/${encodeURIComponent(userId)}`);
    const json = await safeJsonParse(res, 'Error al obtener perfil');
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error al obtener perfil');
    }
    return json.data;
  },

  /**
   * Calificar o reportar un código de barras
   * type: 'WORKING' | 'BROKEN'
   */
  async submitBarcodeFeedback(payload: {
    barcode: string;
    type: 'WORKING' | 'BROKEN';
    reason?: string;
    userId?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/products/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await safeJsonParse(res, 'Error al enviar reporte del código');
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error al enviar reporte del código');
    }
    return json;
  }
};

