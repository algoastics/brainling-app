import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { getOrCreateStorageKey } from '../encryptionKey';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 4,
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    __reset: () => store.clear(),
  };
});

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((n: number) => Uint8Array.from({ length: n }, (_, i) => i * 17)),
}));

const secureStore = SecureStore as jest.Mocked<typeof SecureStore> & { __reset: () => void };

beforeEach(() => {
  secureStore.__reset();
  jest.clearAllMocks();
});

describe('getOrCreateStorageKey', () => {
  it('creates a 128-bit hex key and stores it device-only', () => {
    const key = getOrCreateStorageKey();
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(Crypto.getRandomBytes).toHaveBeenCalledWith(16);
    expect(secureStore.setItem).toHaveBeenCalledWith('brainling.mmkv.key', key, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  });

  it('returns the stored key on later launches without generating a new one', () => {
    const first = getOrCreateStorageKey();
    const second = getOrCreateStorageKey();
    expect(second).toBe(first);
    expect(Crypto.getRandomBytes).toHaveBeenCalledTimes(1);
    expect(secureStore.setItem).toHaveBeenCalledTimes(1);
  });
});
