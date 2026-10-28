// Ce que font les touches du PC et les boutons des manettes : jouer à la
// manette du TO8, ou frapper une touche du TO8.
//
// Une « source » est une chaîne : « key:<KeyboardEvent.code> » (position
// physique, indépendante de la disposition) ou « pad:<n° de bouton> ».
//
// Deux réglages :
//  - la manette du TO8 (global) : pour chaque action — quatre directions et
//    deux boutons — les sources qui la déclenchent. Le stick gauche d'une
//    manette dirige toujours, en plus ;
//  - les touches du TO8 (par jeu) : source → code de touche TO8, SHIFT forcé
//    compris (code | $80, cf. docs/agents/clavier-to8.md). Une source ainsi
//    redirigée ne joue plus à la manette : la règle propre au jeu l'emporte.

export const JOY_ACTIONS = [
  { id: 'up', label: 'Haut' },
  { id: 'down', label: 'Bas' },
  { id: 'left', label: 'Gauche' },
  { id: 'right', label: 'Droite' },
  { id: 'a', label: 'Bouton A' },
  { id: 'b', label: 'Bouton B' },
];

// Disposition « standard » de la Gamepad API : 0-3 boutons de face, 12-15 croix.
const DEFAULT_JOY = {
  up: ['key:ArrowUp', 'pad:12'],
  down: ['key:ArrowDown', 'pad:13'],
  left: ['key:ArrowLeft', 'pad:14'],
  right: ['key:ArrowRight', 'pad:15'],
  a: ['key:Space', 'pad:0', 'pad:2'],
  b: ['key:AltLeft', 'key:AltRight', 'pad:1', 'pad:3'],
};

export const MAX_REMAPS = 8;

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3',
  '↑', '↓', '←', '→', 'Home'];
const KEY_NAMES = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espace', Enter: 'Entrée',
  NumpadEnter: 'Entrée (pavé)', AltLeft: 'Alt', AltRight: 'Alt Gr', ShiftLeft: 'Maj', ShiftRight: 'Maj droite',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl droite', Tab: 'Tab', Backspace: '⌫', Escape: 'Échap',
  CapsLock: 'Verr. maj', Delete: 'Suppr', Insert: 'Inser', Home: 'Début', End: 'Fin',
  PageUp: 'Page ↑', PageDown: 'Page ↓', MetaLeft: 'Méta', MetaRight: 'Méta droite',
};

/** Libellé lisible d'une source ; `keyText` = e.key relevé à la capture, s'il y en a un. */
export function sourceLabel(source, keyText) {
  const [kind, id] = source.split(':');
  if (kind === 'pad') return `Manette ${PAD_NAMES[Number(id)] || `bouton ${id}`}`;
  if (keyText && keyText.trim().length === 1) return keyText.toUpperCase();
  if (KEY_NAMES[id]) return KEY_NAMES[id];
  const m = /^(?:Key|Digit)(.)$/.exec(id) || /^Numpad(.+)$/.exec(id);
  if (m) return id.startsWith('Numpad') ? `${m[1]} (pavé)` : m[1];
  return id;
}

/**
 * Réglages persistés dans `prefs` ({ get, set }). Rend l'objet que lisent la
 * boucle (joyOf, remapOf) et le panneau (joy, remaps, …).
 */
export function createBindings(prefs) {
  let joy = load();
  let game = '';
  let remaps = [];          // [{ source, label, code }]
  let labels = prefs.get('bindings.labels', {});   // source clavier → e.key relevé

  function load() {
    const saved = prefs.get('bindings.joy', null);
    const out = {};
    for (const { id } of JOY_ACTIONS) out[id] = [...((saved && saved[id]) || DEFAULT_JOY[id])];
    return out;
  }
  const saveJoy = () => prefs.set('bindings.joy', joy);
  const saveRemaps = () => prefs.set(`keyMap.${game}`, remaps);

  // Une source ne fait qu'une chose : la poser ailleurs la retire de partout.
  function release(source) {
    for (const id of Object.keys(joy)) joy[id] = joy[id].filter(s => s !== source);
    remaps = remaps.filter(r => r.source !== source);
  }

  return {
    label: source => sourceLabel(source, labels[source]),
    forGame(name) {
      game = name;
      remaps = prefs.get(`keyMap.${game}`, []).filter(r => r && r.source).slice(0, MAX_REMAPS);
    },
    joy: () => joy,
    remaps: () => remaps,

    /** Action de manette TO8 de `source` ({ id }) ou null ; une redirection du jeu l'emporte. */
    joyOf(source) {
      if (remaps.some(r => r.source === source)) return null;
      return JOY_ACTIONS.find(({ id }) => joy[id].includes(source)) || null;
    },
    /** Code de touche TO8 auquel le jeu redirige `source`, ou null. */
    remapOf(source) {
      const r = remaps.find(x => x.source === source);
      return r && r.code !== null ? r.code : null;
    },

    /** La seule source, du clavier (kind 'key') ou de la manette ('pad'), de l'action `id`. */
    setJoy(id, kind, source, keyText) {
      if (source) { release(source); remember(source, keyText); }
      joy[id] = joy[id].filter(s => !s.startsWith(`${kind}:`));
      if (source) joy[id].push(source);
      saveJoy(); saveRemaps();
    },
    setRemapSource(index, source, keyText) {
      const current = remaps[index];
      const code = current ? current.code : null;
      release(source);
      remember(source, keyText);
      remaps = remaps.filter(r => r !== current);
      remaps.splice(Math.min(index, remaps.length), 0, { source, code });
      saveJoy(); saveRemaps();
    },
    setRemapCode(index, code) {
      if (!remaps[index]) return;
      remaps[index].code = code;
      saveRemaps();
    },
    removeRemap(index) {
      remaps.splice(index, 1);
      saveRemaps();
    },
    resetJoy() {
      joy = {};
      for (const { id } of JOY_ACTIONS) joy[id] = [...DEFAULT_JOY[id]];
      saveJoy();
    },
  };

  function remember(source, keyText) {
    if (!source.startsWith('key:') || !keyText) return;
    labels[source] = keyText;
    prefs.set('bindings.labels', labels);
  }
}
