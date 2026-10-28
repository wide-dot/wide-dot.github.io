// Mise à l'échelle de l'écran du TO8, nette et régulière (« sharp bilinear »).
//
// Agrandie d'un facteur non entier en « plus proche voisin », l'image donnait à
// des points égaux 1 pixel ou 2 selon leur place : sur un téléphone, 704 points
// tombent sur ~890 pixels réels, et le texte du menu paraissait inégal. Un
// facteur entier pur est impossible : la correction 59:64 rend le facteur
// vertical fractionnaire de toute façon.
//
// D'où deux temps. L'image est recopiée, en plus proche voisin, à un multiple
// ENTIER de sa taille, juste au-dessus de la taille affichée en pixels réels :
// tous les points y sont égaux. Le navigateur réduit ensuite ce canvas à la
// taille affichée, avec lissage : chaque point garde sa largeur, seul son bord
// est adouci sur un pixel. Mesuré par src/test/node/sharpness-check.cjs.

const SLACK = 0.02;   // 1408 pixels pour 704 points : facteur 2, pas 3

export function createScreenScaler(canvas, width, height) {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext('2d');
  const image = sourceCtx.createImageData(width, height);
  const ctx = canvas.getContext('2d');

  function redraw() {
    ctx.imageSmoothingEnabled = false;   // l'agrandissement entier reste en plus proche voisin
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }

  /** Taille affichée en pixels réels → multiple entier du canvas, juste au-dessus. */
  function fit(deviceWidth, deviceHeight) {
    const fx = Math.max(1, Math.ceil(deviceWidth / width - SLACK));
    const fy = Math.max(1, Math.ceil(deviceHeight / height - SLACK));
    if (canvas.width === width * fx && canvas.height === height * fy) return;
    canvas.width = width * fx;           // redimensionner efface le canvas : on repeint
    canvas.height = height * fy;
    redraw();
  }

  const observer = new ResizeObserver(entries => {
    const entry = entries[0];
    const box = entry.devicePixelContentBoxSize && entry.devicePixelContentBoxSize[0];
    if (box) fit(box.inlineSize, box.blockSize);
    else fit(entry.contentRect.width * devicePixelRatio, entry.contentRect.height * devicePixelRatio);
  });
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas);            // Safari : pas de taille en pixels réels, on la déduit
  }

  return {
    /** L'image du TO8 à sa taille d'origine (704 × 464), pour une capture. */
    source,
    /** Une trame : pixels RGBA du wasm. */
    draw(pixels) {
      image.data.set(pixels);
      sourceCtx.putImageData(image, 0, 0);
      redraw();
    },
  };
}
