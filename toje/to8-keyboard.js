// Clavier du TO8 en SVG, dessiné depuis la disposition du domaine
// (ThomsonKeyLayout : 81 touches relevées sur la photo du clavier, 670 × 204)
// et ses légendes (WebKeyboard : noire sans SHIFT, verte avec).
//
// Dessin original : touches sculptées (face claire sur flanc sombre) posées
// dans des cadres noirs, bandeau d'aération et voyant CAPS LOCK. Aucune
// illustration tierce n'est reprise.
//
// Au doigt, on ne tient pas SHIFT d'une main en tapant de l'autre : SHIFT et
// CNT se verrouillent au toucher et se relâchent après la touche suivante.

const SVG = 'http://www.w3.org/2000/svg';
const MODIFIERS = new Set([0x51, 0x52, 0x53]);   // SHIFT, SHIFT droit, CNT
const CAPS_LOCK = 0x40;
const YELLOW = 0x46;                             // ENT, seule touche jaune du TO8
const PAD_X = 563;                               // pavé numérique : touches grises
const SIDE_X = 499;                              // première colonne des flèches
const F_ROW_BOTTOM = 30;                         // touches de fonction : y < 30
const SPACE_TOP = 160;                           // barre d'espace : y ≥ 160
const PRESS_DELAY = 60;                          // ms : laisse un pincement se déclarer
const MIN_HOLD = 80;                             // ms : durée minimale d'une frappe

