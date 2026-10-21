'use strict';

(() => {
  const { util, WHITE } = DG;
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  const YOU = 1;
  const CPU = 2;

  // Round-based match against the computer: results pause briefly, then a new round starts.
  function match(g, newRound) {
    const m = { wins: 0, losses: 0, draws: 0, result: null, pause: 0, turn: YOU, starter: YOU, thinking: 0 };
    m.finish = winner => {
      m.result = winner;
      m.pause = 1.8;
      if (winner === YOU) m.wins++;
      else if (winner === CPU) m.losses++;
      else m.draws++;
      g.score = m.wins;
    };
    m.next = player => {
      m.turn = player;
      if (player === CPU) m.thinking = 0.45;
    };
    m.start = () => {
      m.result = null;
      newRound();
      m.next(m.starter);
      m.starter = m.starter === YOU ? CPU : YOU;
    };
    m.update = (dt, cpuMove) => {
      if (m.result) {
        m.pause -= dt;
        if (m.pause <= 0) m.start();
      } else if (m.turn === CPU) {
        m.thinking -= dt;
        if (m.thinking <= 0) cpuMove();
      }
    };
    m.canPlay = () => !m.result && m.turn === YOU;
    m.hud = () => {
      const status = m.result
        ? { [YOU]: 'You win!', [CPU]: 'Computer wins', draw: 'Draw' }[m.result]
        : m.turn === YOU ? 'Your turn' : 'Computer\u2026';
      return [status, `You ${m.wins}`, `CPU ${m.losses}`, `Draws ${m.draws}`];
    };
    g.score = 0;
    return m;
  }

  function moveCursor(cur, a, w, h) {
    const d = DIRS[a];
    if (!d) return false;
    cur.x = util.clamp(cur.x + d[0], 0, w - 1);
    cur.y = util.clamp(cur.y + d[1], 0, h - 1);
    return true;
  }

  DG.register({
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    category: 'Strategy',
    description: 'Get three in a row before the computer does.',
    help: 'Tap a square, or move with the arrows and press \u25CF. Your X is shown to your weaker eye and the computer\u2019s O to your stronger eye.',
    width: 3,
    height: 3,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    create(api) {
      const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
      const g = {};
      const cur = { x: 1, y: 1 };
      let board;
      let showCursor = false;
      const m = match(g, () => { board = Array(9).fill(0); });

      const lineOf = b => LINES.find(l => b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]);
      const winner = b => {
        const l = lineOf(b);
        if (l) return b[l[0]];
        return b.every(Boolean) ? 'draw' : null;
      };

      function minimax(b, turn) {
        const w = winner(b);
        if (w === CPU) return 1;
        if (w === YOU) return -1;
        if (w === 'draw') return 0;
        let bestScore = turn === CPU ? -2 : 2;
        for (let i = 0; i < 9; i++) {
          if (b[i]) continue;
          b[i] = turn;
          const s = minimax(b, turn === CPU ? YOU : CPU);
          b[i] = 0;
          bestScore = turn === CPU ? Math.max(bestScore, s) : Math.min(bestScore, s);
        }
        return bestScore;
      }

      function play(i, p) {
        board[i] = p;
        const w = winner(board);
        if (w) m.finish(w);
        else m.next(p === YOU ? CPU : YOU);
      }

      function cpuMove() {
        const free = board.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
        if (Math.random() < [0.6, 0.25, 0][api.difficulty]) {
          play(util.pick(free), CPU);
          return;
        }
        let bestScore = -2;
        let moves = [];
        for (const i of free) {
          board[i] = CPU;
          const s = minimax(board, YOU);
          board[i] = 0;
          if (s > bestScore) {
            bestScore = s;
            moves = [i];
          } else if (s === bestScore) {
            moves.push(i);
          }
        }
        play(util.pick(moves), CPU);
      }

      const tryPlay = i => {
        if (m.canPlay() && !board[i]) play(i, YOU);
      };

      g.update = dt => m.update(dt, cpuMove);
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= 3 || y >= 3) return;
        showCursor = false;
        tryPlay(Math.floor(y) * 3 + Math.floor(x));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, 3, 3) && a === 'action') tryPlay(cur.y * 3 + cur.x);
      };
      g.draw = r => {
        r.lines([1, 0.1, 1, 2.9, 2, 0.1, 2, 2.9, 0.1, 1, 2.9, 1, 0.1, 2, 2.9, 2], 0.05, 'both', WHITE, 0.5);
        board.forEach((v, i) => {
          const x = (i % 3) + 0.5;
          const y = Math.floor(i / 3) + 0.5;
          if (v === YOU) r.lines([x - 0.28, y - 0.28, x + 0.28, y + 0.28, x + 0.28, y - 0.28, x - 0.28, y + 0.28], 0.1, 'amb', [255, 80, 80]);
          else if (v === CPU) r.ring(x, y, 0.3, 0.1, 'fellow', [80, 160, 255]);
        });
        const l = lineOf(board);
        if (l) r.line((l[0] % 3) + 0.5, Math.floor(l[0] / 3) + 0.5, (l[2] % 3) + 0.5, Math.floor(l[2] / 3) + 0.5, 0.06, 'both', WHITE, 0.6);
        if (showCursor) r.box(cur.x + 0.06, cur.y + 0.06, 0.88, 0.88, 0.04, 'both', WHITE, 0.7);
      };
      g.hud = m.hud;
      m.start();
      return g;
    },
  });

  DG.register({
    id: 'four',
    name: 'Four in a Row',
    category: 'Strategy',
    description: 'Drop discs to line up four before the computer.',
    help: 'Tap a column (or choose with the arrows and press \u25CF) to drop a disc. Your discs are shown to your weaker eye and the computer\u2019s to your stronger eye.',
    width: 7,
    height: 7,
    buttons: ['left', 'action', 'right'],
    labels: { action: 'Drop' },
    create(api) {
      const C = 7;
      const R = 6;
      const ORDER = [3, 2, 4, 1, 5, 0, 6];
      const LINES4 = [[1, 0], [0, 1], [1, 1], [1, -1]];
      const g = {};
      let board;
      let col = 3;
      let lastMove = null;
      const m = match(g, () => {
        board = util.grid(C, R, 0);
        lastMove = null;
      });

      const dropRow = (b, c) => {
        for (let r = R - 1; r >= 0; r--) if (!b[r][c]) return r;
        return -1;
      };
      const wins = (b, r, c, p) => LINES4.some(([dx, dy]) => {
        let n = 1;
        for (const s of [1, -1]) {
          let x = c + dx * s;
          let y = r + dy * s;
          while (x >= 0 && y >= 0 && x < C && y < R && b[y][x] === p) {
            n++;
            x += dx * s;
            y += dy * s;
          }
        }
        return n >= 4;
      });

      function evaluate(b, p) {
        const o = 3 - p;
        let s = 0;
        for (let r = 0; r < R; r++) s += b[r][3] === p ? 3 : b[r][3] === o ? -3 : 0;
        for (let r = 0; r < R; r++) {
          for (let c = 0; c < C; c++) {
            for (const [dx, dy] of LINES4) {
              const ex = c + dx * 3;
              const ey = r + dy * 3;
              if (ex < 0 || ex >= C || ey < 0 || ey >= R) continue;
              let pc = 0;
              let oc = 0;
              for (let k = 0; k < 4; k++) {
                const v = b[r + dy * k][c + dx * k];
                if (v === p) pc++;
                else if (v === o) oc++;
              }
              const e = 4 - pc - oc;
              if (pc === 3 && e === 1) s += 5;
              else if (pc === 2 && e === 2) s += 2;
              if (oc === 3 && e === 1) s -= 4;
            }
          }
        }
        return s;
      }

      function negamax(b, depth, alpha, beta, p) {
        const moves = ORDER.filter(c => !b[0][c]);
        if (!moves.length) return 0;
        if (depth === 0) return evaluate(b, p);
        let bestScore = -Infinity;
        for (const c of moves) {
          const r = dropRow(b, c);
          b[r][c] = p;
          const s = wins(b, r, c, p) ? 100000 + depth : -negamax(b, depth - 1, -beta, -alpha, 3 - p);
          b[r][c] = 0;
          bestScore = Math.max(bestScore, s);
          alpha = Math.max(alpha, s);
          if (alpha >= beta) break;
        }
        return bestScore;
      }

      function play(c, p) {
        const r = dropRow(board, c);
        if (r < 0) return false;
        board[r][c] = p;
        lastMove = [r, c];
        if (wins(board, r, c, p)) m.finish(p);
        else if (board[0].every(Boolean)) m.finish('draw');
        else m.next(3 - p);
        return true;
      }

      function cpuMove() {
        const moves = ORDER.filter(c => !board[0][c]);
        if (Math.random() < [0.3, 0.05, 0][api.difficulty]) {
          play(util.pick(moves), CPU);
          return;
        }
        const depth = [2, 4, 5][api.difficulty];
        let bestScore = -Infinity;
        let choice = moves[0];
        for (const c of moves) {
          const r = dropRow(board, c);
          board[r][c] = CPU;
          const s = wins(board, r, c, CPU) ? Infinity : -negamax(board, depth - 1, -Infinity, Infinity, YOU);
          board[r][c] = 0;
          if (s > bestScore) {
            bestScore = s;
            choice = c;
          }
        }
        play(choice, CPU);
      }

      const tryPlay = c => {
        if (m.canPlay()) play(c, YOU);
      };

      g.update = dt => m.update(dt, cpuMove);
      g.pointer = (type, x) => {
        if (x < 0 || x >= C) return;
        col = Math.floor(x);
        if (type === 'down') tryPlay(col);
      };
      g.action = a => {
        if (a === 'left') col = Math.max(0, col - 1);
        else if (a === 'right') col = Math.min(C - 1, col + 1);
        else if (a === 'action' || a === 'down') tryPlay(col);
      };
      g.draw = r => {
        for (let y = 0; y < R; y++) {
          for (let x = 0; x < C; x++) {
            const v = board[y][x];
            if (v === YOU) r.circle(x + 0.5, y + 1.5, 0.4, 'amb', [255, 80, 80]);
            else if (v === CPU) r.circle(x + 0.5, y + 1.5, 0.4, 'fellow', [255, 220, 0]);
            else r.ring(x + 0.5, y + 1.5, 0.4, 0.04, 'both', WHITE, 0.3);
          }
        }
        if (lastMove) r.ring(lastMove[1] + 0.5, lastMove[0] + 1.5, 0.46, 0.04, 'both', WHITE, 0.7);
        if (m.canPlay()) r.circle(col + 0.5, 0.5, 0.35, 'amb', [255, 80, 80], 0.6);
      };
      g.hud = m.hud;
      m.start();
      return g;
    },
  });

  DG.register({
    id: 'gomoku',
    name: 'Gomoku',
    category: 'Strategy',
    description: 'Make five in a row on a larger board.',
    help: 'Tap a square to place a stone. First to five in a row (across, down or diagonal) wins. Your stones are shown to your weaker eye and the computer\u2019s to your stronger eye.',
    width: 11,
    height: 11,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Place' },
    repeat: ['left', 'up', 'down', 'right'],
    create(api) {
      const N = 11;
      const LINES5 = [[1, 0], [0, 1], [1, 1], [1, -1]];
      const g = {};
      const cur = { x: 5, y: 5 };
      let board;
      let lastMove = null;
      let showCursor = false;
      const m = match(g, () => {
        board = util.grid(N, N, 0);
        lastMove = null;
      });

      const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

      function run(x, y, dx, dy, p) {
        let n = 1;
        let open = 0;
        for (const s of [1, -1]) {
          let cx = x + dx * s;
          let cy = y + dy * s;
          while (inside(cx, cy) && board[cy][cx] === p) {
            n++;
            cx += dx * s;
            cy += dy * s;
          }
          if (inside(cx, cy) && !board[cy][cx]) open++;
        }
        return [n, open];
      }

      function cellScore(x, y, p) {
        let s = 0;
        for (const [dx, dy] of LINES5) {
          const [n, open] = run(x, y, dx, dy, p);
          if (n >= 5) s += 1e6;
          else if (n === 4) s += open === 2 ? 1e5 : open === 1 ? 1e4 : 0;
          else if (n === 3) s += open === 2 ? 5e3 : open === 1 ? 400 : 0;
          else if (n === 2) s += open === 2 ? 150 : open === 1 ? 30 : 0;
          else s += open;
        }
        return s;
      }

      function play(x, y, p) {
        board[y][x] = p;
        lastMove = [x, y];
        if (LINES5.some(([dx, dy]) => run(x, y, dx, dy, p)[0] >= 5)) m.finish(p);
        else if (board.every(row => row.every(Boolean))) m.finish('draw');
        else m.next(3 - p);
      }

      function cpuMove() {
        const defence = [0.6, 0.9, 1][api.difficulty];
        const noise = [400, 40, 0][api.difficulty];
        let bestScore = -1;
        let choice = [Math.floor(N / 2), Math.floor(N / 2)];
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            if (board[y][x]) continue;
            let near = false;
            for (let dy = -2; dy <= 2 && !near; dy++) {
              for (let dx = -2; dx <= 2 && !near; dx++) near = inside(x + dx, y + dy) && board[y + dy][x + dx] !== 0;
            }
            if (!near) continue;
            const s = cellScore(x, y, CPU) + cellScore(x, y, YOU) * defence + Math.random() * noise;
            if (s > bestScore) {
              bestScore = s;
              choice = [x, y];
            }
          }
        }
        play(choice[0], choice[1], CPU);
      }

      const tryPlay = (x, y) => {
        if (m.canPlay() && !board[y][x]) play(x, y, YOU);
      };

      g.update = dt => m.update(dt, cpuMove);
      g.pointer = (type, x, y) => {
        if (type !== 'down' || !inside(Math.floor(x), Math.floor(y))) return;
        showCursor = false;
        tryPlay(Math.floor(x), Math.floor(y));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, N, N) && a === 'action') tryPlay(cur.x, cur.y);
      };
      g.draw = r => {
        const segs = [];
        for (let k = 0; k < N; k++) segs.push(k + 0.5, 0.5, k + 0.5, N - 0.5, 0.5, k + 0.5, N - 0.5, k + 0.5);
        r.lines(segs, 0.04, 'both', WHITE, 0.3);
        board.forEach((row, y) => row.forEach((v, x) => {
          if (v === YOU) r.circle(x + 0.5, y + 0.5, 0.42, 'amb', [255, 80, 80]);
          else if (v === CPU) r.circle(x + 0.5, y + 0.5, 0.42, 'fellow', [80, 160, 255]);
        }));
        if (lastMove) r.ring(lastMove[0] + 0.5, lastMove[1] + 0.5, 0.48, 0.05, 'both', WHITE, 0.6);
        if (showCursor) r.box(cur.x + 0.05, cur.y + 0.05, 0.9, 0.9, 0.06, 'both', WHITE, 0.8);
      };
      g.hud = m.hud;
      m.start();
      return g;
    },
  });

  DG.register({
    id: 'solitaire',
    name: 'Solitaire',
    category: 'Strategy',
    description: 'Build each suit up from Ace to King.',
    help: 'Tap a card, then tap where it should go. Tap a selected card again to send it somewhere it fits. Tap the deck (or Draw) to turn cards over, and Auto to send cards to the foundations. Red cards are shown to your weaker eye and black cards to your stronger eye.',
    width: 7,
    height: 11,
    buttons: ['action', 'alt'],
    labels: { action: 'Draw', alt: 'Auto' },
    lowerIsBetter: true,
    create(api) {
      const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
      const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const CW = 0.9;
      const CH = 1.25;
      const TOP = 1.6;
      const H = 11;
      const drawCount = api.difficulty === 2 ? 3 : 1;
      const red = c => c.s === 1 || c.s === 2;
      const g = {};
      const deck = [];
      for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
      util.shuffle(deck);
      const tab = [[], [], [], [], [], [], []];
      for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) tab[j].push(deck.pop());
      tab.forEach(p => { p[p.length - 1].up = true; });
      const found = [[], [], [], []];
      let stock = deck;
      let waste = [];
      let sel = null;
      let moves = 0;
      let t = 0;

      function offsets(pile) {
        const down = pile.filter(c => !c.up).length;
        let dDown = 0.25;
        let dUp = 0.42;
        const need = down * dDown + Math.max(0, pile.length - down - 1) * dUp;
        const avail = H - TOP - CH - 0.1;
        if (need > avail) {
          dDown *= avail / need;
          dUp *= avail / need;
        }
        const ys = [];
        let y = TOP;
        for (const c of pile) {
          ys.push(y);
          y += c.up ? dUp : dDown;
        }
        return ys;
      }

      function hit(x, y) {
        const col = Math.floor(x);
        if (col < 0 || col > 6) return null;
        if (y < TOP - 0.1) {
          if (y > CH + 0.1) return null;
          if (col === 0) return { area: 'stock' };
          if (col === 1) return { area: 'waste' };
          return col >= 3 ? { area: 'found', i: col - 3 } : null;
        }
        const ys = offsets(tab[col]);
        for (let i = tab[col].length - 1; i >= 0; i--) {
          if (y >= ys[i] && y <= ys[i] + CH) return { area: 'tab', i: col, idx: i };
        }
        return { area: 'tab', i: col, idx: -1 };
      }

      function cardsOf(s) {
        if (s.area === 'waste') return waste.slice(-1);
        if (s.area === 'found') return found[s.i].slice(-1);
        return s.idx >= 0 ? tab[s.i].slice(s.idx) : [];
      }

      function removeFrom(s, n) {
        if (s.area === 'waste') waste.pop();
        else if (s.area === 'found') found[s.i].pop();
        else {
          const p = tab[s.i];
          p.splice(p.length - n, n);
          if (p.length) p[p.length - 1].up = true;
        }
      }

      const top = p => p[p.length - 1];
      const canFound = (c, f) => (f.length ? top(f).s === c.s && top(f).r === c.r - 1 : c.r === 1);
      const canTab = (c, p) => (p.length ? top(p).up && top(p).r === c.r + 1 && red(top(p)) !== red(c) : c.r === 13);

      function checkWin() {
        if (found.every(f => f.length === 13)) {
          g.score = Math.round(t);
          api.gameOver(`Solved in ${util.formatTime(t * 1000)} with ${moves} moves!`);
        }
      }

      function moveTo(s, dest) {
        const cards = cardsOf(s);
        if (!cards.length) return false;
        if (dest.area === 'found') {
          const f = found[dest.i];
          if (cards.length !== 1 || !canFound(cards[0], f)) return false;
          removeFrom(s, 1);
          f.push(cards[0]);
        } else {
          if (s.area === 'tab' && s.i === dest.i) return false;
          const p = tab[dest.i];
          if (!canTab(cards[0], p)) return false;
          removeFrom(s, cards.length);
          p.push(...cards);
        }
        moves++;
        checkWin();
        return true;
      }

      function smart(s) {
        if (cardsOf(s).length === 1) {
          for (let i = 0; i < 4; i++) if (moveTo(s, { area: 'found', i })) return;
        }
        for (let i = 0; i < 7; i++) if (moveTo(s, { area: 'tab', i })) return;
      }

      function drawStock() {
        sel = null;
        if (!stock.length) {
          stock = waste.reverse().map(c => ({ ...c, up: false }));
          waste = [];
          return;
        }
        for (let k = 0; k < drawCount && stock.length; k++) {
          const c = stock.pop();
          c.up = true;
          waste.push(c);
        }
        moves++;
      }

      function autoAll() {
        sel = null;
        let moved = true;
        while (moved) {
          moved = false;
          const sources = [{ area: 'waste' }, ...tab.map((p, i) => ({ area: 'tab', i, idx: p.length - 1 }))];
          for (const s of sources) {
            if (cardsOf(s).length !== 1) continue;
            for (let i = 0; i < 4 && !moved; i++) moved = moveTo(s, { area: 'found', i });
          }
        }
      }

      const sameSel = (a, b) => a.area === b.area && a.i === b.i && (a.area !== 'tab' || a.idx === b.idx);

      g.update = dt => { t += dt; };
      g.action = a => {
        if (a === 'action') drawStock();
        else if (a === 'alt') autoAll();
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down') return;
        const h = hit(x, y);
        if (!h) {
          sel = null;
          return;
        }
        if (h.area === 'stock') {
          drawStock();
          return;
        }
        if (sel) {
          if (sameSel(sel, h)) {
            smart(sel);
            sel = null;
            return;
          }
          if ((h.area === 'tab' || h.area === 'found') && moveTo(sel, { area: h.area, i: h.i })) {
            sel = null;
            return;
          }
        }
        if (h.area === 'tab') sel = h.idx >= 0 && tab[h.i][h.idx].up ? h : null;
        else if (h.area === 'waste') sel = waste.length ? h : null;
        else sel = found[h.i].length ? h : null;
      };

      function face(rd, c, x, y, full) {
        const target = red(c) ? 'amb' : 'fellow';
        const col = red(c) ? [240, 80, 80] : [235, 235, 235];
        if (full) {
          rd.box(x + 0.02, y + 0.02, CW - 0.04, CH - 0.04, 0.03, 'both', WHITE, 0.3);
          rd.text(SUITS[c.s], x + CW / 2, y + CH * 0.62, 0.55, target, col);
        } else {
          rd.line(x + 0.02, y + 0.02, x + CW - 0.02, y + 0.02, 0.03, 'both', WHITE, 0.3);
        }
        rd.text(RANKS[c.r] + SUITS[c.s], x + 0.08, y + 0.2, 0.3, target, col, 1, 'left');
      }

      // Overlapping cards only draw their visible strip, because additive drawing would show covered cards through.
      function pile(rd, cards, x, ys) {
        cards.forEach((c, i) => {
          const last = i === cards.length - 1;
          if (c.up) face(rd, c, x, ys[i], last);
          else rd.tile(x, ys[i], CW, last ? CH : ys[i + 1] - ys[i], 'fellow', [80, 120, 200], 0.6);
        });
      }

      g.draw = rd => {
        const slot = x => rd.box(x + 0.04, 0.04, CW - 0.08, CH - 0.08, 0.03, 'both', WHITE, 0.2);
        const px = col => col + (1 - CW) / 2;
        if (stock.length) rd.tile(px(0), 0, CW, CH, 'fellow', [80, 120, 200], 0.6);
        else {
          slot(px(0));
          rd.ring(px(0) + CW / 2, CH / 2, 0.22, 0.05, 'both', WHITE, 0.4);
        }
        if (waste.length) face(rd, top(waste), px(1), 0, true);
        else slot(px(1));
        found.forEach((f, i) => {
          if (f.length) face(rd, top(f), px(i + 3), 0, true);
          else slot(px(i + 3));
        });
        tab.forEach((p, col) => {
          const ys = offsets(p);
          if (!p.length) rd.box(px(col) + 0.04, TOP + 0.04, CW - 0.08, CH - 0.08, 0.03, 'both', WHITE, 0.2);
          pile(rd, p, px(col), ys);
        });
        if (sel) {
          let x;
          let y0 = 0;
          let y1 = CH;
          if (sel.area === 'waste') x = px(1);
          else if (sel.area === 'found') x = px(sel.i + 3);
          else {
            const ys = offsets(tab[sel.i]);
            x = px(sel.i);
            y0 = ys[sel.idx];
            y1 = ys[ys.length - 1] + CH;
          }
          rd.box(x - 0.03, y0 - 0.03, CW + 0.06, y1 - y0 + 0.06, 0.07, 'both', WHITE, 0.9);
        }
      };
      g.hud = () => [`Moves ${moves}`, `Time ${util.formatTime(t * 1000)}`];
      return g;
    },
  });
})();
