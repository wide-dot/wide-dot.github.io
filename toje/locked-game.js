// Page verrouillée sur un jeu : un site qui présente un jeu le fait lancer par
// une adresse, sans bibliothèque ni fichier à ouvrir.
//
//   /toje/?media=/releases/rick/rick-dangerous.fd&titre=Rick+Dangerous
//
// `media` se répète pour un jeu sur plusieurs disquettes, dans l'ordre : la
// première démarre au lecteur 1, la deuxième attend au lecteur 2 (un jeu qui la
// cherche là la trouve), et chacune reste à portée de main sous « Disquettes du
// jeu » — un jeu qui demande « insérez la disquette 2 » au lecteur 1 l'y reçoit
// sans redémarrer. Une carte SDDrive (.sd) ou une cartouche (.rom) démarre de
// même. L'extension décide, comme pour la bibliothèque.
//
// Un média peut être hébergé ailleurs sur le web, et zippé :
//
//   /toje/?media=https://exemple.org/jeux/mon-jeu.zip
//
// L'archive est ouverte dans la page ; ses disquettes, cartes et cartouches
// prennent sa place dans la liste, dans l'ordre naturel de leurs noms (disk1,
// disk2…). Le site qui l'héberge doit autoriser la lecture depuis une autre
// page (en-tête CORS) : GitHub (raw.githubusercontent.com, Pages) le fait.

import { formatOf } from './library.js';
import { titleOf, baseName } from './titles.js';
import { isZip, unzip } from './zip-reader.js';

/** Disquette (.fd, .sap), carte (sd), cartouche (rom), archive (zip), ou null. */
function kindOf(name) {
  if (/\.zip$/i.test(name)) return 'zip';
  if (/\.sap$/i.test(name)) return 'disk';
  const format = formatOf(name);
  return format === 'fd' ? 'disk' : format;
}
export const isDisk = name => kindOf(name) === 'disk';

/** Nom de fichier d'une adresse de média : son dernier segment, décodé. */
function fileName(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop());
}

/**
 * Le jeu imposé par l'adresse de la page, ou null : { title, key, media }, où
 * media = [{ url, name }]. Seuls les médias http(s) d'extension connue comptent
 * (un chemin relatif se résout contre la page).
 */
