/** In-memory stand-in for `@/storage` (encrypted MMKV needs the native module). */
const mem = new Map<string, string>();

export const zustandStorage = {
  getItem: (key: string) => mem.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mem.set(key, value);
  },
  removeItem: (key: string) => {
    mem.delete(key);
  },
};

export const getStorage = () => ({ clearAll: () => mem.clear() });

export const memoryStore = mem;
