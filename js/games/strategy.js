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

  DG.register({
    id: 'reversi',
    name: 'Reversi',
    category: 'Strategy',
    description: 'Trap the computer\u2019s pieces to turn them to your side.',
    help: 'Place a piece so it traps a line of the computer\u2019s pieces between yours; they flip to your side. Dots show where you can play. Most pieces at the end wins. Your pieces are shown to your weaker eye and the computer\u2019s to your stronger eye.',
    width: 8,
    height: 8,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Place' },
    repeat: ['left', 'up', 'down', 'right'],
    create(api) {
      const N = 8;
      const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      const EDGE = [100, -20, 10, 5, 5, 10, -20, 100];
      const NEAR = [-20, -50, -2, -2, -2, -2, -50, -20];
      const MID = [10, -2, -1, -1, -1, -1, -2, 10];
      const INNER = [5, -2, -1, -1, -1, -1, -2, 5];
      const WEIGHT = [EDGE, NEAR, MID, INNER, INNER, MID, NEAR, EDGE];
      const g = {};
      const cur = { x: 3, y: 3 };
      let board;
      let lastMove = null;
      let showCursor = false;
      const m = match(g, () => {
        board = util.grid(N, N, 0);
        board[3][3] = board[4][4] = CPU;
        board[3][4] = board[4][3] = YOU;
        lastMove = null;
      });

      const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
      const count = (b, p) => b.flat().filter(v => v === p).length;

      function flips(b, x, y, p) {
        if (b[y][x]) return [];
        const out = [];
        for (const [dx, dy] of D8) {
          const line = [];
          let cx = x + dx;
          let cy = y + dy;
          while (inside(cx, cy) && b[cy][cx] === 3 - p) {
            line.push([cx, cy]);
            cx += dx;
            cy += dy;
          }
          if (line.length && inside(cx, cy) && b[cy][cx] === p) out.push(...line);
        }
        return out;
      }

      function movesFor(b, p) {
        const out = [];
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const f = flips(b, x, y, p);
            if (f.length) out.push({ x, y, f });
          }
        }
        return out;
      }

      function apply(b, mv, p) {
        b[mv.y][mv.x] = p;
        mv.f.forEach(([fx, fy]) => { b[fy][fx] = p; });
      }

      function evaluate(b) {
        let s = 0;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) s += b[y][x] === CPU ? WEIGHT[y][x] : b[y][x] === YOU ? -WEIGHT[y][x] : 0;
        }
        return s + (movesFor(b, CPU).length - movesFor(b, YOU).length) * 3;
      }

      // Minimax score from the computer's point of view.
      function search(b, depth, p, alpha, beta) {
        if (depth === 0) return evaluate(b);
        const moves = movesFor(b, p);
        if (!moves.length) {
          if (!movesFor(b, 3 - p).length) return (count(b, CPU) - count(b, YOU)) * 1000;
          return search(b, depth - 1, 3 - p, alpha, beta);
        }
        let best = p === CPU ? -Infinity : Infinity;
        for (const mv of moves) {
          const c = b.map(row => row.slice());
          apply(c, mv, p);
          const s = search(c, depth - 1, 3 - p, alpha, beta);
          if (p === CPU) {
            best = Math.max(best, s);
            alpha = Math.max(alpha, s);
          } else {
            best = Math.min(best, s);
            beta = Math.min(beta, s);
          }
          if (alpha >= beta) break;
        }
        return best;
      }

      function play(mv, p) {
        apply(board, mv, p);
        lastMove = [mv.x, mv.y];
        const o = 3 - p;
        if (movesFor(board, o).length) m.next(o);
        else if (movesFor(board, p).length) m.next(p);
        else {
          const you = count(board, YOU);
          const cpu = count(board, CPU);
          m.finish(you > cpu ? YOU : cpu > you ? CPU : 'draw');
        }
      }

      function cpuMove() {
        const moves = movesFor(board, CPU);
        if (api.difficulty === 0) {
          play(Math.random() < 0.5 ? util.pick(moves) : moves.reduce((a, b) => (b.f.length > a.f.length ? b : a)), CPU);
          return;
        }
        const depth = api.difficulty === 1 ? 1 : 3;
        let best = -Infinity;
        let choice = moves[0];
        for (const mv of moves) {
          const c = board.map(row => row.slice());
          apply(c, mv, CPU);
          const s = search(c, depth - 1, YOU, -Infinity, Infinity) + Math.random();
          if (s > best) {
            best = s;
            choice = mv;
          }
        }
        play(choice, CPU);
      }

      function tryPlay(x, y) {
        if (!m.canPlay()) return;
        const f = flips(board, x, y, YOU);
        if (f.length) play({ x, y, f }, YOU);
      }

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
      g.draw = rd => {
        const segs = [];
        for (let k = 1; k < N; k++) segs.push(k, 0, k, N, 0, k, N, k);
        rd.lines(segs, 0.03, 'both', WHITE, 0.3);
        board.forEach((row, y) => row.forEach((v, x) => {
          if (v === YOU) rd.circle(x + 0.5, y + 0.5, 0.4, 'amb', [240, 240, 240]);
          else if (v === CPU) rd.circle(x + 0.5, y + 0.5, 0.4, 'fellow', [80, 160, 255]);
        }));
        if (m.canPlay()) movesFor(board, YOU).forEach(mv => rd.circle(mv.x + 0.5, mv.y + 0.5, 0.08, 'both', WHITE, 0.5));
        if (lastMove) rd.ring(lastMove[0] + 0.5, lastMove[1] + 0.5, 0.46, 0.04, 'both', WHITE, 0.6);
        if (showCursor) rd.box(cur.x + 0.05, cur.y + 0.05, 0.9, 0.9, 0.05, 'both', WHITE, 0.8);
      };
      g.hud = () => [m.hud()[0], `Pieces ${count(board, YOU)}\u2013${count(board, CPU)}`, `Won ${m.wins}`, `Lost ${m.losses}`];
      m.start();
      return g;
    },
  });

  DG.register({
    id: 'checkers',
    name: 'Checkers',
    category: 'Strategy',
    description: 'Jump the computer\u2019s pieces to capture them all.',
    help: 'Tap one of your pieces, then a marked square. Pieces move diagonally forward; jumps are compulsory and can chain. Reach the far side to make a king (shown with a ring), which moves both ways. Your pieces are shown to your weaker eye and the computer\u2019s to your stronger eye.',
    width: 8,
    height: 8,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Select' },
    repeat: ['left', 'up', 'down', 'right'],
    create(api) {
      const N = 8;
      const g = {};
      const cur = { x: 0, y: 7 };
      let board;
      let sel = null;
      let plies = 0;
      let lastMove = null;
      let showCursor = false;
      const m = match(g, () => {
        board = util.grid(N, N, null);
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            if ((x + y) % 2 === 0) continue;
            if (y < 3) board[y][x] = { p: CPU, king: false };
            else if (y > 4) board[y][x] = { p: YOU, king: false };
          }
        }
        sel = null;
        plies = 0;
        lastMove = null;
      });

      const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
      const kingRow = p => (p === YOU ? 0 : N - 1);
      const dirsOf = pc => (pc.king ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : pc.p === YOU ? [[1, -1], [-1, -1]] : [[1, 1], [-1, 1]]);
      const clone = b => b.map(row => row.map(c => c && { ...c }));
      const endOf = mv => mv.path[mv.path.length - 1];

      // Collects maximal jump sequences; a man that reaches the far row stops there.
      function jumps(b, x, y, pc, path, caps, out) {
        let extended = false;
        if (pc.king || caps.length === 0 || y !== kingRow(pc.p)) {
          for (const [dx, dy] of dirsOf(pc)) {
            const mx = x + dx;
            const my = y + dy;
            const tx = x + 2 * dx;
            const ty = y + 2 * dy;
            if (!inside(tx, ty) || b[ty][tx]) continue;
            const mid = b[my][mx];
            if (!mid || mid.p === pc.p || caps.some(([cx, cy]) => cx === mx && cy === my)) continue;
            extended = true;
            jumps(b, tx, ty, pc, [...path, [tx, ty]], [...caps, [mx, my]], out);
          }
        }
        if (!extended && caps.length) out.push({ path, caps });
      }

      function movesFor(b, p) {
        const caps = [];
        const simple = [];
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const pc = b[y][x];
            if (!pc || pc.p !== p) continue;
            b[y][x] = null;
            jumps(b, x, y, pc, [[x, y]], [], caps);
            b[y][x] = pc;
            for (const [dx, dy] of dirsOf(pc)) {
              if (inside(x + dx, y + dy) && !b[y + dy][x + dx]) simple.push({ path: [[x, y], [x + dx, y + dy]], caps: [] });
            }
          }
        }
        return caps.length ? caps : simple;
      }

      function apply(b, mv) {
        const [sx, sy] = mv.path[0];
        const [ex, ey] = endOf(mv);
        const pc = { ...b[sy][sx] };
        b[sy][sx] = null;
        mv.caps.forEach(([cx, cy]) => { b[cy][cx] = null; });
        if (ey === kingRow(pc.p)) pc.king = true;
        b[ey][ex] = pc;
      }

      function evaluate(b) {
        let s = 0;
        for (const row of b) for (const c of row) if (c) s += (c.p === CPU ? 1 : -1) * (c.king ? 1.6 : 1);
        return s;
      }

      // Minimax score from the computer's point of view.
      function search(b, depth, p, alpha, beta) {
        const moves = movesFor(b, p);
        if (!moves.length) return p === CPU ? -100 - depth : 100 + depth;
        if (depth === 0) return evaluate(b);
        let best = p === CPU ? -Infinity : Infinity;
        for (const mv of moves) {
          const c = clone(b);
          apply(c, mv);
          const s = search(c, depth - 1, 3 - p, alpha, beta);
          if (p === CPU) {
            best = Math.max(best, s);
            alpha = Math.max(alpha, s);
          } else {
            best = Math.min(best, s);
            beta = Math.min(beta, s);
          }
          if (alpha >= beta) break;
        }
        return best;
      }

      function play(mv, p) {
        apply(board, mv);
        lastMove = mv;
        plies = mv.caps.length ? 0 : plies + 1;
        sel = null;
        if (!movesFor(board, 3 - p).length) m.finish(p);
        else if (plies >= 80) m.finish('draw');
        else m.next(3 - p);
      }

      function cpuMove() {
        const moves = movesFor(board, CPU);
        if (api.difficulty === 0 && Math.random() < 0.5) {
          play(util.pick(moves), CPU);
          return;
        }
        const depth = [1, 3, 5][api.difficulty];
        let best = -Infinity;
        let choice = moves[0];
        for (const mv of moves) {
          const c = clone(board);
          apply(c, mv);
          const s = search(c, depth - 1, YOU, -Infinity, Infinity) + Math.random() * 0.01;
          if (s > best) {
            best = s;
            choice = mv;
          }
        }
        play(choice, CPU);
      }

      function tap(x, y) {
        if (!m.canPlay()) return;
        const moves = movesFor(board, YOU);
        if (moves.some(mv => mv.path[0][0] === x && mv.path[0][1] === y)) {
          sel = [x, y];
          return;
        }
        if (!sel) return;
        const mv = moves.find(o => o.path[0][0] === sel[0] && o.path[0][1] === sel[1] && endOf(o)[0] === x && endOf(o)[1] === y);
        if (mv) play(mv, YOU);
        else sel = null;
      }

      g.update = dt => m.update(dt, cpuMove);
      g.pointer = (type, x, y) => {
        if (type !== 'down' || !inside(Math.floor(x), Math.floor(y))) return;
        showCursor = false;
        tap(Math.floor(x), Math.floor(y));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, N, N) && a === 'action') tap(cur.x, cur.y);
      };
      g.draw = rd => {
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) rd.rect(x, y, 1, 1, 'both', WHITE, 0.07);
        if (lastMove) {
          const segs = [];
          for (let i = 0; i < lastMove.path.length - 1; i++) segs.push(...lastMove.path[i].map(v => v + 0.5), ...lastMove.path[i + 1].map(v => v + 0.5));
          rd.lines(segs, 0.05, 'both', WHITE, 0.3);
        }
        board.forEach((row, y) => row.forEach((pc, x) => {
          if (!pc) return;
          const target = pc.p === YOU ? 'amb' : 'fellow';
          const col = pc.p === YOU ? [255, 80, 80] : [80, 160, 255];
          if (pc.king) {
            rd.circle(x + 0.5, y + 0.5, 0.26, target, col);
            rd.ring(x + 0.5, y + 0.5, 0.4, 0.06, target, col);
          } else {
            rd.circle(x + 0.5, y + 0.5, 0.38, target, col);
          }
        }));
        if (sel) {
          rd.box(sel[0] + 0.03, sel[1] + 0.03, 0.94, 0.94, 0.06, 'both', WHITE, 0.9);
          movesFor(board, YOU)
            .filter(mv => mv.path[0][0] === sel[0] && mv.path[0][1] === sel[1])
            .forEach(mv => rd.circle(endOf(mv)[0] + 0.5, endOf(mv)[1] + 0.5, 0.12, 'both', WHITE, 0.7));
        }
        if (showCursor) rd.box(cur.x + 0.08, cur.y + 0.08, 0.84, 0.84, 0.04, 'both', WHITE, 0.6);
      };
      g.hud = m.hud;
      m.start();
      return g;
    },
  });

  DG.register({
    id: 'battleships',
    name: 'Battleships',
    category: 'Strategy',
    description: 'Find and sink the computer\u2019s fleet before it sinks yours.',
    help: 'Tap a square in the top grid to fire. A cross is a hit and a dot is a miss. Your own fleet is in the bottom grid. Your weaker eye sees the hits; your stronger eye sees the misses and your ships.',
    width: 8,
    height: 16.6,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Fire' },
    repeat: ['left', 'up', 'down', 'right'],
    create(api) {
      const N = 8;
      const SHIPS = [4, 3, 3, 2, 2];
      const BOTTOM = N + 0.6;
      const g = {};
      const cur = { x: 0, y: 0 };
      let mine;
      let theirs;
      let targets = [];
      let showCursor = false;

      function fleet() {
        const ships = [];
        const used = util.grid(N, N, false);
        for (const len of SHIPS) {
          for (;;) {
            const across = Math.random() < 0.5;
            const x = util.randInt(across ? N - len + 1 : N);
            const y = util.randInt(across ? N : N - len + 1);
            const cells = Array.from({ length: len }, (_, k) => (across ? [x + k, y] : [x, y + k]));
            if (cells.some(([cx, cy]) => used[cy][cx])) continue;
            cells.forEach(([cx, cy]) => { used[cy][cx] = true; });
            ships.push({ cells, sunk: false });
            break;
          }
        }
        return { ships, shots: util.grid(N, N, 0) };
      }

      const m = match(g, () => {
        mine = fleet();
        theirs = fleet();
        targets = [];
      });

      const allSunk = side => side.ships.every(s => s.sunk);

      // Marks the shot (1 = miss, 2 = hit) and returns the ship hit, if any.
      function fire(side, x, y) {
        const ship = side.ships.find(s => s.cells.some(([cx, cy]) => cx === x && cy === y));
        side.shots[y][x] = ship ? 2 : 1;
        if (ship && ship.cells.every(([cx, cy]) => side.shots[cy][cx] === 2)) ship.sunk = true;
        return ship;
      }

      function cpuMove() {
        targets = targets.filter(([tx, ty]) => !mine.shots[ty][tx]);
        let shot;
        if (api.difficulty > 0 && targets.length) {
          shot = targets.shift();
        } else {
          const open = [];
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!mine.shots[y][x]) open.push([x, y]);
          const parity = open.filter(([x, y]) => (x + y) % 2 === 0);
          shot = util.pick(api.difficulty === 2 && parity.length ? parity : open);
        }
        const [x, y] = shot;
        const ship = fire(mine, x, y);
        if (ship && !ship.sunk) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < N && ny < N && !mine.shots[ny][nx]) targets.push([nx, ny]);
          }
        }
        if (allSunk(mine)) m.finish(CPU);
        else m.next(YOU);
      }

      function shoot(x, y) {
        if (!m.canPlay() || theirs.shots[y][x]) return;
        fire(theirs, x, y);
        if (allSunk(theirs)) m.finish(YOU);
        else m.next(CPU);
      }

      function marks(rd, side, oy) {
        side.shots.forEach((row, y) => row.forEach((v, x) => {
          const cx = x + 0.5;
          const cy = oy + y + 0.5;
          if (v === 2) rd.lines([cx - 0.28, cy - 0.28, cx + 0.28, cy + 0.28, cx + 0.28, cy - 0.28, cx - 0.28, cy + 0.28], 0.09, 'amb', [255, 80, 80]);
          else if (v === 1) rd.circle(cx, cy, 0.1, 'fellow', WHITE);
        }));
      }

      g.update = dt => m.update(dt, cpuMove);
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= N || y >= N) return;
        showCursor = false;
        shoot(Math.floor(x), Math.floor(y));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, N, N) && a === 'action') shoot(cur.x, cur.y);
      };
      g.draw = rd => {
        for (const oy of [0, BOTTOM]) {
          const segs = [];
          for (let k = 0; k <= N; k++) segs.push(k, oy, k, oy + N, 0, oy + k, N, oy + k);
          rd.lines(segs, 0.03, 'both', WHITE, 0.25);
        }
        mine.ships.forEach(s => s.cells.forEach(([x, y]) => rd.tile(x, BOTTOM + y, 1, 1, 'fellow', [120, 160, 220], 0.6)));
        theirs.ships.filter(s => s.sunk).forEach(s => {
          const xs = s.cells.map(c => c[0]);
          const ys = s.cells.map(c => c[1]);
          const x0 = Math.min(...xs);
          const y0 = Math.min(...ys);
          rd.box(x0 + 0.1, y0 + 0.1, Math.max(...xs) - x0 + 0.8, Math.max(...ys) - y0 + 0.8, 0.06, 'both', WHITE, 0.6);
        });
        marks(rd, theirs, 0);
        marks(rd, mine, BOTTOM);
        if (showCursor) rd.box(cur.x + 0.06, cur.y + 0.06, 0.88, 0.88, 0.05, 'both', WHITE, 0.8);
      };
      g.hud = () => [m.hud()[0], `Enemy ships ${theirs.ships.filter(s => !s.sunk).length}`, `Won ${m.wins}`, `Lost ${m.losses}`];
      m.start();
      return g;
    },
  });

  DG.register({
    id: 'dotsboxes',
    name: 'Dots and Boxes',
    category: 'Strategy',
    description: 'Draw lines between dots and complete boxes to claim them.',
    help: 'Tap between two dots to draw a line. Completing a box claims it and gives you another turn. Most boxes wins. Your lines and boxes are shown to your weaker eye and the computer\u2019s to your stronger eye.',
    width: 5,
    height: 5,
    buttons: ['left', 'right', 'action'],
    labels: { action: 'Draw' },
    repeat: ['left', 'right'],
    create(api) {
      const B = [3, 4, 5][api.difficulty];
      const g = { width: B + 1, height: B + 1 };
      // Lines are keyed 'h,x,y' (dot x,y to x+1,y) or 'v,x,y' (dot x,y to x,y+1); the value is who drew it.
      const all = [];
      for (let y = 0; y <= B; y++) for (let x = 0; x < B; x++) all.push(`h,${x},${y}`);
      for (let y = 0; y < B; y++) for (let x = 0; x <= B; x++) all.push(`v,${x},${y}`);
      let lines;
      let boxes;
      let last = null;
      let cursor = 0;
      let showCursor = false;
      const m = match(g, () => {
        lines = new Map();
        boxes = util.grid(B, B, 0);
        last = null;
      });

      const parse = key => {
        const [t, x, y] = key.split(',');
        return [t, Number(x), Number(y)];
      };
      const sides = (L, x, y) => [`h,${x},${y}`, `h,${x},${y + 1}`, `v,${x},${y}`, `v,${x + 1},${y}`].filter(k => L.has(k)).length;
      const boxesOf = key => {
        const [t, x, y] = parse(key);
        return t === 'h' ? [[x, y - 1], [x, y]].filter(([, by]) => by >= 0 && by < B) : [[x - 1, y], [x, y]].filter(([bx]) => bx >= 0 && bx < B);
      };
      const free = L => all.filter(k => !L.has(k));
      const completes = (L, key) => boxesOf(key).filter(([x, y]) => sides(L, x, y) === 3).length;
      const gives = (L, key) => boxesOf(key).some(([x, y]) => sides(L, x, y) === 2);
      const count = p => boxes.flat().filter(v => v === p).length;
      const segOf = key => {
        const [t, x, y] = parse(key);
        return t === 'h' ? [x + 0.5, y + 0.5, x + 1.5, y + 0.5] : [x + 0.5, y + 0.5, x + 0.5, y + 1.5];
      };

      function draw(key, p) {
        lines.set(key, p);
        last = key;
        let claimed = 0;
        for (const [x, y] of boxesOf(key)) {
          if (sides(lines, x, y) === 4 && !boxes[y][x]) {
            boxes[y][x] = p;
            claimed++;
          }
        }
        if (lines.size === all.length) {
          const you = count(YOU);
          const cpu = count(CPU);
          m.finish(you > cpu ? YOU : cpu > you ? CPU : 'draw');
        } else {
          m.next(claimed ? p : 3 - p);
        }
      }

      // How many boxes the player could then take in a row if the computer draws `key`.
      function cost(key) {
        const L = new Map(lines);
        L.set(key, CPU);
        let n = 0;
        for (;;) {
          const k = free(L).find(f => completes(L, f));
          if (!k) return n;
          n += completes(L, k);
          L.set(k, YOU);
        }
      }

      function cpuMove() {
        const options = free(lines);
        const take = options.find(k => completes(lines, k));
        if (api.difficulty === 0) {
          draw(take && Math.random() < 0.6 ? take : util.pick(options), CPU);
          return;
        }
        if (take) {
          draw(take, CPU);
          return;
        }
        const safe = options.filter(k => !gives(lines, k));
        if (safe.length || api.difficulty === 1) {
          draw(util.pick(safe.length ? safe : options), CPU);
          return;
        }
        let best = Infinity;
        let choice = options[0];
        for (const k of options) {
          const c = cost(k);
          if (c < best) {
            best = c;
            choice = k;
          }
        }
        draw(choice, CPU);
      }

      g.update = dt => m.update(dt, cpuMove);
      g.pointer = (type, x, y) => {
        if (type !== 'down' || !m.canPlay()) return;
        showCursor = false;
        let best = null;
        let bd = 0.45;
        for (const k of free(lines)) {
          const [x1, y1, x2, y2] = segOf(k);
          const d = Math.hypot((x1 + x2) / 2 - x, (y1 + y2) / 2 - y);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        if (best) draw(best, YOU);
      };
      g.action = a => {
        showCursor = true;
        const options = free(lines);
        if (!options.length) return;
        if (a === 'left') cursor = (cursor + options.length - 1) % options.length;
        else if (a === 'right') cursor = (cursor + 1) % options.length;
        else if (a === 'action' && m.canPlay()) draw(options[cursor % options.length], YOU);
      };
      g.draw = rd => {
        boxes.forEach((row, y) => row.forEach((p, x) => {
          if (p) rd.rect(x + 0.62, y + 0.62, 0.76, 0.76, p === YOU ? 'amb' : 'fellow', p === YOU ? [255, 80, 80] : [80, 160, 255], 0.35);
        }));
        const mine = [];
        const theirs = [];
        for (const [k, p] of lines) (p === YOU ? mine : theirs).push(...segOf(k));
        rd.lines(mine, 0.1, 'amb', [255, 80, 80]);
        rd.lines(theirs, 0.1, 'fellow', [80, 160, 255]);
        if (last) rd.line(...segOf(last), 0.22, 'both', WHITE, 0.2);
        const options = free(lines);
        if (showCursor && options.length && m.canPlay()) rd.line(...segOf(options[cursor % options.length]), 0.06, 'both', WHITE, 0.6);
        for (let y = 0; y <= B; y++) for (let x = 0; x <= B; x++) rd.circle(x + 0.5, y + 0.5, 0.09, 'both', WHITE, 0.9);
      };
      g.hud = () => [m.hud()[0], `Boxes ${count(YOU)}\u2013${count(CPU)}`, `Won ${m.wins}`, `Lost ${m.losses}`];
      m.start();
      return g;
    },
  });

  DG.register({
    id: 'mancala',
    name: 'Mancala',
    category: 'Strategy',
    description: 'Sow stones around the board and capture more than the computer.',
    help: 'Tap one of your pits (bottom row) to pick up its stones and sow them one at a time anticlockwise. If the last stone lands in your store (right), you go again. If it lands in an empty pit on your side, you capture it and the stones opposite. Most stones in your store wins. Your stones are shown to your weaker eye and the computer\u2019s to your stronger eye.',
    width: 8,
    height: 5,
    buttons: ['left', 'right', 'action'],
    labels: { action: 'Sow' },
    create(api) {
      const STORE = { [YOU]: 6, [CPU]: 13 };
      const PITS = { [YOU]: [0, 1, 2, 3, 4, 5], [CPU]: [7, 8, 9, 10, 11, 12] };
      const g = {};
      let board;
      let last = -1;
      let cursor = 0;
      let showCursor = false;
      const m = match(g, () => {
        board = Array(14).fill(4);
        board[6] = 0;
        board[13] = 0;
        last = -1;
      });

      function sow(b, i, p) {
        let n = b[i];
        let k = i;
        b[i] = 0;
        while (n) {
          k = (k + 1) % 14;
          if (k === STORE[3 - p]) continue;
          b[k]++;
          n--;
        }
        if (k !== STORE[p] && b[k] === 1 && PITS[p].includes(k) && b[12 - k] > 0) {
          b[STORE[p]] += b[12 - k] + 1;
          b[k] = 0;
          b[12 - k] = 0;
        }
        return { again: k === STORE[p], k };
      }
      const over = b => PITS[YOU].every(i => !b[i]) || PITS[CPU].every(i => !b[i]);
      function sweep(b) {
        for (const p of [YOU, CPU]) {
          for (const i of PITS[p]) {
            b[STORE[p]] += b[i];
            b[i] = 0;
          }
        }
      }

      // Minimax score from the computer's point of view.
      function search(b, depth, p) {
        if (over(b)) {
          const c = b.slice();
          sweep(c);
          return (c[13] - c[6]) * 100;
        }
        if (depth === 0) return b[13] - b[6];
        let best = p === CPU ? -Infinity : Infinity;
        for (const i of PITS[p]) {
          if (!b[i]) continue;
          const c = b.slice();
          const { again } = sow(c, i, p);
          const s = search(c, depth - 1, again ? p : 3 - p);
          best = p === CPU ? Math.max(best, s) : Math.min(best, s);
        }
        return best;
      }

      function play(i, p) {
        const { again, k } = sow(board, i, p);
        last = k;
        if (over(board)) {
          sweep(board);
          m.finish(board[6] > board[13] ? YOU : board[13] > board[6] ? CPU : 'draw');
        } else {
          m.next(again ? p : 3 - p);
        }
      }

      function cpuMove() {
        const moves = PITS[CPU].filter(i => board[i]);
        if (api.difficulty === 0 && Math.random() < 0.5) {
          play(util.pick(moves), CPU);
          return;
        }
        const depth = [2, 4, 6][api.difficulty];
        let best = -Infinity;
        let choice = moves[0];
        for (const i of moves) {
          const c = board.slice();
          const { again } = sow(c, i, CPU);
          const s = search(c, depth - 1, again ? CPU : YOU) + Math.random() * 0.5;
          if (s > best) {
            best = s;
            choice = i;
          }
        }
        play(choice, CPU);
      }

      const tryPlay = i => {
        if (m.canPlay() && board[i]) play(i, YOU);
      };
      const pitX = i => (i < 6 ? 1.5 + i : 1.5 + (12 - i));
      const pitY = i => (i < 6 ? 3.4 : 1.6);

      g.update = dt => m.update(dt, cpuMove);
      g.pointer = (type, x, y) => {
        if (type !== 'down' || y < 2.5 || x < 1 || x >= 7) return;
        showCursor = false;
        tryPlay(Math.floor(x - 1));
      };
      g.action = a => {
        showCursor = true;
        if (a === 'left') cursor = Math.max(0, cursor - 1);
        else if (a === 'right') cursor = Math.min(5, cursor + 1);
        else if (a === 'action') tryPlay(cursor);
      };

      function stones(rd, x, y, n, target, colour) {
        for (let j = 0; j < Math.min(n, 15); j++) {
          const ang = j * 2.4;
          const rad = 0.1 * Math.sqrt(j);
          rd.circle(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 0.065, target, colour);
        }
      }

      g.draw = rd => {
        const eye = p => (p === YOU ? 'amb' : 'fellow');
        const colour = p => (p === YOU ? [255, 200, 80] : [120, 180, 255]);
        for (const p of [YOU, CPU]) {
          for (const i of PITS[p]) {
            const x = pitX(i);
            const y = pitY(i);
            rd.ring(x, y, 0.44, 0.04, 'both', WHITE, 0.4);
            stones(rd, x, y, board[i], eye(p), colour(p));
            rd.text(board[i], x, p === YOU ? 4.4 : 0.6, 0.42, eye(p), WHITE);
          }
          const sx = p === YOU ? 7 : 0;
          rd.box(sx + 0.1, 1.1, 0.8, 2.8, 0.04, 'both', WHITE, 0.4);
          rd.text(board[STORE[p]], sx + 0.5, 2.5, 0.5, eye(p), WHITE);
        }
        if (last >= 0 && last !== 6 && last !== 13) rd.ring(pitX(last), pitY(last), 0.5, 0.05, 'both', WHITE, 0.7);
        if (showCursor && m.canPlay()) rd.box(pitX(cursor) - 0.5, 2.9, 1, 1, 0.05, 'both', WHITE, 0.8);
      };
      g.hud = () => [m.hud()[0], `Store ${board[6]}\u2013${board[13]}`, `Won ${m.wins}`, `Lost ${m.losses}`];
      m.start();
      return g;
    },
  });

  {
    const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    const GLYPH = { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E' };
    const BACK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const MATE = 100000;
    // Castling rights as bits: your king side, your queen side, computer king side, computer queen side.
    const RIGHTS = { [YOU]: { k: 1, q: 2 }, [CPU]: { k: 4, q: 8 } };
    const at = (x, y) => y * 8 + x;
    const on = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8;
    const fwd = c => (c === YOU ? -1 : 1);
    const home = c => (c === YOU ? 7 : 0);

    function initial(turn) {
      const b = Array(64).fill(null);
      BACK.forEach((t, x) => {
        b[at(x, 0)] = { t, c: CPU };
        b[at(x, 1)] = { t: 'p', c: CPU };
        b[at(x, 6)] = { t: 'p', c: YOU };
        b[at(x, 7)] = { t, c: YOU };
      });
      return { b, turn, castle: 15, ep: -1, half: 0 };
    }

    function attacked(b, sq, by) {
      const x = sq % 8;
      const y = Math.floor(sq / 8);
      for (const dx of [-1, 1]) {
        const px = x + dx;
        const py = y - fwd(by);
        const p = on(px, py) && b[at(px, py)];
        if (p && p.c === by && p.t === 'p') return true;
      }
      for (const [dx, dy] of KNIGHT) {
        const p = on(x + dx, y + dy) && b[at(x + dx, y + dy)];
        if (p && p.c === by && p.t === 'n') return true;
      }
      for (const [dx, dy] of KING) {
        const p = on(x + dx, y + dy) && b[at(x + dx, y + dy)];
        if (p && p.c === by && p.t === 'k') return true;
      }
      for (const [dirs, kinds] of [[ROOK, 'rq'], [BISHOP, 'bq']]) {
        for (const [dx, dy] of dirs) {
          let nx = x + dx;
          let ny = y + dy;
          while (on(nx, ny)) {
            const p = b[at(nx, ny)];
            if (p) {
              if (p.c === by && kinds.includes(p.t)) return true;
              break;
            }
            nx += dx;
            ny += dy;
          }
        }
      }
      return false;
    }

    const kingOf = (b, c) => b.findIndex(p => p && p.t === 'k' && p.c === c);
    const inCheck = s => attacked(s.b, kingOf(s.b, s.turn), 3 - s.turn);

    function pseudo(s) {
      const { b, turn: c } = s;
      const out = [];
      const add = (f, t, extra) => out.push({ f, t, ...extra });
      b.forEach((p, f) => {
        if (!p || p.c !== c) return;
        const x = f % 8;
        const y = Math.floor(f / 8);
        if (p.t === 'p') {
          const d = fwd(c);
          const last = home(3 - c);
          const push = (t, extra = {}) => add(f, t, Math.floor(t / 8) === last ? { ...extra, promo: true } : extra);
          if (on(x, y + d) && !b[at(x, y + d)]) {
            push(at(x, y + d));
            if (y === home(c) + d && !b[at(x, y + 2 * d)]) add(f, at(x, y + 2 * d), { double: true });
          }
          for (const dx of [-1, 1]) {
            if (!on(x + dx, y + d)) continue;
            const t = at(x + dx, y + d);
            if (b[t] && b[t].c !== c) push(t);
            else if (t === s.ep) add(f, t, { ep: true });
          }
          return;
        }
        if (p.t === 'n' || p.t === 'k') {
          for (const [dx, dy] of p.t === 'n' ? KNIGHT : KING) {
            if (!on(x + dx, y + dy)) continue;
            const t = at(x + dx, y + dy);
            if (!b[t] || b[t].c !== c) add(f, t);
          }
        } else {
          const dirs = p.t === 'r' ? ROOK : p.t === 'b' ? BISHOP : [...ROOK, ...BISHOP];
          for (const [dx, dy] of dirs) {
            let nx = x + dx;
            let ny = y + dy;
            while (on(nx, ny)) {
              const t = at(nx, ny);
              if (b[t]) {
                if (b[t].c !== c) add(f, t);
                break;
              }
              add(f, t);
              nx += dx;
              ny += dy;
            }
          }
        }
        if (p.t === 'k' && f === at(4, home(c)) && !attacked(b, f, 3 - c)) {
          const r = home(c);
          const rook = x2 => b[at(x2, r)] && b[at(x2, r)].t === 'r' && b[at(x2, r)].c === c;
          if (s.castle & RIGHTS[c].k && rook(7) && !b[at(5, r)] && !b[at(6, r)] && !attacked(b, at(5, r), 3 - c) && !attacked(b, at(6, r), 3 - c)) {
            add(f, at(6, r), { castle: 'k' });
          }
          if (s.castle & RIGHTS[c].q && rook(0) && !b[at(1, r)] && !b[at(2, r)] && !b[at(3, r)] && !attacked(b, at(3, r), 3 - c) && !attacked(b, at(2, r), 3 - c)) {
            add(f, at(2, r), { castle: 'q' });
          }
        }
      });
      return out;
    }

    function apply(s, mv) {
      const b = s.b.slice();
      const p = b[mv.f];
      const captured = b[mv.t];
      b[mv.t] = mv.promo ? { t: 'q', c: p.c } : p;
      b[mv.f] = null;
      const r = home(p.c);
      if (mv.ep) b[mv.t - 8 * fwd(p.c)] = null;
      if (mv.castle === 'k') {
        b[at(5, r)] = b[at(7, r)];
        b[at(7, r)] = null;
      } else if (mv.castle === 'q') {
        b[at(3, r)] = b[at(0, r)];
        b[at(0, r)] = null;
      }
      let castle = s.castle;
      if (p.t === 'k') castle &= ~(RIGHTS[p.c].k | RIGHTS[p.c].q);
      for (const c of [YOU, CPU]) {
        for (const sq of [mv.f, mv.t]) {
          if (sq === at(7, home(c))) castle &= ~RIGHTS[c].k;
          if (sq === at(0, home(c))) castle &= ~RIGHTS[c].q;
        }
      }
      return {
        b,
        turn: 3 - s.turn,
        castle,
        ep: mv.double ? (mv.f + mv.t) / 2 : -1,
        half: p.t === 'p' || captured ? 0 : s.half + 1,
      };
    }

    const legal = s => pseudo(s).filter(mv => isLegal(s, mv));
    function isLegal(s, mv) {
      const n = apply(s, mv);
      return !attacked(n.b, kingOf(n.b, s.turn), n.turn);
    }

    function insufficient(b) {
      const rest = b.filter(p => p && p.t !== 'k');
      return !rest.length || (rest.length === 1 && 'nb'.includes(rest[0].t));
    }

    // Material plus small bonuses for central pieces and advanced pawns, from the computer's side.
    function evaluate(b) {
      let score = 0;
      b.forEach((p, i) => {
        if (!p) return;
        const x = i % 8;
        const y = Math.floor(i / 8);
        const centre = 3.5 - Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5));
        let v = VALUE[p.t];
        if (p.t === 'n' || p.t === 'b') v += centre * 8;
        else if (p.t === 'p') v += Math.abs(y - (p.c === YOU ? 6 : 1)) * 6 + (x === 3 || x === 4 ? 6 : 0);
        else if (p.t === 'q') v += centre * 3;
        else if (p.t === 'k') v += y === home(p.c) ? 10 : 0;
        score += p.c === CPU ? v : -v;
      });
      return score;
    }

    const order = (s, moves) => moves.sort((a, b2) => {
      const gain = mv => (s.b[mv.t] ? VALUE[s.b[mv.t].t] * 10 - VALUE[s.b[mv.f].t] : 0) + (mv.promo ? 8000 : 0);
      return gain(b2) - gain(a);
    });
    const relative = s => (s.turn === CPU ? 1 : -1) * evaluate(s.b);

    function quiesce(s, alpha, beta, qd) {
      const stand = relative(s);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (qd >= 4) return alpha;
      for (const mv of order(s, pseudo(s).filter(mv => (s.b[mv.t] || mv.promo) && isLegal(s, mv)))) {
        const v = -quiesce(apply(s, mv), -beta, -alpha, qd + 1);
        if (v >= beta) return v;
        if (v > alpha) alpha = v;
      }
      return alpha;
    }

    function search(s, depth, alpha, beta, ply) {
      const moves = legal(s);
      if (!moves.length) return inCheck(s) ? -MATE + ply : 0;
      if (s.half >= 100) return 0;
      if (depth === 0) return quiesce(s, alpha, beta, 0);
      for (const mv of order(s, moves)) {
        const v = -search(apply(s, mv), depth - 1, -beta, -alpha, ply + 1);
        if (v >= beta) return v;
        if (v > alpha) alpha = v;
      }
      return alpha;
    }

    const keyOf = s => s.b.map(p => (p ? p.c + p.t : '.')).join('') + s.turn + s.castle + s.ep;

    DG.register({
      id: 'chess',
      name: 'Chess',
      category: 'Strategy',
      description: 'Checkmate the computer\u2019s king.',
      help: 'Tap one of your pieces (bottom), then a marked square to move it. All the normal rules apply, including castling, en passant and promotion (pawns become queens). Your pieces are shown to your weaker eye and the computer\u2019s to your stronger eye.',
      width: 8,
      height: 8,
      buttons: ['left', 'up', 'down', 'right', 'action'],
      labels: { action: 'Select' },
      create(api) {
        const g = {};
        const cur = { x: 4, y: 6 };
        let state;
        let moves = [];
        let sel = -1;
        let last = null;
        let seen;
        let showCursor = false;
        let drawReason = '';
        const m = match(g, () => {
          state = initial(m.starter);
          moves = legal(state);
          sel = -1;
          last = null;
          seen = new Map([[keyOf(state), 1]]);
          drawReason = '';
        });

        function play(mv) {
          state = apply(state, mv);
          last = mv;
          sel = -1;
          const key = keyOf(state);
          seen.set(key, (seen.get(key) || 0) + 1);
          moves = legal(state);
          if (!moves.length) {
            drawReason = inCheck(state) ? '' : 'Stalemate';
            m.finish(inCheck(state) ? 3 - state.turn : 'draw');
          } else if (state.half >= 100 || insufficient(state.b) || seen.get(key) >= 3) {
            drawReason = state.half >= 100 ? '50-move rule' : insufficient(state.b) ? 'Not enough pieces' : 'Repetition';
            m.finish('draw');
          } else {
            m.next(state.turn);
          }
        }

        function cpuMove() {
          if (api.difficulty === 0 && Math.random() < 0.35) {
            play(util.pick(moves));
            return;
          }
          const depth = [1, 2, 3][api.difficulty];
          let alpha = -Infinity;
          let best = moves[0];
          // Shuffling before the stable sort varies the choice between equal moves without upsetting the search.
          for (const mv of order(state, util.shuffle(moves.slice()))) {
            const v = -search(apply(state, mv), depth - 1, -Infinity, -alpha, 1);
            if (v > alpha) {
              alpha = v;
              best = mv;
            }
          }
          play(best);
        }

        function choose(sq) {
          if (!m.canPlay()) return;
          const mv = sel >= 0 && moves.find(q => q.f === sel && q.t === sq);
          if (mv) {
            play(mv);
            return;
          }
          const p = state.b[sq];
          sel = p && p.c === YOU && sel !== sq ? sq : -1;
        }

        g.update = dt => m.update(dt, cpuMove);
        g.pointer = (type, x, y) => {
          if (type !== 'down' || !on(Math.floor(x), Math.floor(y))) return;
          showCursor = false;
          choose(at(Math.floor(x), Math.floor(y)));
        };
        g.action = a => {
          showCursor = true;
          if (!moveCursor(cur, a, 8, 8) && a === 'action') choose(at(cur.x, cur.y));
        };

        function piece(rd, p, x, y) {
          const target = p.c === YOU ? 'amb' : 'fellow';
          const col = p.c === YOU ? [255, 210, 120] : [140, 190, 255];
          if (p.t === 'p') {
            rd.circle(x + 0.5, y + 0.36, 0.13, target, col);
            rd.poly([x + 0.42, y + 0.48, x + 0.58, y + 0.48, x + 0.7, y + 0.8, x + 0.3, y + 0.8], target, col);
          } else {
            rd.text(GLYPH[p.t], x + 0.5, y + 0.56, 0.78, target, col);
          }
        }

        g.draw = rd => {
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) rd.rect(x, y, 1, 1, 'both', WHITE, 0.07);
          if (last) for (const sq of [last.f, last.t]) rd.rect(sq % 8, Math.floor(sq / 8), 1, 1, 'both', [255, 230, 120], 0.12);
          if (inCheck(state)) {
            const k = kingOf(state.b, state.turn);
            rd.ring((k % 8) + 0.5, Math.floor(k / 8) + 0.5, 0.46, 0.07, 'both', [255, 90, 90], 0.9);
          }
          state.b.forEach((p, i) => { if (p) piece(rd, p, i % 8, Math.floor(i / 8)); });
          if (sel >= 0) {
            rd.box((sel % 8) + 0.04, Math.floor(sel / 8) + 0.04, 0.92, 0.92, 0.06, 'both', WHITE, 0.9);
            for (const mv of moves) {
              if (mv.f !== sel) continue;
              const tx = (mv.t % 8) + 0.5;
              const ty = Math.floor(mv.t / 8) + 0.5;
              if (state.b[mv.t]) rd.ring(tx, ty, 0.42, 0.05, 'both', WHITE, 0.7);
              else rd.circle(tx, ty, 0.12, 'both', WHITE, 0.7);
            }
          }
          if (showCursor) rd.box(cur.x + 0.08, cur.y + 0.08, 0.84, 0.84, 0.04, 'both', WHITE, 0.6);
        };
        g.hud = () => {
          const status = m.result === 'draw' && drawReason ? `Draw \u2013 ${drawReason}` : !m.result && inCheck(state) ? `Check! ${m.hud()[0]}` : m.hud()[0];
          return [status, `Won ${m.wins}`, `Lost ${m.losses}`, `Draws ${m.draws}`];
        };
        m.start();
        return g;
      },
    });
  }

  {
    const GW = 8;
    const GH = 11;
    const BAR = 11.25;
    const WAYPOINTS = [[1.5, -0.5], [1.5, 2.5], [6.5, 2.5], [6.5, 5.5], [1.5, 5.5], [1.5, 8.5], [6.5, 8.5], [6.5, 11]];
    const TOWERS = [
      { name: 'Bolt', cost: 10, range: 2.2, damage: 4, rate: 0.45, colour: [255, 220, 80] },
      { name: 'Cannon', cost: 20, range: 2, damage: 9, rate: 1.3, splash: 0.9, colour: [255, 140, 80] },
      { name: 'Frost', cost: 15, range: 1.8, damage: 1.5, rate: 0.8, slow: 1.6, colour: [120, 220, 255] },
    ];
    const KINDS = {
      normal: { hp: 1, speed: 1.2, bounty: 2 },
      fast: { hp: 0.55, speed: 2.1, bounty: 2 },
      tank: { hp: 3.2, speed: 0.75, bounty: 5 },
    };
    const SEGMENTS = [];
    let PATH_LENGTH = 0;
    for (let i = 1; i < WAYPOINTS.length; i++) {
      const [x1, y1] = WAYPOINTS[i - 1];
      const [x2, y2] = WAYPOINTS[i];
      const len = Math.hypot(x2 - x1, y2 - y1);
      SEGMENTS.push({ x1, y1, x2, y2, start: PATH_LENGTH, len });
      PATH_LENGTH += len;
    }
    const pointAt = d => {
      const s = SEGMENTS.find(q => d <= q.start + q.len) || SEGMENTS[SEGMENTS.length - 1];
      const t = util.clamp((d - s.start) / s.len, 0, 1);
      return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t];
    };
    const ON_PATH = new Set();
    for (let d = 0; d <= PATH_LENGTH; d += 0.25) {
      const [x, y] = pointAt(d);
      if (y >= 0 && y < GH) ON_PATH.add(`${Math.floor(x)},${Math.floor(y)}`);
    }

    DG.register({
      id: 'towerdefence',
      name: 'Tower Defence',
      category: 'Strategy',
      description: 'Build towers along the road to stop every wave of invaders.',
      help: 'Choose a tower at the bottom, then tap an empty square to build it. Tap a tower to upgrade it. Tap Go (or wait) to send the next wave. Invaders that reach the bottom cost a life. Your weaker eye sees the invaders; your stronger eye sees the road, towers and their shots.',
      width: GW,
      height: 12.5,
      buttons: ['left', 'up', 'down', 'right', 'action'],
      labels: { action: 'Build' },
      repeat: ['left', 'up', 'down', 'right'],
      create(api) {
        const d = api.difficulty;
        const BREAK = [20, 15, 10][d];
        const g = { score: 0 };
        const cur = { x: 3, y: 9 };
        let money = [60, 50, 40][d];
        let lives = [15, 10, 6][d];
        let wave = 0;
        let towers = [];
        let enemies = [];
        let effects = [];
        let queue = [];
        let spawnIn = 0;
        let breakTime = BREAK;
        let building = true;
        let type = 0;
        let showCursor = false;
        let focus = null;

        const towerAt = (x, y) => towers.find(t => t.x === x && t.y === y);
        const stats = t => {
          const base = TOWERS[t.type];
          return { ...base, damage: base.damage * 1.6 ** (t.level - 1), range: base.range + 0.3 * (t.level - 1) };
        };
        const upgradeCost = t => TOWERS[t.type].cost * t.level;

        function startWave() {
          if (!building) return;
          building = false;
          wave++;
          const hp = 10 * [1.14, 1.17, 1.2][d] ** (wave - 1) * [0.75, 1, 1.3][d];
          const count = 6 + wave * 2;
          queue = [];
          for (let i = 0; i < count; i++) {
            let kind = 'normal';
            if (wave % 3 === 0 && i % 2 === 0) kind = 'fast';
            if (wave >= 4 && i % Math.max(3, 8 - Math.floor(wave / 3)) === 0) kind = 'tank';
            queue.push({ kind, hp: hp * KINDS[kind].hp });
          }
          spawnIn = 0.5;
        }

        function tapCell(x, y) {
          if (ON_PATH.has(`${x},${y}`)) return;
          const t = towerAt(x, y);
          if (t) {
            focus = { t, time: 1.5 };
            if (t.level < 3 && money >= upgradeCost(t)) {
              money -= upgradeCost(t);
              t.level++;
            }
            return;
          }
          if (money < TOWERS[type].cost) return;
          money -= TOWERS[type].cost;
          const nt = { x, y, type, level: 1, cool: 0 };
          towers.push(nt);
          focus = { t: nt, time: 1.5 };
        }

        function tapBar(i) {
          if (i < 3) type = i;
          else startWave();
        }

        function hit(e, dmg) {
          e.hp -= dmg;
          if (e.hp <= 0 && !e.dead) {
            e.dead = true;
            money += KINDS[e.kind].bounty + Math.floor(wave / 4);
          }
        }

        g.pointer = (type2, x, y) => {
          if (type2 !== 'down') return;
          showCursor = false;
          if (y >= BAR && x >= 0 && x < GW) tapBar(Math.floor(x / 2));
          else if (x >= 0 && y >= 0 && x < GW && y < GH) tapCell(Math.floor(x), Math.floor(y));
        };
        g.action = a => {
          showCursor = true;
          if (moveCursor(cur, a, GW, GH + 1)) return;
          if (a !== 'action') return;
          if (cur.y === GH) tapBar(Math.floor(cur.x / 2));
          else tapCell(cur.x, cur.y);
        };

        g.update = dt => {
          if (focus && (focus.time -= dt) <= 0) focus = null;
          effects.forEach(f => { f.t -= dt; });
          effects = effects.filter(f => f.t > 0);
          if (building) {
            breakTime -= dt;
            if (breakTime <= 0) startWave();
            return;
          }
          if (queue.length) {
            spawnIn -= dt;
            if (spawnIn <= 0) {
              const q = queue.shift();
              enemies.push({ ...q, max: q.hp, dist: 0, slow: 0 });
              spawnIn = q.kind === 'fast' ? 0.45 : 0.75;
            }
          }
          for (const e of enemies) {
            e.slow = Math.max(0, e.slow - dt);
            e.dist += KINDS[e.kind].speed * (e.slow > 0 ? 0.5 : 1) * dt;
            if (e.dist >= PATH_LENGTH && !e.dead) {
              e.dead = true;
              e.escaped = true;
              lives--;
            }
          }
          for (const t of towers) {
            t.cool -= dt;
            if (t.cool > 0) continue;
            const s = stats(t);
            const cx = t.x + 0.5;
            const cy = t.y + 0.5;
            let target = null;
            for (const e of enemies) {
              if (e.dead) continue;
              const [ex, ey] = pointAt(e.dist);
              if (Math.hypot(ex - cx, ey - cy) <= s.range && (!target || e.dist > target.dist)) target = e;
            }
            if (!target) continue;
            t.cool = s.rate;
            const [tx, ty] = pointAt(target.dist);
            if (s.splash) {
              for (const e of enemies) {
                const [ex, ey] = pointAt(e.dist);
                if (!e.dead && Math.hypot(ex - tx, ey - ty) <= s.splash) hit(e, s.damage);
              }
              effects.push({ kind: 'blast', x: tx, y: ty, r: s.splash, t: 0.25 });
            } else {
              if (s.slow) target.slow = s.slow;
              hit(target, s.damage);
              effects.push({ kind: 'beam', x1: cx, y1: cy, x2: tx, y2: ty, colour: s.colour, t: 0.1 });
            }
          }
          enemies = enemies.filter(e => !e.dead);
          if (lives <= 0) {
            api.gameOver(`The invaders got through on wave ${wave}`);
            return;
          }
          if (!queue.length && !enemies.length) {
            g.score = wave;
            money += 10 + wave * 2;
            building = true;
            breakTime = BREAK;
          }
        };

        function towerShape(rd, t, x, y, size, target, strength = 1) {
          const col = TOWERS[t].colour;
          if (t === 0) rd.circle(x, y, size, target, col, strength);
          else if (t === 1) rd.rect(x - size, y - size, size * 2, size * 2, target, col, strength);
          else rd.poly([x, y - size * 1.25, x + size * 1.1, y, x, y + size * 1.25, x - size * 1.1, y], target, col, strength);
        }

        g.draw = rd => {
          for (const key of ON_PATH) {
            const [x, y] = key.split(',').map(Number);
            rd.rect(x, y, 1, 1, 'fellow', [150, 120, 80], 0.45);
          }
          rd.lines([0, GH, GW, GH], 0.04, 'both', WHITE, 0.4);
          for (const t of towers) {
            towerShape(rd, t.type, t.x + 0.5, t.y + 0.5, 0.28, 'fellow');
            for (let i = 0; i < t.level; i++) rd.circle(t.x + 0.25 + i * 0.25, t.y + 0.88, 0.06, 'fellow', WHITE);
          }
          if (focus) rd.ring(focus.t.x + 0.5, focus.t.y + 0.5, stats(focus.t).range, 0.04, 'both', WHITE, 0.5);
          for (const e of enemies) {
            const [x, y] = pointAt(e.dist);
            const col = e.slow > 0 ? [150, 200, 255] : e.kind === 'fast' ? [255, 170, 60] : e.kind === 'tank' ? [220, 90, 255] : [255, 80, 80];
            if (e.kind === 'fast') rd.poly([x, y - 0.25, x + 0.24, y + 0.2, x - 0.24, y + 0.2], 'amb', col);
            else if (e.kind === 'tank') rd.rect(x - 0.3, y - 0.3, 0.6, 0.6, 'amb', col);
            else rd.circle(x, y, 0.24, 'amb', col);
            rd.rect(x - 0.3, y - 0.45, 0.6 * Math.max(0, e.hp / e.max), 0.06, 'amb', WHITE, 0.8);
          }
          for (const f of effects) {
            if (f.kind === 'beam') rd.line(f.x1, f.y1, f.x2, f.y2, 0.06, 'fellow', f.colour, f.t * 8);
            else rd.ring(f.x, f.y, f.r, 0.07, 'fellow', TOWERS[1].colour, f.t * 4);
          }
          TOWERS.forEach((tw, i) => {
            const x = i * 2;
            rd.box(x + 0.08, BAR, 1.84, 1.15, i === type ? 0.08 : 0.03, 'both', WHITE, i === type ? 0.9 : 0.3);
            towerShape(rd, i, x + 0.55, BAR + 0.57, 0.22, 'fellow', money >= tw.cost ? 1 : 0.35);
            rd.text(tw.cost, x + 1.35, BAR + 0.6, 0.38, 'both', WHITE, money >= tw.cost ? 0.9 : 0.4);
          });
          rd.box(6.08, BAR, 1.84, 1.15, 0.05, 'both', WHITE, building ? 0.8 : 0.2);
          rd.text(building ? `Go ${Math.ceil(breakTime)}` : 'Wave', 7, BAR + 0.6, 0.38, 'both', WHITE, building ? 0.9 : 0.4);
          if (showCursor) rd.box(cur.y === GH ? Math.floor(cur.x / 2) * 2 + 0.02 : cur.x + 0.04, cur.y === GH ? BAR - 0.06 : cur.y + 0.04, cur.y === GH ? 1.96 : 0.92, cur.y === GH ? 1.27 : 0.92, 0.05, 'both', WHITE, 0.9);
        };
        g.hud = () => [building ? `Wave ${wave + 1} next` : `Wave ${wave}`, `Lives ${lives}`, `Gold ${money}`];
        return g;
      },
    });
  }
})();
