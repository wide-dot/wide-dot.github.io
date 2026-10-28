// Rendu WebGL de l'écran du TO8, deux réglages.
//
// Lissé — par couverture : chaque pixel de l'écran prend la couleur du point
// du TO8 qu'il couvre ; seul un pixel à cheval sur la frontière de deux
// points mêle leurs couleurs, au prorata de la surface couverte. Bords adoucis
// sur un pixel au plus, rapport 59:64 exact. Là où agrandir puis réduire en
// bilinéaire étalait chaque bord dans un halo flou. Le calcul tient en trois
// lignes : la coordonnée dans la texture est ramenée sur la frontière la plus
// proche, à la largeur d'un pixel de l'écran près (fwidth), puis lue en
// filtrage linéaire.
//
// Adouci — agrandissement puis lissage : Scale2x (EPX) deux fois, soit ×4, sur
// la grille des points du TO8, puis le même filtre par couverture jusqu'à la
// taille de l'écran. Scale2x arrondit les diagonales et les courbes sans
// inventer de couleur (il ne recopie que des voisins). Il travaille sur la
// grille des points réels, mesurée à chaque trame (pointWidth) : 4 pixels de
// canvas par point en 160 points (16 couleurs, Goldorak), grille 176 × 232 ;
// 2 en 320 points, grille 352 × 232 ; 1 en 640 points (80 colonnes) — un point
// n'a plus qu'un pixel de large, Scale2x déformerait les lettres, l'image est
// rendue « Lissé ».

