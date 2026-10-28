// Souris Thomson : la souris du PC sur l'écran, ou un pavé tactile à la place
// du stick, avec deux boutons (gauche, droit) à la place de A et B.
//
// Le TO8 ne connaît qu'une position (WebEmulator.pointer, en pixels de la
// fenêtre utile 320 × 200) ; le domaine en tire les pas de quadrature et suit
// la position que la ROM a calculée (cf. docs/agents/pointeur-to8.md). Le
// logiciel du TO8 dessine son propre curseur : celui du PC est masqué.
//
//  - souris du PC (ou stylet) sur l'écran : position absolue, boutons réels ;
//  - doigt sur l'écran : position absolue, sans clic ;
//  - pavé tactile : déplacement relatif ; une touche brève = clic gauche.

const WIDTH = 320;
const HEIGHT = 200;
const PAD_GAIN = 1.2;          // pavé traversé en largeur : 320 / 1,2 ≈ 270 pixels TO8
const TAP_MS = 250;
const TAP_SLOP = 6;            // px CSS : au-delà, c'est un glissé
const CLICK_MS = 100;          // clic d'une touche brève : tenu assez pour la ROM

/**
 * canvas : écran ; pad : élément du pavé tactile ; windowRect : fenêtre utile
 * dans l'image [gauche, haut, largeur, hauteur] en fractions (displayInfo).
 * Rend { setActive(on), active(), poll(touchButtons) → état envoyé ou null }.
 */
export function createMousePointer({ toje, canvas, pad, windowRect, onInput }) {
  const [left, top, width, height] = windowRect;
  let active = false;
  let x = WIDTH / 2;
  let y = HEIGHT / 2;
  let hostButtons = 0;         // bits : 1 gauche, 2 droit
  let tapClickUntil = 0;
  let sent = '';

  const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));

  function placeAt(e) {
    const r = canvas.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    x = clamp(Math.floor((u - left) / width * WIDTH), WIDTH);
    y = clamp(Math.floor((v - top) / height * HEIGHT), HEIGHT);
    onInput();
  }

  // Écran : souris du PC, stylet ou doigt.
  canvas.addEventListener('pointerdown', e => {
    if (!active) return;
    placeAt(e);
    if (e.pointerType !== 'touch') hostButtons = e.buttons & 3;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!active) return;
    if (e.pointerType === 'touch' && !canvas.hasPointerCapture(e.pointerId)) return;
    placeAt(e);
    if (e.pointerType !== 'touch') hostButtons = e.buttons & 3;
  });
  canvas.addEventListener('pointerup', e => {
    if (active && e.pointerType !== 'touch') hostButtons = e.buttons & 3;
  });
  canvas.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });

  // Pavé tactile : relatif, comme celui d'un portable.
  let padPointer = null;
  let last = null;
  let downAt = 0;
  let travel = 0;
  pad.addEventListener('pointerdown', e => {
    if (padPointer !== null) return;
    padPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
    downAt = performance.now();
    travel = 0;
    pad.classList.add('down');
    e.preventDefault();
  });
  pad.addEventListener('pointermove', e => {
    if (e.pointerId !== padPointer) return;
    const gain = WIDTH / (pad.getBoundingClientRect().width * PAD_GAIN);
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    travel += Math.hypot(dx, dy);
    x = clamp(x + dx * gain, WIDTH);
    y = clamp(y + dy * gain, HEIGHT);
    last = { x: e.clientX, y: e.clientY };
    onInput();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    pad.addEventListener(type, e => {
      if (e.pointerId !== padPointer) return;
      padPointer = null;
      pad.classList.remove('down');
      if (type === 'pointerup' && performance.now() - downAt < TAP_MS && travel < TAP_SLOP) {
        tapClickUntil = performance.now() + CLICK_MS;
        onInput();
      }
    });
  }

  return {
    setActive(on) {
      active = on;
      hostButtons = 0;
      sent = '';
      canvas.classList.toggle('mouse-mode', on);
    },
    active: () => active,
    /** À chaque trame : envoie la position et les boutons s'ils ont changé ; rend l'état. */
    poll(touchButtons) {
      if (!active) return null;
      const tap = performance.now() < tapClickUntil ? 1 : 0;
      const buttons = hostButtons | touchButtons | tap;
      const px = Math.round(x);
      const py = Math.round(y);
      const state = `${px},${py},${buttons}`;
      if (state !== sent) {
        sent = state;
        toje.pointer(px, py, buttons);
      }
      return state;
    },
  };
}
