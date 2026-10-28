// Clavier du téléphone : aucune API ne l'ouvre, mais il apparaît dès qu'un
// champ de saisie prend le focus. Un champ invisible le reçoit donc, et ce
// qu'on y tape est frappé au TO8, caractère par caractère (WebEmulator.strokeOf).
//
// Les claviers de téléphone ne disent pas leurs touches : sous Android,
// keydown rend souvent « Unidentified », et un mot en cours de saisie
// (prédiction) est réécrit d'un bloc. On compare donc le contenu du champ
// avant et après : ce qui a disparu devient des retours arrière, ce qui est
// apparu des caractères. Deux espaces d'avance restent dans le champ, pour
// qu'un retour arrière sur champ « vide » se voie encore.

const SENTINEL = '  ';
const HOLD_MS = 80;        // tenu assez pour que le 6804 lise la touche
const GAP_MS = 40;
const MAX_LENGTH = 40;     // au-delà, le champ repart du témoin (hors composition)

/**
 * input : champ invisible ; button : bouton qui l'ouvre et le ferme ;
 * press(code, down) : touche TO8 (code | $80 = SHIFT forcé) ; key(name, down) :
 * touche nommée (Enter, Backspace, flèches) ; onInput() : le joueur agit.
 */
export function createPhoneKeyboard({ toje, input, button, press, key, onInput }) {
  const queue = [];          // [{ code } | { name }]
  let busy = false;
  let last = SENTINEL;
  let composing = false;
  let typed = 0;

  function reset() {
    input.value = SENTINEL;
    last = SENTINEL;
    input.setSelectionRange(SENTINEL.length, SENTINEL.length);
  }

  function hit(stroke, down) {
    if (stroke.name) key(stroke.name, down);
    else press(stroke.code, down);
  }

  // Une touche à la fois : enfoncée, tenue, relâchée, puis la suivante.
  function pump() {
    if (busy || queue.length === 0) return;
    busy = true;
    const stroke = queue.shift();
    hit(stroke, true);
    typed++;
    setTimeout(() => {
      hit(stroke, false);
      setTimeout(() => { busy = false; pump(); }, GAP_MS);
    }, HOLD_MS);
  }

  function type(stroke) {
    queue.push(stroke);
    onInput();
    pump();
  }

  // Le TO8 n'a pas de retour arrière : ← recule le curseur, EFF efface le
  // caractère dessous. (La touche 0x14 que le pilote associe à ⌫ est ACC, une
  // touche morte d'accent : elle avalait la frappe suivante.)
  function backspace() {
    type({ name: 'ArrowLeft' });
    type({ name: 'Delete' });
  }

  function typeChar(ch) {
    if (ch === '\n') { type({ name: 'Enter' }); return; }
    const code = toje.strokeOf(ch);
    if (code >= 0) type({ code });
  }

  input.addEventListener('input', () => {
    const now = input.value;
    let p = 0;
    while (p < last.length && p < now.length && last[p] === now[p]) p++;
    for (let i = p; i < last.length; i++) backspace();
    for (const ch of now.slice(p)) typeChar(ch);
    last = now;
    if (!composing && (now.length < SENTINEL.length || now.length > MAX_LENGTH || !now.startsWith(SENTINEL))) reset();
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => {
    composing = false;
    setTimeout(() => { if (!composing) reset(); });
  });
  // Ce que le champ ne garde pas : Entrée, et les flèches d'un clavier Bluetooth.
  const NAMED = new Set(['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  input.addEventListener('keydown', e => {
    if (!NAMED.has(e.key)) return;
    type({ name: e.key });
    e.preventDefault();
    if (e.key === 'Enter' && !composing) reset();   // ligne validée : le champ repart à vide
  });

  function setOpen(open) {
    button.setAttribute('aria-pressed', String(open));
  }
  input.addEventListener('focus', () => { reset(); setOpen(true); });
  input.addEventListener('blur', () => setOpen(false));
  // Le focus doit être donné dans le geste même, sans quoi le clavier ne sort pas.
  button.addEventListener('pointerdown', e => e.preventDefault());   // garde le focus au champ
  button.addEventListener('click', () => {
    if (document.activeElement === input) input.blur();
    else input.focus({ preventScroll: true });
  });

  return { typed: () => typed };
}