function el(name, attrs) {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** Face supérieure d'une touche : le flanc dépasse en bas et sur les côtés. */
function face(k) {
  return { x: k.x + 3.5, y: k.y + 2, w: k.w - 7, h: k.h - 6.5 };
}

function text(x, y, value, cls) {
  const t = el('text', cls ? { x, y, class: cls } : { x, y });
  t.textContent = value;
  return t;
}

/**
 * Les légendes d'une touche, comme gravées : la verte (avec SHIFT) en haut,
 * la noire (sans SHIFT) en bas ; seule, la noire est centrée. Sur les touches
 * de fonction, trop basses, elles sont côte à côte (F6 vert, F1 noir).
 * Une légende de deux mots (CAPS LOCK) passe sur deux lignes.
 */
function legends(k) {
  const f = face(k);
  const cx = f.x + f.w / 2;
  if (k.shift && k.h < 20) {
    return [text(f.x + f.w * 0.28, f.y + f.h / 2, k.shift, 'shift'),
            text(f.x + f.w * 0.74, f.y + f.h / 2, k.legend)];
  }
  const nodes = k.shift ? [text(cx, f.y + f.h * 0.28, k.shift, 'shift')] : [];
  const words = k.legend.split(' ');
  const ledRoom = k.sc === CAPS_LOCK ? 3 : 0;      // la légende descend sous le voyant
  const baseY = k.shift ? f.y + f.h * 0.72 : f.y + f.h / 2 - (words.length - 1) * 4.5 + ledRoom;
  const black = el('text', { x: cx, y: baseY });
  words.forEach((w, n) => {
    const span = el('tspan', { x: cx, dy: n === 0 ? 0 : 9 });
    span.textContent = w;
    black.append(span);
  });
  nodes.push(black);
  return nodes;
}

function keyClass(k) {
  if (k.sc === YELLOW) return 'key yellow';
  return k.x >= PAD_X ? 'key pad' : 'key';
}

function drawKey(k) {
  const g = el('g', { class: keyClass(k), 'data-sc': k.sc });
  const f = face(k);
  g.append(el('rect', { class: 'side', x: k.x + 1, y: k.y + 1, width: k.w - 2, height: k.h - 2, rx: 3 }));
  const top = el('g', { class: 'top' });
  top.append(el('rect', { class: 'face', x: f.x, y: f.y, width: f.w, height: f.h, rx: 2 }));
  top.append(...legends(k));
  if (k.sc === CAPS_LOCK) {
    // Voyant rond en haut de la face, au-dessus de la légende CAPS LOCK.
    top.append(el('circle', { class: 'caps-led', cx: f.x + f.w / 2, cy: f.y + 3.4, r: 2.3 }));
    g.classList.add('caps-on');   // allumé à la mise sous tension, comme le TO8
  }
  g.append(top);
  return g;
}

/** Cadre noir sous un groupe de touches, comme le plateau du clavier. */
function bed(keys) {
  if (keys.length === 0) return null;
  const x = Math.min(...keys.map(k => k.x)) - 1.5;
  const y = Math.min(...keys.map(k => k.y)) - 1.5;
  const r = Math.max(...keys.map(k => k.x + k.w)) + 1.5;
  const b = Math.max(...keys.map(k => k.y + k.h)) + 1.5;
  return el('rect', { class: 'bed', x, y, width: r - x, height: b - y, rx: 3 });
}

/** Bandeau du boîtier : grilles d'aération, TO8 détouré, nom du constructeur. */
function header(width) {
  const svg = el('svg', { viewBox: `0 0 ${width} 44`, class: 'kb-head', 'aria-hidden': 'true' });
  for (let i = 0; i < 30; i++) {
    svg.append(el('rect', { class: 'vent', x: 14 + i * 14.4, y: 0, width: 4, height: 24, rx: 2 }));
  }
  svg.append(text(486, 30, 'TO8', 'badge'));
  svg.append(text(600, 30, 'THOMSON', 'maker'));
  return svg;
}

/**
 * Deux blocs, comme sur le vrai clavier : lettres à gauche, flèches et pavé
 * numérique à droite. Côte à côte quand la place le permet, empilés sur un
 * téléphone en portrait — d'un seul tenant, les touches y feraient 19 px.
 * Les deux SVG partagent la même hauteur de viewBox : à largeur
 * proportionnelle, ils ont donc la même échelle.
 *
 * Rend { setCapsLock(on) } pour allumer le voyant.
 */
export function buildKeyboard(container, toje, press) {
  const geometry = toje.keyGeometry();
  const keys = [];
  for (let i = 0; i < toje.keyCount(); i++) {
    const [sc, x, y, w, h] = geometry.subarray(i * 5, i * 5 + 5);
    keys.push({ sc, x, y, w, h, legend: toje.keyLegend(i), shift: toje.keyShiftLegend(i) });
  }
  const top = Math.min(...keys.map(k => k.y)) - 3;
  const bottom = Math.max(...keys.map(k => k.y + k.h)) + 3;
  const keysByScancode = new Map();

  container.append(header(toje.keyboardWidth()));

  function block(part, cls) {
    const left = Math.min(...part.map(k => k.x)) - 3;
    const width = Math.max(...part.map(k => k.x + k.w)) + 3 - left;
    const svg = el('svg', { viewBox: `${left} ${top} ${width} ${bottom - top}`, role: 'group', class: cls });
    const groups = [part.filter(k => k.y < F_ROW_BOTTOM),
                    part.filter(k => k.y >= F_ROW_BOTTOM && k.y < SPACE_TOP),
                    part.filter(k => k.y >= SPACE_TOP)];
    for (const g of groups) {
      const frame = bed(g);
      if (frame) svg.append(frame);
    }
    for (const k of part) {
      const g = drawKey(k);
      svg.append(g);
      keysByScancode.set(k.sc, g);
    }
    container.append(svg);
    listen(svg);
    return width;
  }

  const latched = new Set();
  const held = new Map();   // pointerId → scancode

  function releaseLatched() {
    for (const sc of latched) {
      press(sc, false);
      keysByScancode.get(sc).classList.remove('down');
    }
    latched.clear();
  }

  function down(sc) {
    if (navigator.vibrate) navigator.vibrate(6);
    const g = keysByScancode.get(sc);
    if (MODIFIERS.has(sc)) {
      const on = !latched.has(sc);
      if (on) latched.add(sc); else latched.delete(sc);
      g.classList.toggle('down', on);
      press(sc, on);
      return;
    }
    g.classList.add('down');
    press(sc, true);
  }

  function up(sc) {
    if (MODIFIERS.has(sc)) return;
    keysByScancode.get(sc).classList.remove('down');
    press(sc, false);
    releaseLatched();
  }

  // Appui différé de PRESS_DELAY : si un second doigt se pose entre-temps,
  // c'est un pincement (zoom), pas une frappe — rien n'est envoyé au TO8.
  // Un toucher plus bref que le délai est tout de même tapé, tenu MIN_HOLD
  // pour que le 6804 ait le temps de le lire.
  const pending = new Map();   // pointerId → { sc, timer }

  function cancelPending() {
    for (const p of pending.values()) clearTimeout(p.timer);
    pending.clear();
  }

  function listen(svg) {
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('g[data-sc]');
      if (!g) return;
      if (pending.size > 0) { cancelPending(); return; }   // deux doigts : pincement
      svg.setPointerCapture(e.pointerId);
      const sc = Number(g.dataset.sc);
      const timer = setTimeout(() => {
        pending.delete(e.pointerId);
        held.set(e.pointerId, sc);
        down(sc);
      }, PRESS_DELAY);
      pending.set(e.pointerId, { sc, timer });
    });
    svg.addEventListener('pointerup', e => {
      const p = pending.get(e.pointerId);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(e.pointerId);
        down(p.sc);
        setTimeout(() => up(p.sc), MIN_HOLD);
        return;
      }
      if (!held.has(e.pointerId)) return;
      up(held.get(e.pointerId));
      held.delete(e.pointerId);
    });
    svg.addEventListener('pointercancel', e => {
      const p = pending.get(e.pointerId);
      if (p) { clearTimeout(p.timer); pending.delete(e.pointerId); return; }
      if (!held.has(e.pointerId)) return;
      up(held.get(e.pointerId));
      held.delete(e.pointerId);
    });
  }

  const main = block(keys.filter(k => k.x < SIDE_X), 'kb-main');
  const side = block(keys.filter(k => k.x >= SIDE_X), 'kb-side');
  container.style.setProperty('--kb-main', main);
  container.style.setProperty('--kb-side', side);

  const capsKey = keysByScancode.get(CAPS_LOCK);
  return {
    setCapsLock(on) { capsKey.classList.toggle('caps-on', on); },
  };
}
