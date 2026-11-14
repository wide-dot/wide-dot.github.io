// Lecture d'une archive .zip dans le navigateur, sans bibliothèque : un jeu
// distribué zippé (une ou plusieurs disquettes) se lance par son adresse.
//
// On lit le répertoire central (fin de l'archive), pas les en-têtes locaux
// seuls : c'est lui qui porte les tailles quand l'archive a été écrite en flux
// (bit 3, tailles en fin d'entrée). Méthodes 0 (stockée) et 8 (deflate, par
// DecompressionStream, présent dans les navigateurs Wasm GC et dans Node 22).
// Zip64 et entrées chiffrées sont refusés : aucun média Thomson n'en a besoin.

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Vrai si les octets commencent par la signature d'un zip (« PK\3\4 »). */
export function isZip(bytes) {
  const b = new Uint8Array(bytes.buffer, bytes.byteOffset, Math.min(4, bytes.byteLength));
  return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/** Fin du répertoire central : cherchée à rebours (un commentaire peut suivre). */
function findEnd(view) {
  const last = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= last; i--) {
    if (view.getUint32(i, true) === EOCD) return i;
  }
  throw new Error('archive zip illisible (fin du répertoire introuvable)');
}

const decoder = new TextDecoder();

/** Entrées du répertoire central : [{ name, method, flags, size, packed, offset }]. */
function centralEntries(view) {
  const end = findEnd(view);
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  if (p === 0xffffffff || count === 0xffff) throw new Error('archive zip64 non prise en charge');
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== CENTRAL) throw new Error('archive zip illisible (répertoire central)');
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const name = decoder.decode(new Uint8Array(view.buffer, view.byteOffset + p + 46, nameLength));
    entries.push({
      name,
      flags: view.getUint16(p + 8, true),
      method: view.getUint16(p + 10, true),
      packed: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      offset: view.getUint32(p + 42, true),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Octets décompressés d'une entrée. */
async function extract(view, entry) {
  if (entry.flags & 1) throw new Error(`${entry.name} : entrée chiffrée`);
  const p = entry.offset;
  if (view.getUint32(p, true) !== LOCAL) throw new Error(`${entry.name} : en-tête local introuvable`);
  const start = p + 30 + view.getUint16(p + 26, true) + view.getUint16(p + 28, true);
  const data = new Uint8Array(view.buffer, view.byteOffset + start, entry.packed);
  if (entry.method === 0) return data.slice();
  if (entry.method === 8) {
    const out = await inflateRaw(data);
    if (out.length !== entry.size) throw new Error(`${entry.name} : taille décompressée inattendue`);
    return out;
  }
  throw new Error(`${entry.name} : méthode de compression ${entry.method} non prise en charge`);
}

/** Nom de fichier d'un chemin d'archive (dernier segment). */
const leaf = path => path.split('/').pop();

/**
 * Fichiers d'une archive retenus par `accept(nom)`, dans l'ordre naturel de
 * leur nom (disk2 avant disk10) : [{ name, bytes: Int8Array }]. Répertoires et
 * métadonnées macOS (__MACOSX/, ._x) écartés.
 */
export async function unzip(bytes, accept = () => true) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const wanted = centralEntries(view).filter(e =>
    !e.name.endsWith('/') && !e.name.startsWith('__MACOSX/')
    && !leaf(e.name).startsWith('._') && accept(leaf(e.name)));
  wanted.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const out = [];
  for (const e of wanted) {
    const data = await extract(view, e);
    out.push({ name: leaf(e.name), bytes: new Int8Array(data.buffer, data.byteOffset, data.byteLength) });
  }
  return out;
}
