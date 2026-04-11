import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage works on both web and native platforms
// providing cross-platform data sync
export const storage = {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async getAllKeys(): Promise<string[]> {
    return AsyncStorage.getAllKeys();
  },

  async multiRemove(keys: string[]): Promise<void> {
    await AsyncStorage.multiRemove(keys);
  },
};
