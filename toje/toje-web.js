// TOJE dans le navigateur : boucle, image, son et entrées autour du wasm (WebMain).
//
// Pacing : le son est l'horloge maître, comme sur le pilote desktop. Tant que
// moins de AUDIO_LEAD secondes d'audio sont programmées, on exécute une trame
// (20 ms émulées, 882 échantillons). Sans son — le navigateur exige un geste
// de l'utilisateur pour ouvrir l'AudioContext — on se cale sur performance.now().
import { createTouchPad } from './touch-pad.js';
import { buildKeyboard } from './to8-keyboard.js';
import { createKeyboardZoom } from './keyboard-zoom.js';
import { createMenu } from './menu.js';
import { createLibrary, formatOf } from './library.js';
import { BUILD } from './build-info.js';
import { createCrtScreen } from './crt-screen.js';
import { openSaveStore } from './save-store.js';
import { createGameSaves } from './game-saves.js';
import { createTouchKeys, keyChoices } from './touch-keys.js';
import { titleOf, baseName } from './titles.js';
import { createDiskCopies } from './disk-copies.js';
import { saveScreenshot } from './screenshot.js';

const FRAME_SECONDS = 0.02;
const AUDIO_LEAD = 0.08;          // ~4 trames d'avance : assez pour absorber un rAF en retard
const MAX_FRAMES_PER_TICK = 8;    // onglet revenu au premier plan : on ne rattrape pas tout
const JOY = { left: 1, right: 2, up: 4, down: 8 };   // IoHandler.JOYSTICK_*

const $ = id => document.getElementById(id);
const canvas = $('screen');
const ctx2d = canvas.getContext('2d');
const status = $('status');
const coarsePointer = matchMedia('(pointer: coarse)').matches;

// Réglages de confort du visiteur, dans son navigateur seulement.
const prefs = {
  get(key, fallback) {
    try { const v = localStorage.getItem(`toje.${key}`); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`toje.${key}`, JSON.stringify(value)); } catch { /* stockage indisponible */ }
  },
};

async function loadEmulator() {
  try {
    const teavm = await TeaVM.wasmGC.load(`toje.wasm?v=${BUILD.commit}`);   // même génération que la page
    teavm.exports.main([]);
    return teavm.exports;
  } catch (e) {
    // Deux causes courantes, à distinguer : fichiers absents (page ouverte en
    // file://, wasm non construit) ou navigateur trop ancien pour Wasm GC.
    const noGc = typeof WebAssembly === 'undefined' || e instanceof WebAssembly.CompileError;
    status.textContent = noGc
      ? 'navigateur sans WebAssembly GC (Chrome 119+, Firefox 120+, Safari 18.2+)'
      : `échec du chargement : ${e.message || e}`;
    console.error(e);
    return null;
  }
}

// Version horodatée en tête de page : savoir quel build tourne, au téléphone
// comme au bureau. L'heure est rendue dans le fuseau du visiteur.
function showBuild() {
  const at = new Date(BUILD.time);
  const when = Number.isNaN(at.getTime()) ? BUILD.time
    : at.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric',
                                   hour: '2-digit', minute: '2-digit' });
  const commit = BUILD.commit && !BUILD.commit.startsWith('$') ? ` · ${BUILD.commit}${BUILD.dirty ? '+' : ''}` : '';
  $('build').textContent = `v${BUILD.version} · ${when}${commit}`;
}
showBuild();

const toje = await loadEmulator();
// Parties et disquettes modifiées : le magasin du navigateur (IndexedDB).
const store = toje ? await openSaveStore() : null;
if (toje) start(toje, store);
registerOffline();

// Hors ligne : le service worker garde ce qui a été chargé (sw.js). Ce que la
// première visite a chargé avant qu'il ne contrôle la page lui est signalé.
function registerOffline() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
    const urls = performance.getEntriesByType('resource').map(e => e.name)
      .filter(u => u.startsWith(location.origin));
    reg.active.postMessage({ cache: [location.href.split('#')[0], ...urls] });
  }).catch(e => console.warn('hors ligne indisponible', e));
}

