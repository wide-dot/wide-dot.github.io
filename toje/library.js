// Bibliothèque : les médias de fixtures/, listés au build dans fixtures/index.txt
// (un hébergement statique ne liste pas ses répertoires). Un toucher télécharge
// le fichier et le confie à mount(nom, octets), qui l'oriente selon l'extension.

import { titleOf, searchKey } from './titles.js';

const FORMATS = {
  fd: { label: 'FD', title: 'Disquette' },
  sd: { label: 'SD', title: 'Carte SDDrive' },
  rom: { label: 'ROM', title: 'Cartouche' },
};

/** Format d'un nom de fichier (fd, sd, rom) ou null. */
export function formatOf(name) {
  const ext = name.toLowerCase().split('.').pop();
  return ext in FORMATS ? ext : null;
}

/**
 * Remplit `list` avec la bibliothèque et branche les filtres `chips`
 * (boutons data-format = all | fd | sd | rom) et le champ `search`. `version`
 * invalide le cache d'un déploiement à l'autre ; `onStatus` rend compte du
 * téléchargement. Rend { files, load(fichier) } — vide si la liste manque.
 */
export async function createLibrary(list, chips, search, version, mount, onStatus) {
  let files = [];
  try {
    const response = await fetch(`fixtures/index.txt?v=${version}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    files = (await response.text()).split('\n').map(s => s.trim()).filter(formatOf);
  } catch (e) {
    list.textContent = 'Bibliothèque indisponible.';
    console.error(e);
    return { files: [], load: async () => false };
  }
  files.sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'fr'));

  let filter = 'all';
  function render() {
    list.replaceChildren();
    const wanted = searchKey(search.value);
    for (const file of files) {
      const format = formatOf(file);
      if (filter !== 'all' && filter !== format) continue;
      if (wanted && !searchKey(`${titleOf(file)} ${file}`).includes(wanted)) continue;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'lib-item';
      item.title = `${FORMATS[format].title} : ${file}`;
      const badge = document.createElement('span');
      badge.className = `badge badge-${format}`;
      badge.textContent = FORMATS[format].label;
      const name = document.createElement('span');
      name.className = 'lib-name';
      name.textContent = titleOf(file);
      item.append(badge, name);
      item.addEventListener('click', () => load(file));
      list.append(item);
    }
    if (list.children.length === 0) list.textContent = wanted ? 'Aucun résultat.' : 'Aucun média.';
  }

  async function load(file) {
    onStatus(`chargement de ${titleOf(file)}…`);
    try {
      const response = await fetch(`fixtures/${encodeURIComponent(file)}?v=${version}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await mount(file, new Int8Array(await response.arrayBuffer()), { fromLibrary: true });
      return true;
    } catch (e) {
      onStatus(`échec : ${file}`);
      console.error(e);
      return false;
    }
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      filter = chip.dataset.format;
      for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
      render();
    });
  }
  search.addEventListener('input', render);
  render();
  return { files, load };
}
