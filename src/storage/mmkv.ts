import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import { getOrCreateStorageKey } from './encryptionKey';

let instance: MMKV | undefined;

/** The app's encrypted key/value store (AES-256, key held in the Android Keystore). */
export function getStorage(): MMKV {
  instance ??= createMMKV({
    id: 'brainling',
    encryptionKey: getOrCreateStorageKey(),
    encryptionType: 'AES-256',
  });
  return instance;
}

/** Adapter for zustand's `persist` middleware. */
export const zustandStorage: StateStorage = {
  getItem: (name) => getStorage().getString(name) ?? null,
  setItem: (name, value) => getStorage().set(name, value),
  removeItem: (name) => {
    getStorage().remove(name);
  },
};
