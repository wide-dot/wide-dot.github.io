// Médias récents : les derniers médias chargés, le plus récent en tête, pour
// les relancer d'un toucher. Un fichier ouvert n'a pas d'adresse : on garde ses
// octets, compressés, dans le magasin de la page (IndexedDB, save-store.js),
// sous « recent:<nom> » — un même nom rechargé remplace l'ancien et remonte.

import { pack, unpack } from './save-store.js';

const PREFIX = 'recent:';
/** Une carte SDDrive pèse quelques Mo : huit suffisent, sans encombrer le navigateur. */
export const MAX_RECENT = 8;

/** { remember, list, load, remove, clear } sur un magasin { get, put, remove, keys }. */
export function createRecentMedia(store, now = () => Date.now()) {
  async function list() {
    const keys = await store.keys(PREFIX);
    const entries = await Promise.all(keys.map(async key => {
      const e = await store.get(key);
      return e && { name: e.name, used: e.used, size: e.size };
    }));
    return entries.filter(Boolean).sort((a, b) => b.used - a.used);
  }

  return {
    list,

    /** Retient `name` et ses octets en tête ; le plus ancien sort au-delà de MAX_RECENT. */
    async remember(name, bytes) {
      const raw = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      await store.put(PREFIX + name, { name, used: now(), size: raw.byteLength, data: await pack(raw.slice()) });
      const all = await list();
      await Promise.all(all.slice(MAX_RECENT).map(e => store.remove(PREFIX + e.name)));
    },

    /** Octets du média `name` (Int8Array), ou null s'il n'est plus retenu. */
    async load(name) {
      const e = await store.get(PREFIX + name);
      return e ? unpack(e.data) : null;
    },

    remove: name => store.remove(PREFIX + name),

    async clear() {
      await Promise.all((await store.keys(PREFIX)).map(k => store.remove(k)));
    },
  };
}
