// Menu des options. Au bureau, le panneau reste affiché sous l'écran ; au
// téléphone (portrait étroit ou paysage bas), il devient un tiroir ouvert par
// le bouton ☰ — sinon il tombe sous l'écran de jeu, hors d'atteinte : écran,
// manette et clavier bloquent le défilement pour ne pas gêner le jeu.

/** Branche le bouton ☰, le fond et la croix ; rend close() pour les actions ponctuelles. */
export function createMenu(toggle, panel, backdrop, closeButton) {
  function setOpen(open) {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
  }
  const close = () => setOpen(false);
  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('menu-open')));
  backdrop.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  return { close };
}
