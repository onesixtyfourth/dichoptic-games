'use strict';

const DG = (() => {
  // Grey shared by both eyes; an element is hidden from an eye when that eye's filtered channels equal BG.
  const BG = 64;
  const WHITE = [255, 255, 255];
  const SETTINGS_KEY = 'dichoptic-games-settings';
  const BEST_KEY = 'dichoptic-games-best';
  const REPEAT_DELAY = 170;
  const REPEAT_RATE = 50;
  const CATEGORIES = ['Arcade', 'Puzzles', 'Strategy', 'Words'];
  const ICONS = { left: '\u25C0', right: '\u25B6', up: '\u25B2', down: '\u25BC', action: '\u25CF', alt: '\u25C6', pause: '\u275A\u275A' };
  const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'action', Enter: 'action', x: 'alt', p: 'pause', Escape: 'pause' };
  const PAD = { 14: 'left', 15: 'right', 12: 'up', 13: 'down', 0: 'action', 1: 'alt', 9: 'pause' };
  const DEFAULTS = {
    mode: 'anaglyph',
    glasses: 'red-blue',
    redLens: 'left',
    amblyopicEye: 'left',
    fellowContrast: 0.4,
    sessionMinutes: 30,
    difficulty: 1,
  };

  const loadJson = key => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  };

  const settings = { ...DEFAULTS, ...loadJson(SETTINGS_KEY) };
  const best = loadJson(BEST_KEY);
  const games = [];
  const held = { touch: new Set(), keys: new Set(), pad: new Set() };
  const padTimers = {};

  let canvas;
  let ctx;
  let controls;
  let views = [];
  let current = null;
  let game = null;
  let state = 'home';
  let sessionMs = 0;
  let wakeLock = null;
  let returnTo = 'home';
  let gesture = null;

  const $ = id => document.getElementById(id);

  const util = {
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    randInt: n => Math.floor(Math.random() * n),
    rand: (lo, hi) => lo + Math.random() * (hi - lo),
    pick: a => a[Math.floor(Math.random() * a.length)],
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    grid: (w, h, v) => Array.from({ length: h }, () => Array(w).fill(v)),
    overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    formatTime(ms) {
      const s = Math.ceil(Math.max(0, ms) / 1000);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    },
  };

  const otherEye = eye => (eye === 'left' ? 'right' : 'left');
  const rgb = ([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

  function eyeOf(target) {
    if (target === 'amb') return settings.amblyopicEye;
    if (target === 'fellow') return otherEye(settings.amblyopicEye);
    return 'both';
  }

  // Anaglyph colours are offsets above BG drawn additively, so elements meant for different eyes never mask each other.
  function paint(eye, view, colour, contrast) {
    if (view.eye !== 'both') {
      if (eye !== 'both' && eye !== view.eye) return null;
      return rgb(colour.map(ch => BG + contrast * (ch - BG)));
    }
    const d = contrast * (255 - BG);
    if (eye === 'both') return rgb([d, d, d]);
    if (eye === settings.redLens) return rgb([d, 0, 0]);
    if (settings.glasses === 'red-cyan') return rgb([0, d, d]);
    if (settings.glasses === 'red-green') return rgb([0, d, 0]);
    return rgb([0, 0, d]);
  }

  function colourFor(view, target, colour = WHITE, strength = 1) {
    return paint(eyeOf(target), view, colour, strength * (target === 'fellow' ? settings.fellowContrast : 1));
  }

  function makeRenderer(c, view, dpr) {
    const fill = (target, colour, strength) => {
      const s = colourFor(view, target, colour, strength);
      if (s) c.fillStyle = s;
      return s;
    };
    const stroke = (target, colour, strength, width) => {
      const s = colourFor(view, target, colour, strength);
      if (s) {
        c.strokeStyle = s;
        c.lineWidth = width;
        c.lineCap = 'round';
        c.lineJoin = 'round';
      }
      return s;
    };
    return {
      rect(x, y, w, h, target, colour, strength) {
        if (fill(target, colour, strength)) c.fillRect(x, y, w, h);
      },
      tile(x, y, w, h, target, colour, strength) {
        const g = Math.min(w, h) * 0.06;
        this.rect(x + g, y + g, w - 2 * g, h - 2 * g, target, colour, strength);
      },
      box(x, y, w, h, width, target, colour, strength) {
        if (stroke(target, colour, strength, width)) c.strokeRect(x, y, w, h);
      },
      circle(x, y, rad, target, colour, strength) {
        if (!fill(target, colour, strength)) return;
        c.beginPath();
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fill();
      },
      ring(x, y, rad, width, target, colour, strength) {
        if (!stroke(target, colour, strength, width)) return;
        c.beginPath();
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.stroke();
      },
      line(x1, y1, x2, y2, width, target, colour, strength) {
        this.lines([x1, y1, x2, y2], width, target, colour, strength);
      },
      // Segments as a flat [x1, y1, x2, y2, ...] list, stroked as one path so joints don't double up.
      lines(segs, width, target, colour, strength) {
        if (!stroke(target, colour, strength, width)) return;
        c.beginPath();
        for (let i = 0; i < segs.length; i += 4) {
          c.moveTo(segs[i], segs[i + 1]);
          c.lineTo(segs[i + 2], segs[i + 3]);
        }
        c.stroke();
      },
      poly(pts, target, colour, strength) {
        if (!fill(target, colour, strength)) return;
        c.beginPath();
        c.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
        c.closePath();
        c.fill();
      },
      text(str, x, y, size, target, colour, strength, align = 'center') {
        if (!fill(target, colour, strength)) return;
        c.save();
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.font = `600 ${size * view.s}px system-ui, sans-serif`;
        c.textAlign = align;
        c.textBaseline = 'middle';
        c.fillText(String(str), view.ox + x * view.s, view.oy + y * view.s);
        c.restore();
      },
    };
  }

  const dims = () => ({ w: (game && game.width) || current.width, h: (game && game.height) || current.height });

  function fit(v) {
    const { w, h } = dims();
    v.hud = Math.min(40, Math.max(24, v.h * 0.06));
    const availH = v.h - v.hud - 20;
    v.s = Math.min((v.w - 16) / w, availH / h);
    v.ox = v.x + (v.w - w * v.s) / 2;
    v.oy = v.y + v.hud + 8 + (availH - h * v.s) / 2;
  }

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const top = parseFloat(getComputedStyle($('safe-probe')).paddingTop) || 0;
    const bottom = settings.mode === 'split' ? 0 : controls.offsetHeight;
    views = settings.mode === 'split'
      ? [{ eye: 'left', x: 0, y: top, w: w / 2, h: h - top }, { eye: 'right', x: w / 2, y: top, w: w / 2, h: h - top }]
      : [{ eye: 'both', x: 0, y: top, w, h: h - top - bottom }];
    if (current) views.forEach(fit);
  }

  function drawHud(v) {
    const items = game.hud ? game.hud() : [];
    items.push(util.formatTime(settings.sessionMinutes * 60000 - sessionMs));
    const str = items.join('    ');
    let size = v.hud * 0.5;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    const tw = ctx.measureText(str).width;
    if (tw > v.w * 0.94) {
      size *= (v.w * 0.94) / tw;
      ctx.font = `600 ${size}px system-ui, sans-serif`;
    }
    ctx.fillStyle = colourFor(v, 'both', WHITE, 0.8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, v.x + v.w / 2, v.y + v.hud / 2 + 4);
  }

  function render() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    for (const v of views) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(v.x, v.y, v.w, v.h);
      ctx.clip();
      ctx.fillStyle = rgb([BG, BG, BG]);
      ctx.fillRect(v.x, v.y, v.w, v.h);
      if (v.eye === 'both') ctx.globalCompositeOperation = 'lighter';
      if (game) {
        drawHud(v);
        const { w, h } = dims();
        ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.ox, dpr * v.oy);
        const r = makeRenderer(ctx, v, dpr);
        const pad = 5 / v.s;
        // The frame is seen by both eyes to help them fuse the two images.
        r.box(-pad, -pad, w + 2 * pad, h + 2 * pad, 2 / v.s, 'both', WHITE, 0.4);
        ctx.beginPath();
        ctx.rect(-pad, -pad, w + 2 * pad, h + 2 * pad);
        ctx.clip();
        game.draw(r);
      }
      ctx.restore();
    }
  }

  const isHeld = a => held.touch.has(a) || held.keys.has(a) || held.pad.has(a);

  function act(a) {
    if (a === 'pause') {
      togglePause();
      return;
    }
    if (state === 'playing' && game && game.action) game.action(a);
  }

  function recordBest() {
    if (!game || !current || typeof game.score !== 'number') return;
    const prev = best[current.id];
    const better = prev === undefined || (current.lowerIsBetter ? game.score < prev : game.score > prev);
    if (better) {
      best[current.id] = game.score;
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    }
  }

  const api = {
    util,
    WHITE,
    get difficulty() {
      return settings.difficulty;
    },
    held: isHeld,
    gameOver(message) {
      if (state !== 'playing') return;
      recordBest();
      showMenu('over', message);
    },
  };

  function show(id) {
    for (const o of ['home', 'menu', 'settings', 'check']) $(o).classList.toggle('hidden', o !== id);
  }

  function setState(s) {
    state = s;
    if (s === 'playing') {
      show(null);
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  }

  function openHome() {
    recordBest();
    setState('home');
    game = null;
    current = null;
    controls.innerHTML = '';
    layout();
    show('home');
  }

  function selectGame(def) {
    current = def;
    game = null;
    buildControls();
    showMenu('ready', '');
  }

  function showMenu(s, message) {
    setState(s);
    $('menu-title').textContent = current.name;
    $('menu-help').textContent = current.help;
    $('menu-status').textContent = message;
    const b = best[current.id];
    $('menu-best').textContent = b === undefined ? '' : `Best: ${b}`;
    $('btn-play').textContent = s === 'paused' ? 'Resume' : s === 'ready' ? 'Play' : 'Play again';
    $('btn-restart').classList.toggle('hidden', s !== 'paused');
    show('menu');
  }

  function startGame() {
    recordBest();
    if (sessionMs >= settings.sessionMinutes * 60000) sessionMs = 0;
    enterFullscreen();
    setState('playing');
    game = current.create(api);
    layout();
  }

  function resume() {
    enterFullscreen();
    setState('playing');
  }

  function togglePause() {
    if (!$('settings').classList.contains('hidden') || !$('check').classList.contains('hidden')) return;
    if (state === 'playing') showMenu('paused', 'Paused');
    else if (state === 'paused') resume();
    else if (current && state !== 'home') startGame();
  }

  function buildControls() {
    controls.innerHTML = '';
    const actions = [...(current.buttons || []), 'pause'];
    const repeat = current.repeat || [];
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = (current.labels && current.labels[a]) || ICONS[a];
      b.setAttribute('aria-label', a);
      let timer = null;
      const clear = () => {
        clearTimeout(timer);
        clearInterval(timer);
        timer = null;
      };
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        clear();
        held.touch.add(a);
        act(a);
        if (repeat.includes(a)) timer = setTimeout(() => { timer = setInterval(() => act(a), REPEAT_RATE); }, REPEAT_DELAY);
      });
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) {
        b.addEventListener(t, () => {
          clear();
          held.touch.delete(a);
        });
      }
      controls.appendChild(b);
    }
    controls.style.gridTemplateColumns = `repeat(${actions.length}, 1fr)`;
    layout();
  }

  function buildHome() {
    const list = $('game-list');
    list.innerHTML = '';
    for (const cat of CATEGORIES) {
      const defs = games.filter(g => g.category === cat);
      if (!defs.length) continue;
      const h = document.createElement('h3');
      h.textContent = cat;
      const grid = document.createElement('div');
      grid.className = 'game-grid';
      for (const def of defs) {
        const b = document.createElement('button');
        b.className = 'game-tile';
        const name = document.createElement('strong');
        name.textContent = def.name;
        const desc = document.createElement('span');
        desc.textContent = def.description;
        b.append(name, desc);
        b.addEventListener('click', () => selectGame(def));
        grid.appendChild(b);
      }
      list.append(h, grid);
    }
  }

  function toGame(e) {
    const v = views.find(v => e.clientX >= v.x && e.clientX < v.x + v.w && e.clientY >= v.y && e.clientY < v.y + v.h);
    return v && v.s ? { x: (e.clientX - v.ox) / v.s, y: (e.clientY - v.oy) / v.s } : null;
  }

  function wirePointer() {
    canvas.addEventListener('pointerdown', e => {
      if (state !== 'playing' || !game) return;
      canvas.setPointerCapture(e.pointerId);
      gesture = { x: e.clientX, y: e.clientY };
      const p = toGame(e);
      if (game.pointer) {
        if (p) game.pointer('down', p.x, p.y);
      } else if (!current.swipe && settings.mode === 'split') {
        // In a VR viewer the only input is often a screen tap, so use it to pause.
        showMenu('paused', 'Paused');
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!gesture || state !== 'playing' || !game.pointer) return;
      const p = toGame(e);
      if (p) game.pointer('move', p.x, p.y);
    });
    const end = e => {
      if (!gesture) return;
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      gesture = null;
      if (state !== 'playing' || !game) return;
      if (current.swipe && Math.hypot(dx, dy) > 30) {
        act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      }
      if (game.pointer) {
        const p = toGame(e) || { x: NaN, y: NaN };
        game.pointer('up', p.x, p.y);
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function wireKeys() {
    window.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select')) return;
      if (state === 'playing' && game && game.key && !e.ctrlKey && !e.metaKey && !e.altKey && game.key(e.key)) {
        e.preventDefault();
        return;
      }
      const a = KEYS[e.key] || KEYS[e.key.toLowerCase()];
      if (!a) return;
      e.preventDefault();
      held.keys.add(a);
      if (e.repeat && !(current && (current.repeat || []).includes(a))) return;
      act(a);
    });
    window.addEventListener('keyup', e => {
      const a = KEYS[e.key] || KEYS[e.key.toLowerCase()];
      if (a) held.keys.delete(a);
    });
    window.addEventListener('blur', () => held.keys.clear());
  }

  function pollGamepads(now) {
    if (!navigator.getGamepads) return;
    held.pad.clear();
    for (const gp of navigator.getGamepads()) {
      if (!gp) continue;
      for (const [i, a] of Object.entries(PAD)) {
        if (gp.buttons[i] && gp.buttons[i].pressed) held.pad.add(a);
      }
      const [ax = 0, ay = 0] = gp.axes;
      if (ax < -0.5) held.pad.add('left');
      if (ax > 0.5) held.pad.add('right');
      if (ay < -0.5) held.pad.add('up');
      if (ay > 0.5) held.pad.add('down');
    }
    const repeat = (current && current.repeat) || [];
    for (const a of [...Object.values(PAD)]) {
      if (!held.pad.has(a)) {
        delete padTimers[a];
      } else if (padTimers[a] === undefined) {
        padTimers[a] = now + REPEAT_DELAY;
        act(a);
      } else if (repeat.includes(a) && now >= padTimers[a]) {
        padTimers[a] = now + REPEAT_RATE;
        act(a);
      }
    }
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

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    pollGamepads(now);
    if (state === 'playing' && game) {
      sessionMs += dt;
      if (sessionMs >= settings.sessionMinutes * 60000) {
        recordBest();
        showMenu('done', 'Session complete \u2013 well done!');
      } else if (game.update) {
        game.update(dt / 1000);
      }
    }
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
      cctx.globalCompositeOperation = 'source-over';
      cctx.fillStyle = rgb([BG, BG, BG]);
      cctx.fillRect(v.x, v.y, v.w, v.h);
      if (v.eye === 'both') cctx.globalCompositeOperation = 'lighter';
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

  function openOverlay(id) {
    returnTo = state === 'home' ? 'home' : 'menu';
    show(id);
  }

  function closeOverlay() {
    show(returnTo);
  }

  function wireUi() {
    const form = $('settings-form');
    const updateSettingsUi = () => {
      $('contrast-out').textContent = `${Math.round(form.elements.fellowContrast.value * 100)}%`;
      const anaglyph = form.elements.mode.value === 'anaglyph';
      form.querySelectorAll('[data-mode="anaglyph"]').forEach(el => el.classList.toggle('hidden', !anaglyph));
    };
    const openSettings = () => {
      for (const [k, v] of Object.entries(settings)) {
        if (form.elements[k]) form.elements[k].value = String(v);
      }
      updateSettingsUi();
      openOverlay('settings');
    };
    form.addEventListener('input', updateSettingsUi);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements;
      Object.assign(settings, {
        mode: f.mode.value,
        glasses: f.glasses.value,
        redLens: f.redLens.value,
        amblyopicEye: f.amblyopicEye.value,
        fellowContrast: util.clamp(parseFloat(f.fellowContrast.value) || DEFAULTS.fellowContrast, 0.05, 1),
        sessionMinutes: util.clamp(parseInt(f.sessionMinutes.value, 10) || DEFAULTS.sessionMinutes, 1, 120),
        difficulty: util.clamp(parseInt(f.difficulty.value, 10) || 0, 0, 2),
      });
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      applyMode();
      closeOverlay();
    });

    $('btn-settings').addEventListener('click', openSettings);
    $('btn-menu-settings').addEventListener('click', openSettings);
    $('btn-check').addEventListener('click', () => {
      openOverlay('check');
      drawCheck();
    });
    $('btn-check-done').addEventListener('click', closeOverlay);
    $('btn-play').addEventListener('click', () => (state === 'paused' ? resume() : startGame()));
    $('btn-restart').addEventListener('click', startGame);
    $('btn-back').addEventListener('click', openHome);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state === 'playing') showMenu('paused', 'Paused');
    });
    window.addEventListener('resize', () => {
      layout();
      if (!$('check').classList.contains('hidden')) drawCheck();
    });
  }

  function applyMode() {
    document.body.classList.toggle('split', settings.mode === 'split');
    layout();
  }

  function init() {
    canvas = $('game');
    ctx = canvas.getContext('2d');
    controls = $('controls');
    buildHome();
    wireUi();
    wirePointer();
    wireKeys();
    applyMode();
    openHome();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    util,
    WHITE,
    register: def => games.push(def),
  };
})();
