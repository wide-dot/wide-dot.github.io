// Capture de l'écran du TO8, aux proportions affichées : le pixel TO8 étant un
// peu plus haut que large, le canvas 704 × 464 est enregistré en 704 × 503
// (pixel 59:64, cf. WebEmulator.DISPLAY_ASPECT), comme on le voit à l'écran.

function stamp(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function saveScreenshot(canvas, aspect, title) {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = Math.round(canvas.width / aspect);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  out.toBlob(blob => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `toje-${title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${stamp(new Date())}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }, 'image/png');
}
