// Panneau « Touches du clavier et de la manette » : on règle une touche en
// cliquant sur sa case, puis en appuyant sur la touche du PC ou le bouton de
// manette voulu. Échap annule, ⌫ efface.
import { JOY_ACTIONS, MAX_REMAPS } from './input-bindings.js';
import { keySelect } from './touch-keys.js';

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/**
 * `root` reçoit le panneau ; `bindings` = createBindings(…) ; `choices` =
 * keyChoices(toje). Rend { render, offer(source, keyText), capturing() } :
 * la boucle d'entrées présente chaque touche et chaque bouton à `offer`, qui
 * les garde pour lui tant qu'une case attend.
 */
export function createBindingsPanel(root, bindings, choices) {
  let capture = null;      // { kind: 'key' | 'pad' | null, apply(source, keyText), button }
  const hint = el('p', 'bind-hint');

  function captureButton(text, kind, apply, title) {
    const b = el('button', 'bind-btn', text || '—');
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', () => {
      if (capture && capture.button === b) { stop(); return; }
      stop();
      capture = { kind, apply, button: b };
      b.classList.add('waiting');
      b.textContent = '…';
      hint.textContent = kind === 'pad' ? 'Appuyez sur un bouton de la manette (Échap : annuler, ⌫ : effacer)'
        : kind === 'key' ? 'Appuyez sur une touche du PC (Échap : annuler, ⌫ : effacer)'
          : 'Appuyez sur une touche du PC ou un bouton de manette (Échap : annuler)';
    });
    return b;
  }

  function stop() {
    if (!capture) return;
    capture = null;
    render();
  }

  function joyTable() {
    const table = el('table', 'bind-table');
    const head = table.createTHead().insertRow();
    for (const h of ['', 'Clavier', 'Manette']) head.append(el('th', null, h));
    const body = table.createTBody();
    const joy = bindings.joy();
    for (const action of JOY_ACTIONS) {
      const row = body.insertRow();
      row.append(el('th', null, action.label));
      for (const kind of ['key', 'pad']) {
        const text = joy[action.id].filter(s => s.startsWith(`${kind}:`))
          .map(s => bindings.label(s).replace(/^Manette /, '')).join(' / ');
        const cell = row.insertCell();
        cell.append(captureButton(text, kind, (source, keyText) => bindings.setJoy(action.id, kind, source, keyText),
          `${action.label} de la manette du TO8 : ${kind === 'key' ? 'touche du PC' : 'bouton de manette'}`));
      }
    }
    return table;
  }

  function remapList() {
    const list = el('div', 'remap-list');
    bindings.remaps().forEach((r, i) => {
      const row = el('div', 'remap-row');
      row.append(
        captureButton(bindings.label(r.source), null, (source, keyText) => bindings.setRemapSource(i, source, keyText),
          'Touche du PC ou bouton de manette'),
        el('span', 'remap-arrow', '→'),
        keySelect(choices, r.code, `Touche du TO8 pour ${bindings.label(r.source)}`, code => bindings.setRemapCode(i, code)));
      const del = el('button', 'remap-del', '×');
      del.type = 'button';
      del.setAttribute('aria-label', 'Retirer');
      del.addEventListener('click', () => { bindings.removeRemap(i); render(); });
      row.append(del);
      list.append(row);
    });
    if (bindings.remaps().length < MAX_REMAPS) {
      const add = captureButton('', null, (source, keyText) => bindings.setRemapSource(bindings.remaps().length, source, keyText),
        'Ajouter : appuyez ensuite sur la touche du PC ou le bouton de manette');
      add.classList.add('remap-add');
      add.textContent = '+ Ajouter une touche';
      list.append(add);
    }
    return list;
  }

  function render() {
    const reset = el('button', 'keycap small', 'Rétablir les touches de jeu');
    reset.type = 'button';
    reset.addEventListener('click', () => { bindings.resetJoy(); render(); });
    hint.textContent = '';
    root.replaceChildren(
      el('p', 'bind-title', 'Manette du TO8'),
      joyTable(),
      reset,
      el('p', 'bind-title', 'Touches du TO8, pour ce jeu'),
      el('p', 'bind-note', 'Une touche du PC ou un bouton de manette frappe la touche du TO8 choisie.'),
      remapList(),
      hint);
  }

  return {
    render,
    capturing: () => capture !== null,
    /** Une touche ou un bouton vient d'être enfoncé : gardé si une case attend. */
    offer(source, keyText) {
      if (!capture) return false;
      if (source === 'key:Escape') { stop(); return true; }
      if (source === 'key:Backspace' && capture.kind) { capture.apply(null); stop(); return true; }
      if (capture.kind && !source.startsWith(`${capture.kind}:`)) return true;
      capture.apply(source, keyText);
      stop();
      return true;
    },
  };
}
