'use strict';

const COLS = 10;
const ROWS = 20;
// Grey shared by both eyes; an element is hidden from an eye when that eye's filtered channels equal BG.
const BG = 64;
const WHITE = [255, 255, 255];
const STORAGE_KEY = 'dichoptic-tetris-settings';
const REPEAT_DELAY = 170;
const REPEAT_RATE = 50;
const REPEATABLE = new Set(['left', 'right', 'down']);
const ACTIONS = ['left', 'right', 'down', 'rotate', 'drop', 'pause'];

const PIECES = [
  { m: [[1, 1, 1, 1]], c: [0, 240, 240] },
  { m: [[1, 1], [1, 1]], c: [240, 240, 0] },
  { m: [[0, 1, 0], [1, 1, 1]], c: [160, 0, 240] },
  { m: [[0, 1, 1], [1, 1, 0]], c: [0, 240, 0] },
  { m: [[1, 1, 0], [0, 1, 1]], c: [240, 0, 0] },
  { m: [[1, 0, 0], [1, 1, 1]], c: [0, 0, 240] },
  { m: [[0, 0, 1], [1, 1, 1]], c: [240, 160, 0] },
];

const DEFAULTS = {
  mode: 'anaglyph',
  glasses: 'red-blue',
  redLens: 'left',
  amblyopicEye: 'left',
  fellowContrast: 0.4,
  sessionMinutes: 30,
  startLevel: 1,
};

const settings = loadSettings();

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const controls = $('controls');
const menu = $('menu');
const settingsPanel = $('settings');
const checkPanel = $('check');
const form = $('settings-form');

const game = {
  state: 'menu',
  board: emptyBoard(),
  piece: null,
  next: null,
  bag: [],
  score: 0,
  lines: 0,
  level: 1,
  dropTimer: 0,
  sessionMs: 0,
};

let views = [];
let wakeLock = null;

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const otherEye = eye => (eye === 'left' ? 'right' : 'left');
const rgb = ([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
const rotate = m => m[0].map((_, i) => m.map(row => row[i]).reverse());

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function eyeOf(target) {
  if (target === 'amb') return settings.amblyopicEye;
  if (target === 'fellow') return otherEye(settings.amblyopicEye);
  return 'both';
}

// Colour for an element shown to `eye` within `view`, or null if that view must not show it.
function paint(eye, view, colour, contrast) {
  if (settings.mode === 'split') {
    if (eye !== 'both' && eye !== view.eye) return null;
    return rgb(colour.map(ch => BG + contrast * (ch - BG)));
  }
  const v = BG + contrast * (255 - BG);
  if (eye === 'both') return rgb([v, v, v]);
  if (eye === settings.redLens) return rgb([v, BG, BG]);
  switch (settings.glasses) {
    case 'red-cyan': return rgb([BG, v, v]);
    case 'red-green': return rgb([BG, v, BG]);
    default: return rgb([BG, BG, v]);
  }
}

function targetColour(target, view, colour, strength = 1) {
  const contrast = strength * (target === 'fellow' ? settings.fellowContrast : 1);
  return paint(eyeOf(target), view, colour, contrast);
}

function takeFromBag() {
  if (!game.bag.length) {
    game.bag = PIECES.slice();
    for (let i = game.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [game.bag[i], game.bag[j]] = [game.bag[j], game.bag[i]];
    }
  }
  return game.bag.pop();
}

function fits(m, x, y) {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const bx = x + c;
      const by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return false;
      if (by >= 0 && game.board[by][bx]) return false;
    }
  }
  return true;
}

function spawn() {
  const p = game.next || takeFromBag();
  game.next = takeFromBag();
  game.piece = { m: p.m, c: p.c, x: Math.floor((COLS - p.m[0].length) / 2), y: 0 };
  if (!fits(game.piece.m, game.piece.x, game.piece.y)) {
    setState('over', `Game over \u2013 score ${game.score}, lines ${game.lines}`);
  }
}

function newGame() {
  Object.assign(game, {
    board: emptyBoard(),
    bag: [],
    next: null,
    score: 0,
    lines: 0,
    level: settings.startLevel,
    dropTimer: 0,
  });
  setState('playing');
  spawn();
}

