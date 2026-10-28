// Effet « écran cathodique », purement cosmétique : lignes de balayage et
// coins assombris, posés en calque CSS sur le canvas — l'image émulée n'est
// pas touchée. Même esprit que le shader du pilote desktop (LibGdxVideoOutput :
// onde douce indexée sur les lignes source, vignette), sans WebGL.
//
// Une bande par ligne TO8 (232 visibles, chacune sur deux rangées du canvas).
// Sous MIN_DEVICE_PX pixels physiques par ligne, les bandes tomberaient entre
// les pixels de l'écran et dessineraient des moirés : on ne garde alors que
// la vignette.

const MIN_DEVICE_PX = 2.5;

/** Rend { set(on) } ; le calque suit la taille et la position du canvas. */
export function createCrtScreen(canvas, overlay, scanLines) {
  overlay.style.setProperty('--scan-lines', String(scanLines));
  let on = false;

  function fit() {
    if (!on) return;
    overlay.style.left = `${canvas.offsetLeft}px`;
    overlay.style.top = `${canvas.offsetTop}px`;
    overlay.style.width = `${canvas.offsetWidth}px`;
    overlay.style.height = `${canvas.offsetHeight}px`;
    const devicePxPerLine = canvas.offsetHeight * devicePixelRatio / scanLines;
    overlay.classList.toggle('no-scan', devicePxPerLine < MIN_DEVICE_PX);
  }

  new ResizeObserver(fit).observe(canvas);
  // Plein écran : le canvas change de place sans toujours changer de taille.
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(fit));

  return {
    set(value) {
      on = value;
      overlay.hidden = !on;
      canvas.classList.toggle('crt', on);
      fit();
    },
  };
}
