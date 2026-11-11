// Volume général : bouton haut-parleur de l'en-tête (clic = couper/rétablir,
// molette = un pas), réglette et boutons −/＋ du menu, F8/F9 au clavier.
// Le niveau est appliqué par le domaine (MasterVolume, via WebEmulator) : pas,
// bornes et courbe n'ont qu'une définition, partagée avec le pilote desktop.
// La page ne fait que retenir le réglage (préférences « volume », « volumeMuted »).

/**
 * `els` : { quick, quickLabel, slider, level, down, up } ; `onChange(texte)`
 * reçoit un compte rendu après chaque geste (ligne d'état).
 */
export function createVolumeControl(toje, prefs, els, onChange = () => {}) {
  let percent = Math.max(0, Math.min(100, Number(prefs.get('volume', 100)) || 0));
  let muted = prefs.get('volumeMuted', false) === true;

  function describe() {
    return muted ? 'son coupé' : `volume ${percent} %`;
  }

  function apply(report) {
    toje.setVolume(percent, muted);
    prefs.set('volume', percent);
    prefs.set('volumeMuted', muted);
    els.quick.dataset.muted = String(muted);
    els.quick.setAttribute('aria-pressed', String(muted));
    els.quick.title = muted
      ? 'Son coupé — cliquer pour le rétablir (F9 monte)'
      : `Volume ${percent} % — cliquer pour couper ; F8 baisse, F9 monte`;
    els.quickLabel.textContent = muted ? 'Muet' : `${percent} %`;
    els.slider.value = String(percent);
    els.level.textContent = muted ? 'muet' : `${percent} %`;
    els.down.disabled = percent === 0;
    els.up.disabled = percent === 100 && !muted;
    if (report) onChange(describe());
  }

  /** Un pas : +1 monte (et rétablit le son coupé), -1 baisse. */
  function step(direction) {
    const r = toje.stepVolume(direction);
    muted = r < 0;
    percent = muted ? -1 - r : r;
    apply(true);
  }

  function toggleMute() {
    muted = !muted;
    apply(true);
  }

  els.quick.addEventListener('click', toggleMute);
  els.quick.addEventListener('wheel', e => {
    e.preventDefault();
    step(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  els.slider.addEventListener('input', () => {
    percent = Number(els.slider.value);
    muted = false;
    apply(true);
  });
  els.down.addEventListener('click', () => step(-1));
  els.up.addEventListener('click', () => step(1));

  apply(false);
  return { step, toggleMute, describe };
}