function tryMove(dx, dy) {
  const p = game.piece;
  if (!fits(p.m, p.x + dx, p.y + dy)) return false;
  p.x += dx;
  p.y += dy;
  return true;
}

function tryRotate() {
  const p = game.piece;
  const m = rotate(p.m);
  for (const dx of [0, -1, 1, -2, 2]) {
    if (fits(m, p.x + dx, p.y)) {
      p.m = m;
      p.x += dx;
      return;
    }
  }
}

function lock() {
  const { m, c, x, y } = game.piece;
  m.forEach((row, r) => row.forEach((v, col) => {
    if (v) game.board[y + r][x + col] = c;
  }));
  const kept = game.board.filter(row => row.some(cell => !cell));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
  game.board = kept;
  if (cleared) {
    game.lines += cleared;
    game.score += [0, 100, 300, 500, 800][cleared] * game.level;
    game.level = settings.startLevel + Math.floor(game.lines / 10);
  }
  game.dropTimer = 0;
  spawn();
}

function act(action) {
  if (action === 'pause') {
    togglePause();
    return;
  }
  if (game.state !== 'playing') return;
  switch (action) {
    case 'left': tryMove(-1, 0); break;
    case 'right': tryMove(1, 0); break;
    case 'rotate': tryRotate(); break;
    case 'down':
      if (!tryMove(0, 1)) lock();
      game.dropTimer = 0;
      break;
    case 'drop':
      while (tryMove(0, 1));
      lock();
      break;
  }
}

function togglePause() {
  if (!settingsPanel.classList.contains('hidden') || !checkPanel.classList.contains('hidden')) return;
  if (game.state === 'playing') setState('paused', 'Paused');
  else $('btn-play').click();
}

function setState(state, message = '') {
  game.state = state;
  const playing = state === 'playing';
  menu.classList.toggle('hidden', playing);
  $('btn-play').textContent = state === 'paused' ? 'Resume' : 'Play';
  $('menu-status').textContent = message;
  if (playing) acquireWakeLock();
  else releaseWakeLock();
}

function acquireWakeLock() {
  if (wakeLock || !navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then(lock => {
    wakeLock = lock;
    lock.addEventListener('release', () => { wakeLock = null; });
  }).catch(() => {});
}

function releaseWakeLock() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

function enterFullscreen() {
  if (settings.mode !== 'split' || !document.documentElement.requestFullscreen || document.fullscreenElement) return;
  document.documentElement.requestFullscreen()
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => {});
}

function update(dt) {
  game.sessionMs += dt;
  if (game.sessionMs >= settings.sessionMinutes * 60000) {
    setState('done', `Session complete \u2013 well done! Score ${game.score}, lines ${game.lines}`);
    return;
  }
  game.dropTimer += dt;
  const interval = Math.max(80, 800 * Math.pow(0.85, game.level - 1));
  if (game.dropTimer >= interval) {
    game.dropTimer = 0;
    if (!tryMove(0, 1)) lock();
  }
}

function layout() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (settings.mode === 'split') {
    views = [
      { eye: 'left', x: 0, y: 0, w: w / 2, h },
      { eye: 'right', x: w / 2, y: 0, w: w / 2, h },
    ];
  } else {
    views = [{ eye: 'both', x: 0, y: 0, w, h: h - controls.offsetHeight }];
  }
}

function drawCell(x, y, size, colour) {
  if (!colour) return;
  ctx.fillStyle = colour;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
}

