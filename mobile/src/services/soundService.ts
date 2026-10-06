import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

const SOUND_PREF_KEY = 'SCANNER_BEEP_ENABLED';

let beepPlayer: AudioPlayer | null = null;
let soundEnabled = true;

export const initSoundService = async (): Promise<boolean> => {
  try {
    const saved = await AsyncStorage.getItem(SOUND_PREF_KEY);
    if (saved !== null) {
      soundEnabled = saved === 'true';
    }
  } catch (e) {
    console.warn('Failed to load sound preference:', e);
  }
  return soundEnabled;
};

/**
 * Reproduce el beep característico del verificador de precios / checador de tienda.
 * Volumen bajo (~0.25) para no ser intrusivo.
 */
export const playScanBeep = async (): Promise<void> => {
  if (!soundEnabled) return;

  try {
    if (!beepPlayer) {
      beepPlayer = createAudioPlayer(require('../../assets/scanner-beep.wav'));
      beepPlayer.volume = 0.25;
    }

    if (beepPlayer) {
      beepPlayer.volume = 0.25;
      await beepPlayer.seekTo(0);
      beepPlayer.play();
    }
  } catch (err) {
    console.warn('No se pudo reproducir el sonido de escaneo:', err);
  }
};

export const setSoundEnabled = async (enabled: boolean): Promise<void> => {
  soundEnabled = enabled;
  try {
    await AsyncStorage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch (e) {
    console.warn('Failed to save sound preference:', e);
  }
};

export const getSoundEnabled = (): boolean => soundEnabled;
