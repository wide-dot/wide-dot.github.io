import { createPixelShader } from './pixel-shader.js';

// Mise à l'échelle de l'écran du TO8.
//
// Lissé (par défaut) : pixel-shader.js, en WebGL — le canvas a la taille
// exacte de l'affichage en pixels réels, et chaque pixel prend la couleur du
// point qu'il couvre, les seuls pixels à cheval sur deux points les mêlant au
// prorata. Proportions 59:64 exactes, bords adoucis sur un pixel au plus.
//
// Sans WebGL, repli en 2D : l'image est recopiée en plus proche voisin à un
// multiple entier de sa taille, juste au-dessus de l'affichage, et le
// navigateur la réduit avec lissage — points égaux, mais bords plus flous.
// Mesuré par src/test/node/sharpness-check.cjs.
//
// « Pixels nets » (setPixelPerfect) : chaque point du TO8 couvre un nombre
// ENTIER de pixels réels, en largeur et en hauteur, sans aucun lissage — le
// vrai « pixel perfect ». Le prix : la hauteur, arrondie au plus près du
// rapport 59:64, rend les points presque carrés (comme « Pixels carrés » du
// pilote et comme teo-wd), et l'image est un peu plus petite que la place.

const SLACK = 0.02;   // 1408 pixels pour 704 points : facteur 2, pas 3
const PHONE_WIDTH = 760;   // même seuil que la mise en page téléphone (toje-web.css)
const EDGE = 4;            // px CSS laissés de part et d'autre

export function createScreenScaler(canvas, width, height, aspect) {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext('2d');
  const image = sourceCtx.createImageData(width, height);
  const shader = createPixelShader(canvas, width, height);
  const ctx = shader ? null : canvas.getContext('2d');

  function redraw() {
    if (shader) { shader.draw(); return; }
    ctx.imageSmoothingEnabled = false;   // l'agrandissement entier reste en plus proche voisin
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }

  let perfect = false;

  /**
   * Pixels nets : la place que la mise en page donne à l'écran (mesurée sans
   * nos tailles imposées), puis le plus grand nombre entier de pixels réels
   * par point du TO8 qui y tient — largeur wx, hauteur wy au plus près de
   * wx × 64/59. Le canvas a exactement cette taille, en pixels réels.
   */
  function fitPerfect() {
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.marginLeft = '';
    canvas.style.marginRight = '';
    const r = canvas.getBoundingClientRect();
    const dpr = devicePixelRatio;
    const cols = width / 2;                  // points du TO8 : deux pixels de canvas chacun
    const rows = height / 2;
    const tall = width / height / aspect;    // hauteur d'un point / sa largeur : 64/59
    let wx = Math.max(1, Math.floor(r.width * dpr / cols));
    let wy = Math.max(1, Math.round(wx * tall));
    while (rows * wy > r.height * dpr + 0.5 && wx > 1) {
      wx--;
      wy = Math.max(1, Math.round(wx * tall));
    }
    // Téléphone en portrait : l'écran prend toute la largeur ; s'il gagne un
    // facteur en mordant sur les marges du boîtier (Pixel 7 : 1056 pixels sur
    // 1080, au lieu de 704), il les prend.
    const portraitPhone = innerWidth <= PHONE_WIDTH && r.width >= 0.85 * innerWidth;
    if (portraitPhone && cols * (wx + 1) / dpr <= innerWidth - EDGE) {
      wx++;
      wy = Math.max(1, Math.round(wx * tall));
    }
    if (canvas.width !== cols * wx || canvas.height !== rows * wy) {
      canvas.width = cols * wx;
      canvas.height = rows * wy;
    }
    canvas.style.width = `${cols * wx / dpr}px`;
    canvas.style.height = `${rows * wy / dpr}px`;
    const overflow = Math.max(0, cols * wx / dpr - r.width) / 2;
    canvas.style.marginLeft = overflow ? `${-overflow}px` : '';
    canvas.style.marginRight = overflow ? `${-overflow}px` : '';
    canvas.parentElement.classList.toggle('bleed', overflow > 0);   // cadre retiré : bord à bord
    redraw();
  }

  let pending = false;
  function refit() {
    if (!perfect || pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; if (perfect) fitPerfect(); });
  }
  addEventListener('resize', refit);
  document.addEventListener('fullscreenchange', refit);
  // Manette, clavier, menu : la place de l'écran change sans que la fenêtre change.
  new MutationObserver(refit).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /** Taille affichée en pixels réels → canvas à cette taille (WebGL), ou multiple entier juste au-dessus (2D). */
  let lastBox = [width, height];
  function fit(deviceWidth, deviceHeight) {
    lastBox = [deviceWidth, deviceHeight];
    if (perfect) return;
    if (shader) {
      if (canvas.width === deviceWidth && canvas.height === deviceHeight) return;
      canvas.width = deviceWidth;
      canvas.height = deviceHeight;
      redraw();
      return;
    }
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
    // Taille en pixels réels ; déduite de la taille CSS quand le navigateur ne
    // la donne pas (Safari) ou la donne en pixels CSS (Chromium émulé).
    const w = Math.round(entry.contentRect.width * devicePixelRatio);
    const h = Math.round(entry.contentRect.height * devicePixelRatio);
    fit(Math.max(w, box ? box.inlineSize : 0), Math.max(h, box ? box.blockSize : 0));
  });
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas);            // Safari : pas de taille en pixels réels, on la déduit
  }

  return {
    /** Pixels nets (entiers, sans lissage) ou agrandissement lissé aux proportions exactes. */
    setPixelPerfect(on) {
      perfect = on;
      canvas.classList.toggle('pixel-perfect', on);
      if (on) { fitPerfect(); return; }
      canvas.style.width = '';
      canvas.style.height = '';
      canvas.style.marginLeft = '';
      canvas.style.marginRight = '';
      canvas.parentElement.classList.remove('bleed');
      // L'observateur reprend la main si la taille change ; sinon, la dernière mesure.
      canvas.width = 0;
      fit(...lastBox);
    },
    /** Lissage WebGL actif (sinon repli 2D). */
    webgl: Boolean(shader),
    /** L'image du TO8 à sa taille d'origine (704 × 464) : capture, vignettes, recettes. */
    source,
    /** Une trame : pixels RGBA du wasm. */
    draw(pixels) {
      image.data.set(pixels);
      sourceCtx.putImageData(image, 0, 0);
      if (shader) shader.upload(pixels);
      redraw();
    },
  };
}