function formatTime(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function drawView(v) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  ctx.fillStyle = rgb([BG, BG, BG]);
  ctx.fillRect(v.x, v.y, v.w, v.h);

  const panelCols = 6;
  const cell = Math.floor(Math.min(v.w * 0.92 / (COLS + panelCols), v.h * 0.94 / ROWS));
  const ox = v.x + Math.floor((v.w - cell * (COLS + panelCols)) / 2);
  const oy = v.y + Math.floor((v.h - cell * ROWS) / 2);

  // The frame and HUD are seen by both eyes to help the eyes fuse the two images.
  ctx.strokeStyle = targetColour('both', v, WHITE, 0.5);
  ctx.lineWidth = 2;
  ctx.strokeRect(ox - 2, oy - 2, cell * COLS + 4, cell * ROWS + 4);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const colour = game.board[r][c];
      if (colour) drawCell(ox + c * cell, oy + r * cell, cell, targetColour('fellow', v, colour));
    }
  }

  const p = game.piece;
  if (p && game.state !== 'menu') {
    const colour = targetColour('amb', v, p.c);
    p.m.forEach((row, r) => row.forEach((on, c) => {
      if (on) drawCell(ox + (p.x + c) * cell, oy + (p.y + r) * cell, cell, colour);
    }));
  }

  const px = ox + cell * (COLS + 1);
  let ty = oy;
  ctx.fillStyle = targetColour('both', v, WHITE, 0.8);
  ctx.font = `${Math.max(10, Math.round(cell * 0.55))}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('NEXT', px, ty);
  ty += cell;

  if (game.next) {
    const small = Math.floor(cell * 0.8);
    const colour = targetColour('amb', v, game.next.c);
    game.next.m.forEach((row, r) => row.forEach((on, c) => {
      if (on) drawCell(px + c * small, ty + r * small, small, colour);
    }));
  }
  ty += cell * 3;

  ctx.fillStyle = targetColour('both', v, WHITE, 0.8);
  const remaining = settings.sessionMinutes * 60000 - game.sessionMs;
  for (const [label, value] of [['SCORE', game.score], ['LINES', game.lines], ['LEVEL', game.level], ['TIME', formatTime(remaining)]]) {
    ctx.fillText(label, px, ty);
    ctx.fillText(String(value), px, ty + cell * 0.7);
    ty += cell * 1.8;
  }
  ctx.restore();
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  for (const v of views) drawView(v);
}

const gpHeld = {};
const GP_MAP = { 14: 'left', 15: 'right', 13: 'down', 12: 'rotate', 0: 'rotate', 1: 'drop', 9: 'pause' };

function pollGamepads(now) {
  if (!navigator.getGamepads) return;
  const pressed = new Set();
  for (const gp of navigator.getGamepads()) {
    if (!gp) continue;
    for (const [i, a] of Object.entries(GP_MAP)) {
      if (gp.buttons[i] && gp.buttons[i].pressed) pressed.add(a);
    }
    const [ax = 0, ay = 0] = gp.axes;
    if (ax < -0.5) pressed.add('left');
    if (ax > 0.5) pressed.add('right');
    if (ay > 0.5) pressed.add('down');
  }
  for (const a of ACTIONS) {
    if (!pressed.has(a)) {
      delete gpHeld[a];
    } else if (gpHeld[a] === undefined) {
      gpHeld[a] = now + REPEAT_DELAY;
      act(a);
    } else if (REPEATABLE.has(a) && now >= gpHeld[a]) {
      gpHeld[a] = now + REPEAT_RATE;
      act(a);
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  pollGamepads(now);
  if (game.state === 'playing') update(dt);
  render();
  requestAnimationFrame(frame);
}

function drawCheck() {
  const c = $('check-canvas');
  const cctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const split = settings.mode === 'split';
  const W = window.innerWidth - 32;
  const H = Math.min(window.innerHeight * 0.55, W * (split ? 0.5 : 0.75));
  c.style.width = `${W}px`;
  c.style.height = `${H}px`;
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const checkViews = split
    ? [{ eye: 'left', x: 0, y: 0, w: W / 2, h: H }, { eye: 'right', x: W / 2, y: 0, w: W / 2, h: H }]
    : [{ eye: 'both', x: 0, y: 0, w: W, h: H }];

  for (const v of checkViews) {
    cctx.fillStyle = rgb([BG, BG, BG]);
    cctx.fillRect(v.x, v.y, v.w, v.h);
    const cy = v.y + v.h / 2;
    const r = Math.min(v.w, v.h) * 0.18;

    const left = paint('left', v, WHITE, 1);
    if (left) {
      cctx.fillStyle = left;
      cctx.beginPath();
      cctx.arc(v.x + v.w * 0.28, cy, r, 0, Math.PI * 2);
      cctx.fill();
    }
    const right = paint('right', v, WHITE, 1);
    if (right) {
      cctx.fillStyle = right;
      cctx.fillRect(v.x + v.w * 0.72 - r, cy - r, r * 2, r * 2);
    }
    cctx.strokeStyle = paint('both', v, WHITE, 0.6);
    cctx.lineWidth = 2;
    cctx.beginPath();
    cctx.moveTo(v.x + v.w / 2 - 10, cy);
    cctx.lineTo(v.x + v.w / 2 + 10, cy);
    cctx.moveTo(v.x + v.w / 2, cy - 10);
    cctx.lineTo(v.x + v.w / 2, cy + 10);
    cctx.stroke();
  }

  const tip = split
    ? ''
    : ' If the shapes are swapped, change "Red lens is over the" in Settings. Faint ghosting of the other shape means crosstalk \u2013 try lowering screen brightness or another glasses colour setting.';
  $('check-text').textContent =
    'Close your RIGHT eye: you should see only the circle. Close your LEFT eye: you should see only the square.' + tip;
}

function openCheck() {
  menu.classList.add('hidden');
  checkPanel.classList.remove('hidden');
  drawCheck();
}

function updateSettingsUi() {
  $('contrast-out').textContent = `${Math.round(form.elements.fellowContrast.value * 100)}%`;
  const anaglyph = form.elements.mode.value === 'anaglyph';
  form.querySelectorAll('[data-mode="anaglyph"]').forEach(el => el.classList.toggle('hidden', !anaglyph));
}

function openSettings() {
  for (const [k, v] of Object.entries(settings)) {
    if (form.elements[k]) form.elements[k].value = v;
  }
  updateSettingsUi();
  menu.classList.add('hidden');
  settingsPanel.classList.remove('hidden');
}

function applyMode() {
  document.body.classList.toggle('split', settings.mode === 'split');
  layout();
}

form.addEventListener('input', updateSettingsUi);
form.addEventListener('submit', e => {
  e.preventDefault();
  const f = form.elements;
  Object.assign(settings, {
    mode: f.mode.value,
    glasses: f.glasses.value,
    redLens: f.redLens.value,
    amblyopicEye: f.amblyopicEye.value,
    fellowContrast: clamp(parseFloat(f.fellowContrast.value) || DEFAULTS.fellowContrast, 0.05, 1),
    sessionMinutes: clamp(parseInt(f.sessionMinutes.value, 10) || DEFAULTS.sessionMinutes, 1, 120),
    startLevel: clamp(parseInt(f.startLevel.value, 10) || 1, 1, 15),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  applyMode();
  settingsPanel.classList.add('hidden');
  menu.classList.remove('hidden');
});

$('btn-play').addEventListener('click', () => {
  enterFullscreen();
  if (game.state === 'paused') {
    setState('playing');
    return;
  }
  if (game.state === 'done') game.sessionMs = 0;
  newGame();
});
$('btn-settings').addEventListener('click', openSettings);
$('btn-check').addEventListener('click', openCheck);
$('btn-check-done').addEventListener('click', () => {
  checkPanel.classList.add('hidden');
  menu.classList.remove('hidden');
});

controls.querySelectorAll('button').forEach(btn => {
  const action = btn.dataset.action;
  let timer = null;
  const stop = () => {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
  };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    act(action);
    if (REPEATABLE.has(action)) {
      stop();
      timer = setTimeout(() => { timer = setInterval(() => act(action), REPEAT_RATE); }, REPEAT_DELAY);
    }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => btn.addEventListener(t, stop));
});

// In a VR viewer the only input is often a screen tap, so use it to pause.
canvas.addEventListener('pointerdown', () => {
  if (settings.mode === 'split' && game.state === 'playing') setState('paused', 'Paused');
});

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate', ' ': 'drop', p: 'pause', Escape: 'pause' };
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, select')) return;
  const action = KEYS[e.key];
  if (!action) return;
  e.preventDefault();
  if (e.repeat && !REPEATABLE.has(action)) return;
  act(action);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') setState('paused', 'Paused');
});

window.addEventListener('resize', () => {
  layout();
  if (!checkPanel.classList.contains('hidden')) drawCheck();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

applyMode();
requestAnimationFrame(frame);
