// Manette tactile : un stick à gauche, deux boutons à droite, en multi-touch.
//
// Le stick ne donne que des directions tout-ou-rien, comme une manette TO8
// (quatre contacts) : l'angle du doigt est réduit à huit secteurs, avec une
// zone morte au centre pour qu'un pouce posé ne fasse pas bouger le vaisseau.

const DEAD_ZONE = 0.28;            // fraction du rayon
const SECTOR = Math.PI / 8;        // demi-secteur de 45°

/** Directions de l'angle a (radians, 0 = droite, y vers le bas), bits JOY. */
function directionsOf(a, joy) {
  let dirs = 0;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // Une composante compte dès que l'angle sort du secteur de l'autre axe (±67,5°).
  if (c > Math.sin(SECTOR)) dirs |= joy.right;
  if (c < -Math.sin(SECTOR)) dirs |= joy.left;
  if (s > Math.sin(SECTOR)) dirs |= joy.down;
  if (s < -Math.sin(SECTOR)) dirs |= joy.up;
  return dirs;
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(8);
}

/**
 * Branche le stick et les boutons ; `state()` rend l'état courant
 * { dirs, a, b }, lu à chaque trame par la boucle.
 */
export function createTouchPad(stickEl, fireEl, joy) {
  const state = { dirs: 0, a: false, b: false };
  const base = stickEl.querySelector('.stick-base');
  const knob = stickEl.querySelector('.stick-knob');
  let stickPointer = null;

  function moveStick(e) {
    const r = base.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = e.clientX - (r.left + radius);
    let dy = e.clientY - (r.top + radius);
    const dist = Math.hypot(dx, dy);
    if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const dirs = dist < radius * DEAD_ZONE ? 0 : directionsOf(Math.atan2(dy, dx), joy);
    if (dirs !== state.dirs && dirs !== 0) vibrate();
    state.dirs = dirs;
  }

  function releaseStick() {
    stickPointer = null;
    state.dirs = 0;
    knob.style.transform = '';
  }

  stickEl.addEventListener('pointerdown', e => {
    if (stickPointer !== null) return;
    stickPointer = e.pointerId;
    stickEl.setPointerCapture(e.pointerId);
    moveStick(e);
    e.preventDefault();
  });
  stickEl.addEventListener('pointermove', e => {
    if (e.pointerId === stickPointer) moveStick(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stickEl.addEventListener(type, e => { if (e.pointerId === stickPointer) releaseStick(); });
  }

  for (const btn of fireEl.querySelectorAll('.fire-btn')) {
    const which = btn.dataset.fire;
    btn.addEventListener('pointerdown', e => {
      btn.setPointerCapture(e.pointerId);
      state[which] = true;
      btn.classList.add('down');
      vibrate();
      e.preventDefault();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      btn.addEventListener(type, () => { state[which] = false; btn.classList.remove('down'); });
    }
  }

  return {
    state: () => state,
    reset: () => { releaseStick(); state.a = false; state.b = false; },
  };
}