export function lockedGame(search, base) {
  const params = new URLSearchParams(search);
  const media = [];
  for (const value of params.getAll('media')) {
    let url;
    try { url = new URL(value, base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    const name = fileName(url.href);
    if (kindOf(name)) media.push({ url: url.href, name });
  }
  if (media.length === 0) return null;
  const title = (params.get('titre') || '').trim() || titleOf(media[0].name);
  return { title, key: baseName(media[0].name), media };
}

/** Les parties d'un jeu verrouillé restent les siennes : préfixe dans le magasin. */
export function scopedStore(store, prefix) {
  return {
    get: key => store.get(prefix + key),
    put: (key, value) => store.put(prefix + key, value),
    remove: key => store.remove(prefix + key),
    keys: async p => (await store.keys(prefix + p)).map(k => String(k).slice(prefix.length)),
  };
}

/** Média lançable (pas une archive) : ce qu'on retient dans un zip. */
const playable = name => { const k = kindOf(name); return k !== null && k !== 'zip'; };

/** Le site du média refuse la lecture depuis la page (ou est injoignable). */
export class BlockedMedia extends Error {
  constructor(media, message) {
    super(message);
    this.media = media;
  }
}

/**
 * Relais CORS publics, essayés dans l'ordre quand le site du média refuse la
 * lecture depuis la page (release GitHub, site perso). Chacun rend l'adresse
 * relayée. Ce sont des services tiers : ils voient l'adresse du média, leurs
 * conditions et leur disponibilité peuvent changer — d'où plusieurs, et le
 * recours « télécharger puis ouvrir » quand aucun ne répond.
 */
export const PUBLIC_RELAYS = [
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

/**
 * Relais donnés par l'adresse de la page (`&relais=https://mon-relais/?url=`,
 * répétable) : l'adresse du média, encodée, est ajoutée au bout. Ils passent
 * avant les relais publics — un site qui a son propre relais s'en sert.
 */
export function relaysOf(search) {
  return new URLSearchParams(search).getAll('relais')
    .filter(r => /^https?:\/\//.test(r))
    .map(prefix => url => prefix + encodeURIComponent(url));
}

/**
 * Un relais rend parfois une page d'erreur HTML avec un statut 200 : on ne
 * garde que des octets qui ressemblent au média attendu.
 */
function plausible(name, bytes) {
  if (bytes.length === 0) return false;
  if (kindOf(name) === 'zip') return isZip(bytes);
  const head = new TextDecoder().decode(new Uint8Array(bytes.buffer, bytes.byteOffset, Math.min(64, bytes.length)));
  return !/^\s*(<!doctype|<html|<\?xml|\{)/i.test(head);
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Int8Array(await response.arrayBuffer());
}

/**
 * Octets d'un média : en direct, sinon par un relais si son site refuse la
 * page (rend aussi `via`, l'hôte du relais), sinon BlockedMedia.
 */
async function download(m, relays) {
  try {
    return { bytes: await fetchBytes(m.url), via: null };
  } catch (e) {
    const other = typeof location !== 'undefined' && new URL(m.url).origin !== location.origin;
    // fetch ne distingue pas réseau coupé et refus CORS : le navigateur cache
    // la cause. Un statut HTTP, lui, est une vraie réponse du site.
    if (!other || !(e instanceof TypeError)) throw new Error(`${m.name} : ${e.message}`);
  }
  for (const relay of relays) {
    const url = relay(m.url);
    try {
      const bytes = await fetchBytes(url);
      if (plausible(m.name, bytes)) return { bytes, via: new URL(url).host };
    } catch (e) {
      // relais suivant
    }
  }
  throw new BlockedMedia(m,
    `${m.name} : ${new URL(m.url).host} refuse la lecture depuis cette page (pas d'en-tête CORS), ou est injoignable`);
}

/**
 * Un média téléchargé, ou les médias d'une archive : [{ name, bytes }]. Une
 * archive se reconnaît à son nom ou à sa signature (un lien de téléchargement
 * n'a pas toujours la bonne extension).
 */
export async function expand(name, bytes) {
  if (kindOf(name) !== 'zip' && !isZip(bytes)) return [{ name, bytes }];
  const inside = oneFormatPerGame(await unzip(bytes, playable));
  if (inside.length === 0) throw new Error(`${name} : aucune disquette, carte ou cartouche dans l'archive`);
  return inside;
}

/** Ordre de préférence quand un jeu est livré en plusieurs formats. */
const PREFERRED = ['fd', 'sap', 'sd', 'rom'];
const extOf = name => name.toLowerCase().split('.').pop();

/**
 * Une archive livre souvent le même jeu en plusieurs formats (NyanCatTO8.fd,
 * .sd, .hfe) : on n'en garde qu'un par nom, la disquette d'abord. Monter aussi
 * la carte SD changerait le démarrage (la carte prend la main au menu).
 */
function oneFormatPerGame(files) {
  const best = new Map();
  for (const f of files) {
    const key = f.name.replace(/\.[^.]+$/, '').toLowerCase();
    const kept = best.get(key);
    if (!kept || PREFERRED.indexOf(extOf(f.name)) < PREFERRED.indexOf(extOf(kept.name))) best.set(key, f);
  }
  return files.filter(f => best.get(f.name.replace(/\.[^.]+$/, '').toLowerCase()) === f);
}

/**
 * Télécharge les médias du jeu ; rend [{ name, bytes, label }] dans l'ordre.
 * `askUser(media)`, s'il est donné, est appelé pour un média que son site
 * refuse de servir à la page (lien de release GitHub, site perso sans CORS) :
 * il rend { name, bytes } du fichier que le visiteur a téléchargé lui-même.
 * Avant cela, `relays` (relais CORS, cf. PUBLIC_RELAYS) sont essayés ;
 * `onRelay(media, hôte)` dit lequel a servi.
 */
export async function fetchMedia(game, askUser = null, relays = PUBLIC_RELAYS, onRelay = null) {
  const one = async m => {
    try {
      const { bytes, via } = await download(m, relays);
      if (via && onRelay) onRelay(m, via);
      return await expand(m.name, bytes);
    } catch (e) {
      if (!(e instanceof BlockedMedia) || !askUser) throw e;
      const file = await askUser(m);
      return expand(file.name, file.bytes);
    }
  };
  const groups = [];
  // Un à la fois : deux demandes « télécharge-le » à l'écran en même temps
  // seraient illisibles.
  for (const m of game.media) groups.push(await one(m));
  const files = groups.flat();
  const disks = files.filter(f => isDisk(f.name));
  return files.map(f => {
    const rank = disks.indexOf(f);
    const label = disks.length > 1 && rank >= 0 ? `${game.title} — disquette ${rank + 1}` : game.title;
    return { ...f, label };
  });
}

/**
 * Rangée « Disquettes du jeu » : chaque disquette, avec de quoi la glisser au
 * lecteur 1 ou 2. `insert(entry, drive)` fait l'insertion. Masquée pour un jeu
 * d'une seule disquette.
 */
export function renderGameDisks(container, entries, insert) {
  const disks = entries.filter(e => isDisk(e.name));
  container.hidden = disks.length < 2;
  container.replaceChildren();
  if (container.hidden) return;
  const title = document.createElement('p');
  title.className = 'menu-note';
  title.textContent = 'Disquettes du jeu : la glisser au lecteur demandé, sans redémarrer';
  container.append(title);
  disks.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'opt-row';
    const text = document.createElement('span');
    text.className = 'opt-text';
    text.textContent = `Disquette ${i + 1}`;
    const seg = document.createElement('span');
    seg.className = 'segmented';
    for (const drive of [0, 1]) {
      const b = document.createElement('button');
      b.className = 'seg-item';
      b.textContent = `Lecteur ${drive + 1}`;
      b.title = `Glisse la disquette ${i + 1} dans le lecteur ${drive + 1}`;
      b.addEventListener('click', () => insert(entry, drive));
      seg.append(b);
    }
    row.append(text, seg);
    container.append(row);
  });
}
