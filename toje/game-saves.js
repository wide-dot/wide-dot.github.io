// Sauvegarde et reprise d'une partie : l'état de la machine (WebMain.saveState,
// sans les médias) et les médias montés, avec une vignette de l'écran.
//
//  - « auto » : écrite quand la page passe en arrière-plan (un téléphone ferme
//    l'onglet dès qu'on change d'application) et toutes les minutes en jeu ;
//    proposée au retour sur la page ;
//  - trois emplacements à la main, dans le menu.
//
// Reprendre, c'est remonter les médias sans redémarrer puis restaurer l'état.

import { pack, unpack } from './save-store.js';

const SLOTS = ['slot1', 'slot2', 'slot3'];
const AUTO = 'auto';
const AUTO_PERIOD_MS = 60_000;
const THUMB = { width: 176, height: 116 };

function bytesOf(view) {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function when(ms) {
  return new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit' });
}

/** Vignette JPEG de l'écran : quelques Ko, de quoi reconnaître la partie. */
function thumbnail(canvas) {
  const small = document.createElement('canvas');
  small.width = THUMB.width;
  small.height = THUMB.height;
  small.getContext('2d').drawImage(canvas, 0, 0, THUMB.width, THUMB.height);
  return small.toDataURL('image/jpeg', 0.7);
}

/**
 * media : { list(), title(), remount(list) } — les médias montés, côté page.
 * ui : { slots, resume, resumeTitle, resumeWhen, resumeThumb, resumeYes, resumeNo }.
 * onDone(text) : compte rendu dans la ligne d'état.
 */
export function createGameSaves({ toje, store, media, canvas, ui, onDone, onFailedResume }) {
  let framesAtLastAuto = -1;

  async function capture() {
    return {
      title: media.title(),
      when: Date.now(),
      media: media.list(),
      state: await pack(bytesOf(toje.saveState())),
      thumb: thumbnail(canvas),
    };
  }

  // Décompresser d'abord, puis remonter et restaurer d'un seul tenant : entre
  // les deux, la boucle de la page faisait tourner la machine sur une mémoire
  // déjà réorganisée (cartouche retirée) — elle exécutait n'importe quoi, et ce
  // qui n'est pas dans l'instantané pouvait en garder la trace.
  async function restore(save) {
    const state = await unpack(save.state);
    media.remount(save.media);
    if (toje.loadState(state)) return true;
    onFailedResume(save);   // état d'une autre version de TOJE : on redémarre sur ses médias
    return false;
  }

  async function saveTo(key) {
    await store.put(key, await capture());
  }

  // ── Emplacements du menu ────────────────────────────────────────────────
  async function renderSlots() {
    ui.slots.replaceChildren(...await Promise.all(SLOTS.map(async (key, i) => {
      const save = await store.get(key);
      const row = document.createElement('div');
      row.className = 'save-row';
      const thumb = document.createElement('img');
      thumb.className = 'save-thumb';
      thumb.alt = '';
      if (save) thumb.src = save.thumb;
      const info = document.createElement('span');
      info.className = 'save-info';
      info.innerHTML = '<b></b><small></small>';
      info.querySelector('b').textContent = save ? save.title : `Partie ${i + 1}`;
      info.querySelector('small').textContent = save ? when(save.when) : 'vide';
      const saveBtn = button('Sauver', async () => {
        if (media.list().length === 0) { onDone('aucun média : pas de partie à sauver'); return; }
        await saveTo(key);
        onDone(`partie sauvée (emplacement ${i + 1})`);
        renderSlots();
      }, false);
      const loadBtn = button('Charger', async () => {
        if (await restore(save)) onDone(`partie reprise : ${save.title}`);
      }, !save);
      row.append(thumb, info, saveBtn, loadBtn);
      return row;
    })));
  }

  function button(label, action, disabled) {
    const b = document.createElement('button');
    b.className = 'keycap small';
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', action);
    return b;
  }

  // ── Sauvegarde automatique ──────────────────────────────────────────────
  async function autoSave() {
    if (media.list().length === 0) return;               // le menu du TO8 n'est pas une partie
    const frames = window.tojeStats.frames;
    if (frames === framesAtLastAuto) return;              // rien n'a tourné depuis
    framesAtLastAuto = frames;
    await saveTo(AUTO);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autoSave();
  });
  window.addEventListener('pagehide', autoSave);
  setInterval(autoSave, AUTO_PERIOD_MS);

  // ── Proposition de reprise à l'ouverture ────────────────────────────────
  async function offerResume() {
    const save = await store.get(AUTO);
    if (!save) return false;
    ui.resumeTitle.textContent = save.title;
    ui.resumeWhen.textContent = `sauvée le ${when(save.when)}`;
    ui.resumeThumb.src = save.thumb;
    ui.resume.hidden = false;
    ui.resumeYes.onclick = async () => {
      ui.resume.hidden = true;
      if (await restore(save)) onDone(`partie reprise : ${save.title}`);
    };
    ui.resumeNo.onclick = () => {
      ui.resume.hidden = true;
      store.remove(AUTO);
    };
    return true;
  }

  return { renderSlots, offerResume };
}
