import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'brainling.mmkv.key';
const KEY_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the MMKV encryption key, creating it on first launch. The key lives in
 * expo-secure-store, which is backed by the Android Keystore, and never leaves the device.
 */
export function getOrCreateStorageKey(): string {
  const existing = SecureStore.getItem(KEY_NAME);
  if (existing) return existing;
  const created = toHex(Crypto.getRandomBytes(KEY_BYTES));
  SecureStore.setItem(KEY_NAME, created, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return created;
}
