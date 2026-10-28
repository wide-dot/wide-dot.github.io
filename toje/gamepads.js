// Manettes réelles (USB, Bluetooth) par la Gamepad API.
//
// Le navigateur ne montre une manette qu'après qu'on a appuyé sur l'un de ses
// boutons, page ouverte : c'est une protection contre le pistage, pas une
// panne. La première manette branchée joue sur le port choisi, la seconde sur
// l'autre — deux joueurs sans réglage.

const AXIS_DEAD_ZONE = 0.5;

/** Nom lisible : « Xbox 360 Controller (XInput STANDARD GAMEPAD) » → « Xbox 360 Controller ». */
export function padName(id) {
  const name = String(id || '')
    .replace(/\s*\((?:[^()]*(?:Vendor|STANDARD GAMEPAD|XInput)[^()]*)\)\s*/gi, ' ')
    .replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '')           // préfixe vendeur-produit de Firefox
    .trim();
  return name || 'Manette';
}

/** Manettes branchées, dans l'ordre de branchement. */
export function connectedPads() {
  if (!navigator.getGamepads) return [];
  return [...navigator.getGamepads()].filter(p => p && p.connected);
}

/**
 * État d'une manette pour le TO8 : { dirs, a, b, pressed }. `joyOf(source)`
 * dit quelle action de manette TO8 déclenche un bouton (input-bindings.js) ;
 * le stick gauche dirige toujours. `pressed` = numéros des boutons enfoncés.
 */
export function readPad(pad, joyOf, JOY) {
  const state = { dirs: 0, a: false, b: false, pressed: [] };
  pad.buttons.forEach((button, i) => {
    if (!button || !button.pressed) return;
    state.pressed.push(i);
    const action = joyOf(`pad:${i}`);
    if (!action) return;
    if (action.id === 'a' || action.id === 'b') state[action.id] = true;
    else state.dirs |= JOY[action.id];
  });
  const ax = pad.axes[0] || 0;
  const ay = pad.axes[1] || 0;
  if (ax < -AXIS_DEAD_ZONE) state.dirs |= JOY.left;
  else if (ax > AXIS_DEAD_ZONE) state.dirs |= JOY.right;
  if (ay < -AXIS_DEAD_ZONE) state.dirs |= JOY.up;
  else if (ay > AXIS_DEAD_ZONE) state.dirs |= JOY.down;
  // Gauche et droite à la fois (croix et stick contraires) : aucune des deux.
  if ((state.dirs & (JOY.left | JOY.right)) === (JOY.left | JOY.right)) state.dirs &= ~(JOY.left | JOY.right);
  if ((state.dirs & (JOY.up | JOY.down)) === (JOY.up | JOY.down)) state.dirs &= ~(JOY.up | JOY.down);
  return state;
}
