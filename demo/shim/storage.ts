// Archivio locale della demo: resta solo in memoria, così ogni apertura riparte pulita.
const mem = new Map<string, string>();
const AsyncStorage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
};
export default AsyncStorage;
