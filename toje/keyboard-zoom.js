// Loupe du clavier à l'écran : boutons −/＋ (100 % à 250 %) et réglette de
// déplacement quand le clavier agrandi dépasse la largeur. Le pincement à deux
// doigts reste possible en plus (zoom de la page, cf. to8-keyboard.js).

const STEPS = [1, 1.25, 1.5, 2, 2.5];

function button(label, title) {
  const b = document.createElement('button');
  b.className = 'kb-zoom-btn';
  b.textContent = label;
  b.title = title;
  b.type = 'button';
  return b;
}

/**
 * Prépare la section du clavier : barre de zoom, fenêtre défilante, et rend
 * l'élément où dessiner les touches. `initial` et `onChange` portent le
 * niveau mémorisé.
 */
export function createKeyboardZoom(section, initial, onChange) {
  const bar = document.createElement('div');
  bar.className = 'kb-zoom';
  const minus = button('−', 'Réduire le clavier');
  const level = document.createElement('span');
  level.className = 'kb-zoom-level';
  const plus = button('+', 'Agrandir le clavier');
  const pan = document.createElement('input');
  pan.type = 'range';
  pan.min = '0';
  pan.max = '1000';
  pan.value = '500';
  pan.className = 'kb-pan';
  pan.setAttribute('aria-label', 'Déplacer le clavier agrandi');
  bar.append(minus, level, plus, pan);

  const viewport = document.createElement('div');
  viewport.className = 'kb-viewport';
  const inner = document.createElement('div');
  inner.className = 'kb-inner';
  viewport.append(inner);
  section.append(bar, viewport);

  let index = Math.max(0, STEPS.indexOf(initial));

  function overflow() {
    return viewport.scrollWidth - viewport.clientWidth;
  }

  function syncPan() {
    const max = overflow();
    pan.hidden = max <= 1;
    if (max > 1) pan.value = String(Math.round(viewport.scrollLeft / max * 1000));
  }

  function apply(keepCenter) {
    const center = (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(1, viewport.scrollWidth);
    section.style.setProperty('--kb-zoom', STEPS[index]);
    level.textContent = `${Math.round(STEPS[index] * 100)} %`;
    minus.disabled = index === 0;
    plus.disabled = index === STEPS.length - 1;
    // Garder sous les yeux la zone qu'on regardait, plutôt que revenir au bord gauche.
    if (keepCenter) viewport.scrollLeft = center * viewport.scrollWidth - viewport.clientWidth / 2;
    syncPan();
  }

  minus.addEventListener('click', () => { index = Math.max(0, index - 1); apply(true); onChange(STEPS[index]); });
  plus.addEventListener('click', () => { index = Math.min(STEPS.length - 1, index + 1); apply(true); onChange(STEPS[index]); });
  pan.addEventListener('input', () => { viewport.scrollLeft = Number(pan.value) / 1000 * overflow(); });
  viewport.addEventListener('scroll', syncPan, { passive: true });
  window.addEventListener('resize', syncPan);

  return { inner, refresh: () => apply(false) };
}
