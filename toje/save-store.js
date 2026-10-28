// Parties sauvegardées, dans le navigateur du visiteur : IndexedDB, qui garde
// des tableaux d'octets tels quels (localStorage n'accepte que du texte, et
// plafonne vers 5 Mo). Sans IndexedDB (navigation privée de certains
// navigateurs), un magasin en mémoire : les parties durent le temps de la page.
//
// L'état d'une machine pèse ~600 Ko, la RAM du TO8 surtout, en grande partie
// vide : compressé en gzip par le navigateur, il tombe à quelques dizaines de Ko.

const DB = 'toje';
const STORE = 'saves';

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function memoryStore() {
  const map = new Map();
  return {
    get: async key => map.get(key),
    put: async (key, value) => { map.set(key, value); },
    remove: async key => { map.delete(key); },
  };
}

/** Magasin clé → partie : { get, put, remove }, toutes asynchrones. */
export async function openSaveStore() {
  try {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    const db = await request(open);
    const run = (mode, op) => request(op(db.transaction(STORE, mode).objectStore(STORE)));
    return {
      get: key => run('readonly', s => s.get(key)),
      put: (key, value) => run('readwrite', s => s.put(value, key)),
      remove: key => run('readwrite', s => s.delete(key)),
    };
  } catch {
    return memoryStore();
  }
}

async function through(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** Compresse un état ; { gz, bytes } — sans CompressionStream, tel quel. */
export async function pack(bytes) {
  if (typeof CompressionStream === 'undefined') return { gz: false, bytes };
  return { gz: true, bytes: await through(bytes, new CompressionStream('gzip')) };
}

/** Pendant de pack, rendu en Int8Array pour le wasm. */
export async function unpack({ gz, bytes }) {
  const raw = gz ? await through(bytes, new DecompressionStream('gzip')) : bytes;
  return new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}
