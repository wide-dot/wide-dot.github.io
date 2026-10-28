// Mes disquettes : disquettes vierges et copies de travail, gardées dans le
// navigateur (IndexedDB), toujours inscriptibles.
//
// L'astuce. Un original — une disquette de la bibliothèque ou un fichier
// ouvert — reste toujours languette posée : les contrôles anti-copie, qui
// lisent ce bit et refusent un original qui se dirait inscriptible, sont
// satisfaits, et son fichier n'est jamais réécrit. Pour écrire, on en fait
// une COPIE DE TRAVAIL : elle remplace l'original dans son lecteur, sans
// redémarrer — le jeu, déjà passé par son contrôle, continue et sauvegarde
// sur la copie. Ou l'on garde l'original au lecteur 1 et l'on glisse une
// disquette vierge au lecteur 2.
//
// Chaque écriture du TO8 est rangée dès que le lecteur est au repos ; une
// copie se télécharge en .fd. Remplace l'ancien réglage « Sauvegardes sur
// disquette » (copie par jeu, rangée sous le nom de l'original) : ces
// copies-là sont reprises ici au premier passage.

import { titleOf } from './titles.js';

const PREFIX = 'mydisk:';
const OLD_PREFIX = 'disk:';
const IDLE_CHECK_MS = 1000;

const asBytes = bytes => new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const asInt8 = bytes => new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * toje : exports du wasm ; store : save-store.js ; drives() : entrées des deux
 * lecteurs ({ name, myDisk?, … } | null) ; busy() : vrai tant que le lecteur
 * travaille ; onStatus(texte) ; onChange() : la liste a changé.
 */
export function createMyDisks({ toje, store, drives, busy, onStatus, onChange }) {
  let lastWrites = toje.diskWriteCount();

  async function put(id, record) {
    await store.put(PREFIX + id, record);
    onChange();
  }

  /** Une copie modifiée de l'ancien réglage par jeu devient une disquette à moi. */
  async function migrate() {
    for (const key of await store.keys(OLD_PREFIX)) {
      const bytes = await store.get(key);
      const source = key.slice(OLD_PREFIX.length);
      const now = Date.now();
      if (bytes) await store.put(PREFIX + newId(), { label: `${titleOf(source)} (sauvegardes)`, source, created: now, updated: now, bytes });
      await store.remove(key);
    }
  }

  /** Lève la languette des disquettes à moi, pose celle des originaux. */
  function apply() {
    drives().forEach((disk, d) => { if (disk) toje.setDiskWritable(d, Boolean(disk.myDisk)); });
  }

  /** Range les disquettes à moi écrites par le TO8, une fois le lecteur au repos. */
  async function keep(force = false) {
    const writes = toje.diskWriteCount();
    if (writes === lastWrites || (busy() && !force)) return;
    lastWrites = writes;
    let kept = 0;
    for (const [d, disk] of drives().entries()) {
      const bytes = disk && disk.myDisk && toje.diskBytes(d);
      if (!bytes) continue;
      const record = await store.get(PREFIX + disk.myDisk);
      if (!record) continue;                      // supprimée entre-temps
      await store.put(PREFIX + disk.myDisk, { ...record, updated: Date.now(), bytes: asBytes(bytes) });
      kept++;
    }
    if (kept) { onStatus('disquette rangée dans le navigateur'); onChange(); }
  }
  setInterval(keep, IDLE_CHECK_MS);
  document.addEventListener('visibilitychange', () => { if (document.hidden) keep(true); });

  return {
    migrate,
    apply,
    keep,
    /** [{ id, label, source, updated }], la plus récente d'abord. */
    async list() {
      const out = [];
      for (const key of await store.keys(PREFIX)) {
        const r = await store.get(key);
        if (r) out.push({ id: key.slice(PREFIX.length), label: r.label, source: r.source, updated: r.updated });
      }
      return out.sort((a, b) => b.updated - a.updated);
    },
    /** { label, source, bytes (Int8Array) } ou null. */
    async load(id) {
      const r = await store.get(PREFIX + id);
      return r ? { ...r, bytes: asInt8(r.bytes) } : null;
    },
    /** Disquette vierge formatée ; rend son identifiant. */
    async blank(label) {
      const id = newId();
      const now = Date.now();
      await put(id, { label, source: `${label}.fd`, created: now, updated: now, bytes: asBytes(toje.blankDisk(label)) });
      return id;
    },
    /** Copie de la disquette du lecteur, telle que le TO8 l'a laissée ; rend son identifiant. */
    async copyOf(drive) {
      const disk = drives()[drive];
      const bytes = disk && toje.diskBytes(drive);
      if (!bytes) return null;
      const id = newId();
      const now = Date.now();
      await put(id, { label: `${titleOf(disk.name)} (copie)`, source: disk.name, created: now, updated: now, bytes: asBytes(bytes) });
      return id;
    },
    async rename(id, label) {
      const r = await store.get(PREFIX + id);
      if (r) await put(id, { ...r, label });
    },
    async remove(id) {
      await store.remove(PREFIX + id);
      onChange();
    },
    /** Télécharge un .fd : la disquette du lecteur `drive`, ou une disquette à moi `id`. */
    async download({ drive, id }) {
      let bytes;
      let label;
      if (id) {
        const r = await store.get(PREFIX + id);
        bytes = r && r.bytes;
        label = r && r.label;
      } else {
        const disk = drives()[drive];
        bytes = disk && toje.diskBytes(drive);
        label = disk && (disk.label || disk.name.replace(/\.[^.]+$/, ''));
      }
      if (!bytes) { onStatus('pas de disquette .fd à télécharger'); return; }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      link.download = `${label.replace(/[\\/:*?"<>|]/g, '_')}.fd`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    },
  };
}
