// Sauvegardes des jeux sur leur disquette. Par défaut la languette est posée,
// comme sur le pilote : des contrôles anti-copie lisent ce bit et refusent un
// original qui se dirait inscriptible. Pour un jeu qui sauvegarde (scores,
// parties), on la lève — réglage retenu par jeu — et la disquette écrite est
// gardée dans le navigateur, sous son nom : la remettre la retrouve modifiée.
// L'original n'est jamais touché ; on peut y revenir, ou télécharger la copie.

const KEY = name => `disk:${name}`;
const IDLE_CHECK_MS = 1000;

/**
 * toje : exports du wasm ; store : magasin des parties (save-store.js) ;
 * prefs : réglages du visiteur ; drives() : [{ name } | null, …] des lecteurs ;
 * busy() : vrai tant que le lecteur travaille ; onStatus(texte).
 */
export function createDiskCopies({ toje, store, prefs, drives, busy, onStatus }) {
  let game = '';
  let writable = false;
  let lastWrites = toje.diskWriteCount();

  /** Octets à monter pour `name` : la copie modifiée si ce jeu en a une. */
  async function bytesFor(name, original) {
    if (!prefs.get(`diskWrite.${game}`, false)) return { bytes: original, modified: false };
    const copy = await store.get(KEY(name));
    return copy ? { bytes: new Int8Array(copy.buffer, copy.byteOffset, copy.byteLength), modified: true }
                : { bytes: original, modified: false };
  }

  /** Lève ou pose la languette des disquettes montées, selon le réglage du jeu. */
  function apply() {
    for (let d = 0; d < 2; d++) if (drives()[d]) toje.setDiskWritable(d, writable);
  }

  /** Range la disquette écrite par le TO8, une fois le lecteur au repos. */
  async function keep(force = false) {
    const writes = toje.diskWriteCount();
    if (!writable || writes === lastWrites || (busy() && !force)) return;
    lastWrites = writes;
    let kept = 0;
    for (let d = 0; d < 2; d++) {
      const disk = drives()[d];
      const bytes = disk && toje.diskBytes(d);
      if (!bytes) continue;
      await store.put(KEY(disk.name), new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      kept++;
    }
    if (kept) onStatus('disquette sauvegardée dans le navigateur');
  }
  setInterval(keep, IDLE_CHECK_MS);
  document.addEventListener('visibilitychange', () => { if (document.hidden) keep(true); });

  return {
    bytesFor,
    apply,
    /** Le jeu change : son réglage d'écriture s'applique. */
    forGame(name) {
      game = name;
      writable = prefs.get(`diskWrite.${game}`, false);
      apply();
      return writable;
    },
    setWritable(on) {
      writable = on;
      prefs.set(`diskWrite.${game}`, on);
      apply();
    },
    /** Oublie la copie modifiée de `name` : la prochaine insertion reprend l'original. */
    forget: name => store.remove(KEY(name)),
    hasCopy: async name => Boolean(await store.get(KEY(name))),
    /** Télécharge la disquette du lecteur, telle que le TO8 l'a laissée. */
    download(drive) {
      const disk = drives()[drive];
      const bytes = disk && toje.diskBytes(drive);
      if (!bytes) { onStatus('pas de disquette .fd à télécharger'); return; }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      link.download = disk.name.replace(/\.[^.]+$/, '') + '.fd';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    },
  };
}
