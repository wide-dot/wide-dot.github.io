// Noms lisibles des médias : « L'Aigle d'Or » plutôt que l-aigle-d-or_to8.fd.
// Une règle générale (suffixe machine retiré, mots capitalisés, petits mots
// en minuscules) et quelques exceptions qu'aucune règle ne devine.

const EXCEPTIONS = {
  'battlesquadron': 'Battle Squadron',
  'hcl-mega-demo': 'HCL Mega Demo',
  'l-aigle-d-or': 'L’Aigle d’Or',
  'ms-pacman': 'Ms. Pac-Man',
  'mspacman': 'Ms. Pac-Man',
  'prince-of-persia': 'Prince of Persia',
  'r-type': 'R-Type',
  'r-type-last': 'R-Type Last',
  'sms-player': 'SMS Player',
  'spaceproject1&2': 'Space Project 1 & 2',
  'spaceproject3&4': 'Space Project 3 & 4',
  'test-emul-sd': 'Test émulateur SD',
};
const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'a', 'au']);

/** Nom du fichier sans extension ni suffixe de machine (_to8, _mo6to8). */
export function baseName(file) {
  return file.replace(/\.[^.]+$/, '').replace(/_(mo6)?to8$/i, '');
}

export function titleOf(file) {
  const base = baseName(file);
  if (EXCEPTIONS[base.toLowerCase()]) return EXCEPTIONS[base.toLowerCase()];
  return base.split(/[-_ ]+/).filter(Boolean)
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Clé de recherche : minuscules, sans accents ni ponctuation. */
export function searchKey(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