const SCREEN_VERTEX = `
attribute vec2 corner;
varying vec2 uv;
void main() {
  uv = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5);   // ligne 0 de la texture en haut
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

// Rendu dans une texture : la ligne 0 du résultat est sa ligne 0, comme à l'entrée.
const TEXTURE_VERTEX = `
attribute vec2 corner;
varying vec2 uv;
void main() {
  uv = corner * 0.5 + 0.5;
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

const COVERAGE = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D image;
uniform vec2 size;
varying vec2 uv;
void main() {
  vec2 pix = uv * size;
  vec2 seam = floor(pix + 0.5);
  pix = seam + clamp((pix - seam) / fwidth(pix), -0.5, 0.5);
  gl_FragColor = texture2D(image, pix / size);
}`;

// Scale2x : chaque point devient quatre, chacun repris d'un voisin quand deux
// voisins qui l'encadrent sont égaux (et les deux autres différents).
const SCALE2X = `
precision highp float;
uniform sampler2D image;
uniform vec2 grid;      // points de l'entrée
uniform vec2 stride;    // pixels de la texture d'entrée par point
uniform vec2 texSize;   // taille de la texture d'entrée
varying vec2 uv;
vec4 at(vec2 n) {
  n = clamp(n, vec2(0.0), grid - 1.0);
  return texture2D(image, (n * stride + 0.5) / texSize);
}
void main() {
  vec2 o = floor(uv * grid * 2.0);
  vec2 p = floor(o * 0.5);
  vec2 q = o - p * 2.0;
  vec4 P = at(p);
  vec4 A = at(p + vec2(0.0, -1.0));
  vec4 B = at(p + vec2(1.0, 0.0));
  vec4 C = at(p + vec2(-1.0, 0.0));
  vec4 D = at(p + vec2(0.0, 1.0));
  vec4 r = P;
  if (q.y < 0.5) {
    if (q.x < 0.5) { if (C == A && C != D && A != B) r = A; }
    else           { if (A == B && A != C && B != D) r = B; }
  } else {
    if (q.x < 0.5) { if (D == C && D != B && C != A) r = C; }
    else           { if (B == D && B != A && D != C) r = D; }
  }
  gl_FragColor = r;
}`;

const OPTIONS = { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true };

/** Le navigateur sait-il ? Essayé sur un canvas jetable : un canvas pris en WebGL ne revient plus en 2D. */
function supported() {
  const probe = document.createElement('canvas').getContext('webgl', OPTIONS);
  if (!probe) return false;
  const ok = Boolean(probe.getExtension('OES_standard_derivatives'))
    && probe.getShaderPrecisionFormat(probe.FRAGMENT_SHADER, probe.HIGH_FLOAT).precision > 0;
  const lose = probe.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
  return ok;
}

function compile(gl, type, text) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, text);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function program(gl, vertex, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(p, 0, 'corner');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function texture(gl, w, h, filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return t;
}

/** Texture rendue par une passe : { tex, fbo, w, h }. */
function target(gl, w, h, filter) {
  const tex = texture(gl, w, h, filter);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) throw new Error(`texture de rendu ${w} × ${h} refusée`);
  return { tex, fbo, w, h };
}

/**
 * Rendu WebGL de l'image width × height (lignes doublées : deux rangées par
 * ligne du TO8) sur `canvas`, ou null si le navigateur ne le permet pas
 * (repli : agrandissement 2D, screen-scaler.js).
 * Rend { upload(pixels RGBA), setSoft(on), draw() } : draw remplit tout le canvas.
 */
export function createPixelShader(canvas, width, height) {
  if (!supported()) return null;
  const gl = canvas.getContext('webgl', OPTIONS);
  if (!gl) return null;
  gl.getExtension('OES_standard_derivatives');
  let coverage;
  let scale2x;
  let upload;
  const stages = {};      // largeur d'un point (2, 4) → { x2, x4 } : textures de rendu
  try {
    coverage = program(gl, SCREEN_VERTEX, COVERAGE);
    scale2x = program(gl, TEXTURE_VERTEX, SCALE2X);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    upload = texture(gl, width, height, gl.LINEAR);
    for (const k of [2, 4]) {
      const grid = [width / k, height / 2];
      stages[k] = { x2: target(gl, grid[0] * 2, grid[1] * 2, gl.NEAREST),
                    x4: target(gl, grid[0] * 4, grid[1] * 4, gl.LINEAR) };
    }
  } catch (e) {
    console.warn('rendu WebGL indisponible', e);
    return null;
  }

  let soft = false;
  let point = 1;           // pixels de canvas par point dans la trame courante (1, 2, 4)

  function pass(input, inputSize, stride, out) {
    gl.useProgram(scale2x);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, out.w, out.h);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.uniform2f(gl.getUniformLocation(scale2x, 'grid'), out.w / 2, out.h / 2);
    gl.uniform2f(gl.getUniformLocation(scale2x, 'stride'), stride[0], stride[1]);
    gl.uniform2f(gl.getUniformLocation(scale2x, 'texSize'), inputSize[0], inputSize[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function toScreen(input, w, h) {
    gl.useProgram(coverage);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.uniform2f(gl.getUniformLocation(coverage, 'size'), w, h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return {
    upload(pixels) {
      const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      gl.bindTexture(gl.TEXTURE_2D, upload);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      point = pointWidth(pixels, width, height);   // toujours : changer de rendu en pause doit valoir
    },
    setSoft(on) { soft = on; },
    /** Rendu adouci en cours (sinon lissé) : Adouci choisi et points d'au moins deux pixels. */
    softening: () => soft && point > 1,
    draw() {
      if (soft && point > 1) {
        const { x2, x4 } = stages[point];
        pass(upload, [width, height], [point, 2], x2);  // grille des points → ×2
        pass(x2.tex, [x2.w, x2.h], [1, 1], x4);         // → ×4
        toScreen(x4.tex, x4.w, x4.h);
      } else {
        toScreen(upload, width, height);
      }
    },
  };
}

/**
 * Largeur d'un point en pixels de canvas : 4 si chaque groupe de quatre
 * pixels côte à côte est d'une seule couleur (160 points de large), 2 pour
 * chaque paire (320), sinon 1 (640, 80 colonnes). Une ligne sur deux suffit :
 * chaque ligne du TO8 couvre deux rangées.
 */
function pointWidth(pixels, width, height) {
  const px = new Int32Array(pixels.buffer, pixels.byteOffset, width * height);
  let k = 4;
  for (let y = 0; y < height && k > 1; y += 2) {
    for (let i = y * width, end = i + width; i < end; i += 4) {
      if (px[i] !== px[i + 1] || px[i + 2] !== px[i + 3]) return 1;
      if (k === 4 && px[i] !== px[i + 2]) k = 2;
    }
  }
  return k;
}
