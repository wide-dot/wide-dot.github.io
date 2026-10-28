// Touches du TO8 à côté de A et B : beaucoup de jeux se jouent en partie au
// clavier (Espace, ENT, un chiffre pour choisir une option), et ouvrir le
// clavier entier pour une touche est pénible au téléphone. Jusqu'à quatre
// boutons, chacun lié à une touche, réglés et mémorisés par jeu.
//
// Une touche peut porter SHIFT forcé (code | 0x80, cf. docs/agents/clavier-to8.md) :
// les chiffres de la rangée du haut sont shiftés sur le TO8.

const SLOTS = 4;
const MIN_HOLD = 80;                             // ms : un tap plus bref, le 6804 ne le lirait pas
const SHIFT_FORCED = 0x80;
const MODIFIERS = new Set([0x51, 0x52, 0x53]);   // SHIFT, SHIFT droit, CNT : pas des touches de jeu
const SPACE = 0x34;
const PAD_X = 563;                               // pavé numérique (ThomsonKeyLayout)
const ARROWS = new Set(['↑', '↓', '←', '→', 'INS', 'EFF', 'DEL', 'ACC']);
const GROUPS = ['Courantes', 'Flèches et édition', 'Chiffres', 'Lettres', 'Pavé numérique', 'Fonctions', 'Signes'];
const COMMON = new Set(['Espace', 'ENT', 'STOP', 'RAZ', 'CAPS LOCK']);

function groupOf(label, pad) {
  if (pad) return 'Pavé numérique';
  if (COMMON.has(label)) return 'Courantes';
  if (ARROWS.has(label)) return 'Flèches et édition';
  if (/^[0-9]$/.test(label)) return 'Chiffres';
  if (/^[A-Z]$/.test(label)) return 'Lettres';
  if (/^F\d+$/.test(label)) return 'Fonctions';
  return 'Signes';
}

/**
 * Touches proposées, depuis la disposition et les légendes du domaine :
 * [{ code, label, group }], la légende noire (sans SHIFT) puis la verte (avec).
 */
export function keyChoices(toje) {
  const geometry = toje.keyGeometry();
  const choices = [];
  const add = (code, label, pad) => {
    if (!label || choices.some(c => c.label === label && c.pad === pad)) return;
    choices.push({ code, label: pad ? `${label} (pavé)` : label, group: groupOf(label, pad), pad });
  };
  for (let i = 0; i < toje.keyCount(); i++) {
    const sc = geometry[i * 5];
    if (MODIFIERS.has(sc)) continue;
    const pad = geometry[i * 5 + 1] >= PAD_X;
    add(sc, sc === SPACE ? 'Espace' : toje.keyLegend(i), pad);
    const shifted = toje.keyShiftLegend(i);
    if (shifted && shifted !== toje.keyLegend(i)) add(sc | SHIFT_FORCED, shifted, pad);
  }
  return choices;
}

/** Liste de choix d'une touche du TO8, par groupes ; onChange(code ou null). */
export function keySelect(choices, code, label, onChange) {
  const s = document.createElement('select');
  s.className = 'key-select';
  s.setAttribute('aria-label', label);
  s.append(new Option('—', ''));
  for (const group of GROUPS) {
    const og = document.createElement('optgroup');
    og.label = group;
    for (const c of choices.filter(k => k.group === group)) og.append(new Option(c.label, String(c.code)));
    if (og.children.length) s.append(og);
  }
  s.value = code === null || code === undefined ? '' : String(code);
  s.addEventListener('change', () => onChange(s.value === '' ? null : Number(s.value)));
  return s;
}

function labelOf(choices, code) {
  const c = choices.find(k => k.code === code);
  return c ? c.label.replace(' (pavé)', '') : '?';
}

/**
 * Boutons dans `container`, réglages (quatre listes) dans `settings`.
 * press(code, down) frappe la touche ; store { get(key), set(key, value) }
 * garde les choix par jeu ; onInput() signale une action du joueur.
 * Rend { forGame(name) } : à rappeler quand le jeu change.
 */
export function createTouchKeys(container, settings, choices, press, store, onInput) {
  let game = '';
  let codes = [];

  function render() {
    container.replaceChildren(...codes.filter(c => c !== null).map(code => {
      const b = document.createElement('button');
      b.className = 'key-btn';
      b.textContent = labelOf(choices, code);
      let pressedAt = 0;
      const release = () => {
        if (!b.classList.contains('down')) return;
        b.classList.remove('down');
        setTimeout(() => press(code, false), Math.max(0, pressedAt + MIN_HOLD - performance.now()));
      };
      b.addEventListener('pointerdown', e => {
        b.setPointerCapture(e.pointerId);
        b.classList.add('down');
        pressedAt = performance.now();
        press(code, true);
        onInput();
        if (navigator.vibrate) navigator.vibrate(8);
        e.preventDefault();
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(type, release);
      return b;
    }));
    container.hidden = container.children.length === 0;
  }

  function select(slot) {
    return keySelect(choices, codes[slot], `Bouton ${slot + 1}`, code => {
      codes[slot] = code;
      store.set(`touchKeys.${game}`, codes);
      render();
    });
  }

  return {
    forGame(name) {
      game = name;
      const saved = store.get(`touchKeys.${game}`, []);
      codes = Array.from({ length: SLOTS }, (_, i) => (saved[i] ?? null));
      settings.replaceChildren(...codes.map((_, i) => select(i)));
      render();
    },
  };
}
