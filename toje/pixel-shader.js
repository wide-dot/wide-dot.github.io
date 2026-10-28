// Lissage « pixel art » par couverture, en WebGL : chaque pixel de l'écran
// prend la couleur du point du TO8 qu'il couvre ; seul un pixel à cheval sur
// la frontière de deux points mêle leurs couleurs, au prorata de la surface
// couverte. Les points restent nets, leurs bords ne sont adoucis que sur un
// pixel au plus, et le rapport 59:64 reste exact. C'est le filtre des
// émulateurs (« sharp bilinear » analytique), là où agrandir puis réduire en
// bilinéaire étalait chaque bord sur plusieurs pixels (59 % de pixels gris au
// texte du menu, Pixel 7).
//
// Le calcul tient en trois lignes : la coordonnée du pixel dans la texture
// est ramenée sur la frontière la plus proche, à la largeur d'un pixel de
// l'écran près (fwidth), puis lue en filtrage linéaire.

const VERTEX = `
attribute vec2 corner;
varying vec2 uv;
void main() {
  uv = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5);   // ligne 0 de la texture en haut
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

const FRAGMENT = `
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

/**
 * Rendu WebGL de l'image width × height sur `canvas`, ou null si le
 * navigateur ne le permet pas (repli : agrandissement 2D, screen-scaler.js).
 * Rend { upload(pixels RGBA), draw() } : draw remplit tout le canvas.
 */
export function createPixelShader(canvas, width, height) {
  if (!supported()) return null;
  const gl = canvas.getContext('webgl', OPTIONS);
  if (!gl) return null;
  gl.getExtension('OES_standard_derivatives');
  try {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, 'corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'size'), width, height);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  } catch (e) {
    console.warn('lissage WebGL indisponible', e);
    return null;
  }
  return {
    upload(pixels) {
      const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    },
    draw() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