function start(toje, store) {
  const [width, height, aspect, scanLines, sampleRate] = toje.displayInfo();
  canvas.width = width;
  canvas.height = height;
  // Proportions d'affichage du domaine (pixel TO8 59:64) : la feuille de style
  // n'en porte aucune copie.
  document.documentElement.style.setProperty('--screen-aspect', String(aspect));
  const image = ctx2d.createImageData(width, height);

  // ── Son ────────────────────────────────────────────────────────────────
  let audio = null;      // { ctx, gain, next }
  let soundOn = true;

  function openAudio() {
    if (audio || !soundOn) return;
    // Le contexte tourne au taux du TO8 émulé (44,1 kHz) : sans cela, un
    // téléphone à 48 kHz doit rééchantillonner chaque tampon, et un navigateur
    // qui s'en dispense jouerait la musique 9 % trop aiguë et trop vite.
    let ctx;
    try { ctx = new AudioContext({ sampleRate, latencyHint: 'interactive' }); }
    catch { ctx = new AudioContext(); }   // navigateur qui refuse ce taux : il rééchantillonne
    const gain = ctx.createGain();
    gain.gain.value = 0.8;
    gain.connect(ctx.destination);
    audio = { ctx, gain, next: 0 };
    ctx.resume();
  }

  function audioRunning() {
    return audio !== null && audio.ctx.state === 'running' && soundOn;
  }

  function queueAudio(samples) {
    const { ctx, gain } = audio;
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    // Sous-alimentation (onglet masqué, machine lente) : on repart un peu devant,
    // plutôt que de programmer dans le passé.
    if (audio.next < ctx.currentTime) {
      audio.next = ctx.currentTime + 0.03;
      stats.underruns++;
    }
    src.start(audio.next);
    audio.next += buffer.duration;
  }

  // ── Boucle ─────────────────────────────────────────────────────────────
  let wallDue = 0;
  let wallLast = performance.now();
  let framesThisSecond = 0;
  let fpsStamp = performance.now();

  // Diagnostic de cadence, lisible depuis la console ou une recette Playwright :
  // trames émulées, coupures du son (file audio vidée), plus grosse rafale.
  const stats = { frames: 0, underruns: 0, maxBurst: 0, start: performance.now() };
  window.tojeStats = stats;

  function step(withSound = true) {
    toje.runFrame();
    trackDrive();
    if (withSound && audioRunning()) queueAudio(toje.audio());
    framesThisSecond++;
    stats.frames++;
  }

  function framesDue(now) {
    if (audioRunning()) {
      const ahead = audio.next - audio.ctx.currentTime;
      return Math.max(0, Math.ceil((AUDIO_LEAD - ahead) / FRAME_SECONDS));
    }
    wallDue = Math.min(wallDue + (now - wallLast) / 1000 / FRAME_SECONDS, MAX_FRAMES_PER_TICK);
    return Math.floor(wallDue);
  }

  function present() {
    image.data.set(new Uint8ClampedArray(toje.pixels().buffer));
    ctx2d.putImageData(image, 0, 0);
    updateCapsLed();
    updateDriveLed();
  }

  // Voyant du lecteur : un accès ne dure que quelques trames ; le voyant reste
  // allumé DRIVE_HOLD trames après le dernier (~240 ms, comme le pilote desktop),
  // sans quoi il clignoterait trop vite pour l'œil. Rangs de THMFC1.DriveActivity.
  const DRIVE_STATES = ['', 'seek', 'read', 'write'];
  const DRIVE_HOLD = 12;
  const driveLed = $('drive-led');
  let driveHeld = 0;
  let driveHold = 0;
  function trackDrive() {
    const activity = toje.diskActivity();
    if (activity !== 0) {
      driveHeld = activity;
      driveHold = DRIVE_HOLD;
    } else if (driveHold > 0 && --driveHold === 0) {
      driveHeld = 0;
    }
  }
  function updateDriveLed() {
    const state = DRIVE_STATES[driveHeld];
    if (driveLed.dataset.state !== state) driveLed.dataset.state = state;
  }

  // Voyant CAPS LOCK du clavier à l'écran : l'état du 6804, pas celui du clavier du PC.
  function updateCapsLed() {
    if (!keyboardOn) return;
    const on = toje.capsLock();
    if (on === capsShown) return;
    capsShown = on;
    keyboard.setCapsLock(on);
  }

  // Vitesse moyennée sur 5 s : compter une seule seconde tombe sur 49 ou 51
  // trames selon la phase, et l'affichage oscillait entre 98 et 102 % pour
  // une cadence exacte.
  const SPEED_WINDOW = 5;
  const perSecond = [];
  function updateStatus(now) {
    if (now - fpsStamp < 1000) return;
    perSecond.push({ frames: framesThisSecond, ms: now - fpsStamp });
    if (perSecond.length > SPEED_WINDOW) perSecond.shift();
    const frames = perSecond.reduce((sum, s) => sum + s.frames, 0);
    const seconds = perSecond.reduce((sum, s) => sum + s.ms, 0) / 1000;
    const speed = Math.round(frames / seconds * 2);   // 50 trames/s = 100 %
    status.textContent = `${speed} %${audioRunning() ? '' : ' · muet'}`;
    framesThisSecond = 0;
    fpsStamp = now;
  }

  // ── Accélération ───────────────────────────────────────────────────────
  // Maintenue (bouton » ou F7, comme le pilote desktop), ou d'elle-même avec
  // « Chargements rapides » : tant que le voyant disque est allumé et que le
  // joueur ne touche à rien depuis IDLE_MS — un jeu qui charge, pas un jeu
  // qu'on joue. Son coupé : accéléré, il ne serait que du bruit. La vitesse
  // atteinte s'affiche en %, mesurée comme d'habitude.
  const TURBO_MAX = 10;            // ×10 au plus, plafond du pilote desktop
  const TURBO_BUDGET_MS = 12;      // de calcul par rafraîchissement : la page reste fluide
  const IDLE_MS = 2000;
  let turboHeld = false;
  let fastLoad = true;
  let turboOn = false;
  let lastInput = 0;
  function noteInput() { lastInput = performance.now(); }

  function turboWanted(now) {
    return turboHeld || (fastLoad && driveHeld !== 0 && now - lastInput > IDLE_MS);
  }

  function setTurbo(on) {
    turboOn = on;
    $('ff').classList.toggle('on', on);
    // En sortant, le son repart juste devant : la file s'est vidée pendant l'accélération.
    if (!on && audio) audio.next = audio.ctx.currentTime + 0.03;
    wallDue = 0;
  }

  function runTurbo(now) {
    const due = Math.min((now - wallLast) / 1000 / FRAME_SECONDS, MAX_FRAMES_PER_TICK) * TURBO_MAX;
    const start = performance.now();
    let n = 0;
    while (n < due && performance.now() - start < TURBO_BUDGET_MS) {
      step(false);
      n++;
    }
    return n;
  }

  function runNormal(now) {
    const n = Math.min(framesDue(now), MAX_FRAMES_PER_TICK);
    for (let i = 0; i < n; i++) {
      step();
      wallDue = Math.max(0, wallDue - 1);
    }
    return n;
  }

  // Une exception dans une trame ne doit jamais arrêter la boucle : sans le
  // finally, le rafraîchissement suivant n'est pas demandé et l'émulateur se fige.
  // ── Pause ──────────────────────────────────────────────────────────────
  // À la demande (bouton, touche Pause), onglet caché, ou tiroir des options
  // ouvert au téléphone : on choisit un jeu, la partie ne file pas pendant ce
  // temps. Le son est suspendu avec la machine.
  let userPaused = false;
  let pausedShown = false;
  function isPaused() {
    return userPaused || document.hidden || document.body.classList.contains('menu-open');
  }
  function syncPause(now) {
    const paused = isPaused();
    if (paused === pausedShown) return paused;
    pausedShown = paused;
    if (audio && soundOn) {
      if (paused) audio.ctx.suspend();
      else audio.ctx.resume().then(() => { audio.next = audio.ctx.currentTime + 0.03; });
    }
    wallDue = 0;
    wallLast = now;
    if (paused) status.textContent = 'pause';
    return paused;
  }
  function setUserPaused(on) {
    userPaused = on;
    setPressed($('pause'), on);
    $('pause').textContent = on ? 'Reprendre' : 'Pause';
  }

  function tick(now) {
    try {
      if (syncPause(now)) return;
      pollJoystick();
      const turbo = turboWanted(now);
      if (turbo !== turboOn) setTurbo(turbo);
      const n = turbo ? runTurbo(now) : runNormal(now);
      wallLast = now;
      stats.maxBurst = Math.max(stats.maxBurst, n);
      if (n > 0) present();
      updateStatus(now);
    } catch (e) {
      stats.errors = (stats.errors || 0) + 1;
      console.error(e);
      status.textContent = `erreur d'émulation : ${e.message || e}`;
    } finally {
      requestAnimationFrame(tick);
    }
  }

  // Le navigateur n'ouvre le son qu'après un geste : n'importe lequel suffit.
  const startHint = $('start');
  startHint.hidden = false;
  function firstGesture() {
    startHint.hidden = true;
    openAudio();
    keepScreenAwake();
  }
  document.addEventListener('pointerdown', firstGesture, { capture: true });
  startHint.addEventListener('click', () => canvas.focus());

  // Un téléphone qui se met en veille au milieu d'une partie : on l'en empêche.
  let wakeLock = null;
  async function keepScreenAwake() {
    if (wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch { /* refusé (batterie faible, réglage) : sans conséquence */ }
  }
  document.addEventListener('visibilitychange', () => { if (audio) keepScreenAwake(); });

  // ── Médias ─────────────────────────────────────────────────────────────
  // Un média, d'où qu'il vienne (bibliothèque, fichier, glisser-déposer),
  // part vers le bon connecteur selon son extension ; .sap reste une disquette.
  // La page garde les octets de chacun : une partie sauvegardée les remonte.
  let media = { disks: [null, null], cart: null, sd: null };   // { name, bytes }

  // « Disquette choisie » : Démarrer (redémarre dessus) ou un lecteur, où elle
  // entre sans redémarrer — un jeu qui demande sa disquette 2. Revient à
  // Démarrer après chaque insertion, pour ne pas surprendre au média suivant.
  let target = 'boot';
  function setTarget(value) {
    target = value;
    for (const b of document.querySelectorAll('.target-btn')) setPressed(b, b.dataset.target === value);
  }
  for (const b of document.querySelectorAll('.target-btn')) {
    b.addEventListener('click', () => setTarget(b.dataset.target));
  }

  function showMedia() {
    const parts = [];
    media.disks.forEach((d, i) => {
      if (d) parts.push(`lecteur ${i + 1} : ${titleOf(d.name)}${d.modified ? ' (modifiée)' : ''}`);
    });
    if (media.cart) parts.push(`cartouche : ${titleOf(media.cart.name)}`);
    if (media.sd) parts.push(`carte SD : ${titleOf(media.sd.name)}`);
    $('disk-name').textContent = parts.length ? parts.join(' · ') : 'aucun';
    const first = media.disks[0];
    $('copy-link').hidden = !gameMedia.fromLibrary();
    $('disk-download').hidden = !first;
    $('disk-revert').hidden = !(first && first.modified);
  }

  // Les réglages d'un jeu (touches tactiles, écriture sur disquette) suivent le
  // jeu démarré ; une disquette glissée dans un lecteur en fait partie.
  function gameChanged() {
    touchKeys.forGame(gameMedia.key());
    setPressed($('disk-write'), copies.forGame(gameMedia.key()));
    showMedia();
    saves.renderSlots();
  }

  async function mount(name, bytes, { fromLibrary = false } = {}) {
    const format = formatOf(name) || 'fd';
    const isDisk = format !== 'rom' && format !== 'sd';
    const swap = isDisk && target !== 'boot';
    // Le réglage d'écriture du jeu décide si l'on monte sa copie modifiée.
    if (!swap) copies.forGame(baseName(name));
    const disk = isDisk ? await copies.bytesFor(name, bytes) : { bytes, modified: false };
    const entry = { name, bytes: disk.bytes, original: bytes, modified: disk.modified, fromLibrary };
    if (swap) {
      const drive = Number(target);
      toje.swapDisk(drive, entry.bytes, name);
      media.disks[drive] = entry;
      status.textContent = `${titleOf(name)} → lecteur ${drive + 1}`;
      setTarget('boot');
    } else {
      let ok = true;
      if (format === 'rom') toje.insertCartridge(bytes);
      else if (format === 'sd') ok = toje.insertSdCard(bytes, name);
      else toje.insertDisk(entry.bytes, name);
      media = { disks: [isDisk ? entry : null, null],
                cart: format === 'rom' ? entry : null,
                sd: format === 'sd' && ok ? entry : null };
      status.textContent = ok ? titleOf(name) : 'carte SDDrive non activée';
      if (fromLibrary) prefs.set('lastGame', name);
    }
    gameChanged();
    menu.close();
    firstGesture();
    canvas.focus();
  }

  // Ce qu'une partie sauvegardée retient des médias, et comment les remonter
  // sans redémarrer : la carte d'abord (elle réinitialise la machine), puis le
  // reste. Une disquette est prise telle que le TO8 l'a laissée.
  const gameMedia = {
    list() {
      const list = [];
      media.disks.forEach((d, drive) => {
        if (d) list.push({ kind: 'disk', drive, ...d, bytes: toje.diskBytes(drive) || d.bytes });
      });
      if (media.cart) list.push({ kind: 'cart', ...media.cart });
      if (media.sd) list.push({ kind: 'sd', ...media.sd });
      return list;
    },
    /** Clé stable des réglages du jeu : le fichier démarré. */
    key() {
      const first = this.list()[0];
      return first ? baseName(first.name) : 'TO8';
    },
    title() {
      const first = this.list()[0];
      return first ? titleOf(first.name) : 'TO8';
    },
    fromLibrary() {
      const first = this.list()[0];
      return Boolean(first && first.fromLibrary);
    },
    remount(list) {
      toje.ejectAll();
      media = { disks: [null, null], cart: null, sd: null };
      for (const m of list.filter(m => m.kind === 'sd')) { toje.restoreSdCard(m.bytes, m.name); media.sd = m; }
      for (const m of list.filter(m => m.kind === 'cart')) { toje.restoreCartridge(m.bytes); media.cart = m; }
      for (const m of list.filter(m => m.kind === 'disk')) { toje.swapDisk(m.drive, m.bytes, m.name); media.disks[m.drive] = m; }
      gameChanged();
      startHint.hidden = true;
      menu.close();
      canvas.focus();
    },
  };

  // Touches du TO8 à côté de A et B, réglées pour chaque jeu.
  const touchKeys = createTouchKeys($('touch-keys'), $('touch-keys-settings'), keyChoices(toje),
    (code, down) => toje.pressKey(code, down), prefs, noteInput);

  // Disquettes modifiées par les jeux qui sauvegardent, gardées par jeu.
  const copies = createDiskCopies({
    toje, store, prefs,
    drives: () => media.disks,
    busy: () => driveHeld !== 0,
    onStatus: text => { status.textContent = text; },
  });

  async function openFile(file) {
    mount(file.name, new Int8Array(await file.arrayBuffer()));
  }

  const menu = createMenu($('menu-toggle'), $('menu'), $('menu-backdrop'), $('menu-close'));
  const library = createLibrary($('library'), [...document.querySelectorAll('.lib-chips .chip')],
    $('lib-search'), BUILD.commit, mount, text => { status.textContent = text; });

  $('disk-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) openFile(file);
    e.target.value = '';
  });

  const frame = $('screen-frame');
  const hint = $('drop-hint');
  frame.addEventListener('dragover', e => { e.preventDefault(); hint.hidden = false; });
  frame.addEventListener('dragleave', () => { hint.hidden = true; });
  frame.addEventListener('drop', e => {
    e.preventDefault();
    hint.hidden = true;
    const file = e.dataTransfer.files[0];
    if (file) openFile(file);
  });

  // ── Boutons ────────────────────────────────────────────────────────────
  function setPressed(button, on) {
    button.setAttribute('aria-pressed', String(on));
  }

  $('reset').addEventListener('click', () => { toje.reset(); menu.close(); canvas.focus(); });

  $('pause').addEventListener('click', () => { setUserPaused(!userPaused); canvas.focus(); });
  $('capture').addEventListener('click', () => saveScreenshot(canvas, aspect, gameMedia.title()));

  // Un lien qui lance ce jeu de la bibliothèque, à partager.
  $('copy-link').addEventListener('click', async () => {
    const first = gameMedia.list()[0];
    const url = `${location.origin}${location.pathname}?jeu=${encodeURIComponent(first.name)}`;
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'lien copié';
    } catch {
      prompt('Lien vers ce jeu :', url);   // presse-papiers refusé : on le montre
    }
  });

  // Sauvegardes sur disquette, par jeu (disk-copies.js).
  $('disk-write').addEventListener('click', e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    copies.setWritable(on);
    setPressed(e.currentTarget, on);
    status.textContent = on ? 'la disquette de ce jeu accepte l’écriture' : 'disquette protégée';
  });
  $('disk-download').addEventListener('click', () => copies.download(0));
  $('disk-revert').addEventListener('click', async () => {
    const first = media.disks[0];
    if (!first || !confirm(`Effacer les sauvegardes de ${titleOf(first.name)} et redémarrer sur la disquette d’origine ?`)) return;
    await copies.forget(first.name);
    setTarget('boot');
    await mount(first.name, first.original, { fromLibrary: first.fromLibrary });
    status.textContent = 'disquette d’origine';
  });

  // Dernier jeu de la bibliothèque, proposé au retour quand aucune partie n'est en cours.
  function offerRelaunch(file, load) {
    $('resume-verb').textContent = 'Relancer';
    $('resume-title').textContent = titleOf(file);
    $('resume-when').textContent = 'dernier jeu lancé';
    $('resume-thumb').hidden = true;
    $('resume').hidden = false;
    startHint.hidden = true;
    $('resume-yes').onclick = () => { $('resume').hidden = true; load(file); };
    $('resume-no').onclick = () => { $('resume').hidden = true; prefs.set('lastGame', null); };
  }

  $('sound').addEventListener('click', e => {
    soundOn = !soundOn;
    setPressed(e.currentTarget, soundOn);
    if (soundOn) openAudio();
    if (audio) soundOn ? audio.ctx.resume() : audio.ctx.suspend();
  });

  // Plein écran : l'écran seul au bureau ; toute la page (manette, clavier)
  // dès que les commandes tactiles sont affichées, en paysage si possible.
  $('fullscreen').addEventListener('click', async () => {
    menu.close();
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const target = touchOn || keyboardOn ? document.documentElement : frame;
    try {
      await target.requestFullscreen({ navigationUI: 'hide' });
      if (touchOn && screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch { /* iPhone : pas d'API plein écran hors vidéo — « Sur l'écran d'accueil » à la place */ }
    canvas.focus();
  });

  // ── Manette tactile et clavier à l'écran ──────────────────────────────
  const touchPad = createTouchPad($('stick'), $('fire'), JOY);
  let touchOn = false;
  function setTouch(on) {
    touchOn = on;
    $('stick').hidden = !on;
    $('fire').hidden = !on;
    document.body.classList.toggle('touch', on);
    setPressed($('touch-mode'), on);
    if (!on) touchPad.reset();
    prefs.set('touch', on);
  }
  $('touch-mode').addEventListener('click', () => setTouch(!touchOn));

  let keyboardOn = false;
  let keyboard = null;     // { setCapsLock } une fois dessiné
  let capsShown = null;
  function setKeyboard(on) {
    if (on && !keyboard) {
      const zoom = createKeyboardZoom($('keyboard'), prefs.get('kbZoom', 1), z => prefs.set('kbZoom', z));
      keyboard = buildKeyboard(zoom.inner, toje, (sc, down) => { noteInput(); toje.pressKey(sc, down); });
      requestAnimationFrame(zoom.refresh);   // une fois les touches mesurables
      capsShown = null;
    }
    keyboardOn = on;
    $('keyboard').hidden = !on;
    document.body.classList.toggle('kb', on);
    setPressed($('kb-mode'), on);
    prefs.set('keyboard', on);
  }
  $('kb-mode').addEventListener('click', () => setKeyboard(!keyboardOn));

  // « Turbo disque » du pilote desktop : délais moteur du lecteur supprimés.
  function setDiskTurbo(on) {
    toje.setDiskTurbo(on);
    setPressed($('disk-turbo'), on);
    prefs.set('diskTurbo', on);
  }
  $('disk-turbo').addEventListener('click', e => {
    setDiskTurbo(e.currentTarget.getAttribute('aria-pressed') !== 'true');
    canvas.focus();
  });

  // Écran cathodique : cosmétique, éteint par défaut — l'image brute reste la référence.
  const crt = createCrtScreen(canvas, $('crt'), scanLines);
  function setCrt(on) {
    crt.set(on);
    setPressed($('crt-mode'), on);
    prefs.set('crt', on);
  }
  $('crt-mode').addEventListener('click', e => {
    setCrt(e.currentTarget.getAttribute('aria-pressed') !== 'true');
    canvas.focus();
  });

  // Accélérer tant qu'on appuie.
  const ff = $('ff');
  ff.addEventListener('pointerdown', e => { ff.setPointerCapture(e.pointerId); turboHeld = true; e.preventDefault(); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    ff.addEventListener(type, () => { turboHeld = false; });
  }

  function setFastLoad(on) {
    fastLoad = on;
    setPressed($('fast-load'), on);
    prefs.set('fastLoad', on);
  }
  $('fast-load').addEventListener('click', e => {
    setFastLoad(e.currentTarget.getAttribute('aria-pressed') !== 'true');
    canvas.focus();
  });

  // ── Clavier du PC et manettes ─────────────────────────────────────────
  let keyboardJoystick = true;
  const keyJoy = { dirs: 0, a: false, b: false };
  $('joy-mode').addEventListener('click', e => {
    keyboardJoystick = !keyboardJoystick;
    setPressed(e.currentTarget, keyboardJoystick);
    keyJoy.dirs = 0; keyJoy.a = false; keyJoy.b = false;
    canvas.focus();
  });

  let joyPort = 0;
  function setPort(port) {
    toje.joystick(joyPort, 0, false, false);   // relâche l'ancien port
    joyPort = port;
    for (const o of document.querySelectorAll('.seg-btn')) setPressed(o, Number(o.dataset.port) === port);
    prefs.set('port', port);
  }
  for (const b of document.querySelectorAll('.seg-btn')) {
    b.addEventListener('click', () => { setPort(Number(b.dataset.port)); canvas.focus(); });
  }

  const JOY_KEYS = {
    ArrowLeft: JOY.left, ArrowRight: JOY.right, ArrowUp: JOY.up, ArrowDown: JOY.down,
  };

  function joystickKey(code, down) {
    if (!keyboardJoystick) return false;
    if (code in JOY_KEYS) {
      keyJoy.dirs = down ? keyJoy.dirs | JOY_KEYS[code] : keyJoy.dirs & ~JOY_KEYS[code];
    } else if (code === 'Space') {
      keyJoy.a = down;
    } else if (code === 'AltLeft' || code === 'AltRight') {
      keyJoy.b = down;
    } else {
      return false;
    }
    return true;
  }

  function onKey(e, down) {
    if (e.ctrlKey && e.code === 'KeyR') return;     // laisse recharger la page
    if (e.target instanceof HTMLInputElement) return;
    firstGesture();
    if (e.code === 'F7') { turboHeld = down; e.preventDefault(); return; }
    if (e.code === 'Pause') { if (down) setUserPaused(!userPaused); e.preventDefault(); return; }
    if (e.repeat) { e.preventDefault(); return; }    // le 6804 répète lui-même
    noteInput();
    if (joystickKey(e.code, down) || toje.key(e.code, down)) e.preventDefault();
  }
  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup', e => onKey(e, false));
  window.addEventListener('blur', () => {
    keyJoy.dirs = 0; keyJoy.a = false; keyJoy.b = false;
    touchPad.reset();
  });

  function gamepadState() {
    const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p) : null;
    if (!pad) return { dirs: 0, a: false, b: false };
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const btn = i => Boolean(pad.buttons[i] && pad.buttons[i].pressed);
    let dirs = 0;
    if (ax < -0.5 || btn(14)) dirs |= JOY.left;
    else if (ax > 0.5 || btn(15)) dirs |= JOY.right;
    if (ay < -0.5 || btn(12)) dirs |= JOY.up;
    else if (ay > 0.5 || btn(13)) dirs |= JOY.down;
    return { dirs, a: btn(0) || btn(2), b: btn(1) || btn(3) };
  }

  // Trois sources pour une seule manette TO8 : clavier du PC, manette USB, écran tactile.
  let lastJoy = '';
  function pollJoystick() {
    const pad = gamepadState();
    const touch = touchPad.state();
    const dirs = keyJoy.dirs | pad.dirs | touch.dirs;
    const a = keyJoy.a || pad.a || touch.a;
    const b = keyJoy.b || pad.b || touch.b;
    const state = `${dirs}${a}${b}`;
    if (state === lastJoy) return;
    lastJoy = state;
    noteInput();
    toje.joystick(joyPort, dirs, a, b);
  }

  setTouch(prefs.get('touch', coarsePointer));
  setKeyboard(prefs.get('keyboard', false));
  setPort(prefs.get('port', 0));
  setDiskTurbo(prefs.get('diskTurbo', false));
  setCrt(prefs.get('crt', false));
  setFastLoad(prefs.get('fastLoad', true));

  // Parties sauvegardées.
  const saves = createGameSaves({
    toje, store, media: gameMedia, canvas,
    ui: { slots: $('saves'), resume: $('resume'), resumeTitle: $('resume-title'),
          resumeWhen: $('resume-when'), resumeThumb: $('resume-thumb'),
          resumeYes: $('resume-yes'), resumeNo: $('resume-no') },
    onDone: text => { status.textContent = text; },
    // État illisible (autre version de TOJE) : on redémarre sur son premier média.
    onFailedResume: save => {
      const first = save.media.find(m => m.kind !== 'disk' || m.drive === 0) || save.media[0];
      setTarget('boot');
      if (first) mount(first.name, first.bytes);
      status.textContent = 'sauvegarde d\'une autre version : partie redémarrée';
    },
  });
  gameChanged();

  // Au démarrage, dans l'ordre : un lien direct (?jeu=…) lance son jeu ; sinon
  // la partie en cours est proposée ; sinon le dernier jeu de la bibliothèque.
  (async () => {
    const wanted = new URLSearchParams(location.search).get('jeu');
    const { files, load } = await library;
    if (wanted && files.includes(wanted)) { await load(wanted); return; }
    if (await saves.offerResume()) { startHint.hidden = true; return; }
    const last = prefs.get('lastGame', null);
    if (last && files.includes(last)) offerRelaunch(last, load);
  })();
  status.textContent = 'prêt';
  canvas.focus();
  requestAnimationFrame(tick);
}
