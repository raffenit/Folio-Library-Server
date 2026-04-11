import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },

  async getAllKeys(): Promise<string[]> {
    if (Platform.OS === 'web') {
      return Object.keys(localStorage);
    }
    // On native, we can't easily list all keys from SecureStore
    // Return empty array - profile deletion will need different approach
    return [];
  },

  async multiRemove(keys: string[]): Promise<void> {
    if (Platform.OS === 'web') {
      keys.forEach(key => localStorage.removeItem(key));
      return;
    }
    // On native, delete each key individually
    await Promise.all(keys.map(key => SecureStore.deleteItemAsync(key)));
  },
};
