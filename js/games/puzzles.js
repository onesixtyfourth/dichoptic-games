'use strict';

(() => {
  const { util, WHITE, SYMBOL_COLOURS, symbol } = DG;
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  function moveCursor(cur, a, w, h) {
    const d = DIRS[a];
    if (!d) return false;
    cur.x = util.clamp(cur.x + d[0], 0, w - 1);
    cur.y = util.clamp(cur.y + d[1], 0, h - 1);
    return true;
  }

  DG.register({
    id: 'maze',
    name: 'Maze',
    category: 'Puzzles',
    description: 'Find your way from the start to the exit.',
    help: 'Move one step at a time with the arrows or by swiping. Your weaker eye sees you and the exit; your stronger eye sees the walls.',
    width: 11,
    height: 15,
    buttons: ['left', 'up', 'down', 'right'],
    repeat: ['left', 'up', 'down', 'right'],
    swipe: true,
    create(api) {
      const [W, H] = [[8, 11], [11, 15], [14, 20]][api.difficulty];
      const WALL = { up: 1, right: 2, down: 4, left: 8 };
      const g = { score: 0, width: W, height: H };
      let cells;
      let px;
      let py;

      function build() {
        cells = util.grid(W, H, 15);
        const seen = util.grid(W, H, false);
        const stack = [[0, 0]];
        seen[0][0] = true;
        const opts = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
        while (stack.length) {
          const [x, y] = stack[stack.length - 1];
          const open = opts.filter(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            return nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[ny][nx];
          });
          if (!open.length) {
            stack.pop();
            continue;
          }
          const [dx, dy, wall, opp] = util.pick(open);
          cells[y][x] &= ~wall;
          cells[y + dy][x + dx] &= ~opp;
          seen[y + dy][x + dx] = true;
          stack.push([x + dx, y + dy]);
        }
        px = 0;
        py = 0;
      }
      build();

      g.action = a => {
        if (!DIRS[a] || cells[py][px] & WALL[a]) return;
        px += DIRS[a][0];
        py += DIRS[a][1];
        if (px === W - 1 && py === H - 1) {
          g.score++;
          build();
        }
      };
      g.draw = r => {
        const segs = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const c = cells[y][x];
            if (c & 1) segs.push(x, y, x + 1, y);
            if (c & 8) segs.push(x, y, x, y + 1);
            if (x === W - 1 && c & 2) segs.push(x + 1, y, x + 1, y + 1);
            if (y === H - 1 && c & 4) segs.push(x, y + 1, x + 1, y + 1);
          }
        }
        r.lines(segs, 0.12, 'fellow', [120, 200, 255]);
        r.rect(W - 0.8, H - 0.8, 0.6, 0.6, 'amb', [60, 220, 80], 0.8);
        r.circle(px + 0.5, py + 0.5, 0.32, 'amb', [255, 220, 0]);
      };
      g.hud = () => [`Mazes ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'memory',
    name: 'Memory Match',
    category: 'Puzzles',
    description: 'Flip cards and find all the matching pairs.',
    help: 'Tap two cards to turn them over. Find every pair in as few moves as you can. Your weaker eye sees the letters; your stronger eye sees the face-down cards.',
    width: 4,
    height: 5,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Flip' },
    lowerIsBetter: true,
    create(api) {
      const [W, H] = [[4, 4], [4, 5], [5, 6]][api.difficulty];
      const g = { width: W, height: H };
      const symbols = util.shuffle('ABCDEFGHJKLMNPRSTUVWXYZ'.split('')).slice(0, (W * H) / 2);
      const cards = util.shuffle([...symbols, ...symbols]).map(sym => ({ sym, shown: false, matched: false }));
      const cur = { x: 0, y: 0 };
      let open = [];
      let wait = 0;
      let moves = 0;
      let showCursor = false;

      const hideOpen = () => {
        open.forEach(i => { cards[i].shown = false; });
        open = [];
        wait = 0;
      };

      function flip(i) {
        if (wait > 0) hideOpen();
        const c = cards[i];
        if (!c || c.shown || c.matched) return;
        c.shown = true;
        open.push(i);
        if (open.length < 2) return;
        moves++;
        const [a, b] = open;
        if (cards[a].sym === cards[b].sym) {
          cards[a].matched = cards[b].matched = true;
          open = [];
          if (cards.every(k => k.matched)) {
            g.score = moves;
            api.gameOver(`All pairs found in ${moves} moves!`);
          }
        } else {
          wait = 0.9;
        }
      }

      g.update = dt => {
        if (wait > 0) {
          wait -= dt;
          if (wait <= 0) hideOpen();
        }
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= W || y >= H) return;
        showCursor = false;
        flip(Math.floor(y) * W + Math.floor(x));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, W, H) && a === 'action') flip(cur.y * W + cur.x);
      };
      g.draw = r => {
        cards.forEach((c, i) => {
          const x = i % W;
          const y = Math.floor(i / W);
          if (c.matched) {
            r.text(c.sym, x + 0.5, y + 0.52, 0.5, 'fellow', WHITE, 0.4);
          } else if (c.shown) {
            r.box(x + 0.08, y + 0.08, 0.84, 0.84, 0.04, 'both', WHITE, 0.4);
            r.text(c.sym, x + 0.5, y + 0.52, 0.6, 'amb', [255, 220, 0]);
          } else {
            r.tile(x + 0.04, y + 0.04, 0.92, 0.92, 'fellow', [80, 160, 255]);
          }
        });
        if (showCursor) r.box(cur.x + 0.02, cur.y + 0.02, 0.96, 0.96, 0.05, 'both', WHITE, 0.8);
      };
      g.hud = () => [`Moves ${moves}`];
      return g;
    },
  });

  DG.register({
    id: 'sliding',
    name: 'Sliding Puzzle',
    category: 'Puzzles',
    description: 'Slide the tiles back into number order.',
    help: 'Tap a tile in line with the gap to slide it, or use the arrows. Put the numbers back in order. Odd tiles are shown to your weaker eye and even tiles to your stronger eye.',
    width: 4,
    height: 4,
    buttons: ['left', 'up', 'down', 'right'],
    swipe: true,
    lowerIsBetter: true,
    create(api) {
      const N = [3, 4, 5][api.difficulty];
      const g = { width: N, height: N };
      const tiles = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N));
      let blank = N * N - 1;
      let moves = 0;

      function slide(i) {
        const bx = blank % N;
        const by = Math.floor(blank / N);
        const x = i % N;
        const y = Math.floor(i / N);
        if (i === blank || (x !== bx && y !== by)) return false;
        const step = x === bx ? (y > by ? N : -N) : (x > bx ? 1 : -1);
        while (blank !== i) {
          tiles[blank] = tiles[blank + step];
          blank += step;
        }
        tiles[blank] = 0;
        return true;
      }

      let prev = -1;
      for (let k = 0; k < 40 * N * N; k++) {
        const bx = blank % N;
        const by = Math.floor(blank / N);
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => [bx + dx, by + dy])
          .filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N)
          .map(([x, y]) => y * N + x)
          .filter(i => i !== prev);
        prev = blank;
        slide(util.pick(opts));
      }

      function play(i) {
        if (!slide(i)) return;
        moves++;
        if (tiles.every((v, k) => v === (k + 1) % (N * N))) {
          g.score = moves;
          api.gameOver(`Solved in ${moves} moves!`);
        }
      }

      g.pointer = (type, x, y) => {
        if (type === 'down' && x >= 0 && y >= 0 && x < N && y < N) play(Math.floor(y) * N + Math.floor(x));
      };
      g.action = a => {
        const d = DIRS[a];
        if (!d) return;
        const x = (blank % N) - d[0];
        const y = Math.floor(blank / N) - d[1];
        if (x >= 0 && y >= 0 && x < N && y < N) play(y * N + x);
      };
      g.draw = r => {
        tiles.forEach((v, i) => {
          if (!v) return;
          const x = i % N;
          const y = Math.floor(i / N);
          const target = v % 2 ? 'amb' : 'fellow';
          r.tile(x, y, 1, 1, target, [80, 160, 255], 0.45);
          r.text(v, x + 0.5, y + 0.53, 0.5, target, WHITE);
        });
      };
      g.hud = () => [`Moves ${moves}`];
      return g;
    },
  });

  DG.register({
    id: '2048',
    name: '2048',
    category: 'Puzzles',
    description: 'Merge matching tiles to reach 2048.',
    help: 'Swipe or use the arrows to slide every tile. Matching numbers merge. Your weaker eye sees the numbers; your stronger eye sees the tiles.',
    width: 4,
    height: 4,
    buttons: ['left', 'up', 'down', 'right'],
    swipe: true,
    create(api) {
      const g = { score: 0 };
      const grid = util.grid(4, 4, 0);

      function addTile() {
        const empty = [];
        grid.forEach((row, y) => row.forEach((v, x) => { if (!v) empty.push([x, y]); }));
        if (!empty.length) return;
        const [x, y] = util.pick(empty);
        grid[y][x] = Math.random() < 0.9 ? 2 : 4;
      }

      // Cells for each line, ordered in the direction tiles slide towards.
      function lines(a) {
        const out = [];
        for (let i = 0; i < 4; i++) {
          const line = [];
          for (let j = 0; j < 4; j++) {
            if (a === 'left') line.push([j, i]);
            if (a === 'right') line.push([3 - j, i]);
            if (a === 'up') line.push([i, j]);
            if (a === 'down') line.push([i, 3 - j]);
          }
          out.push(line);
        }
        return out;
      }

      function canMove() {
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            const v = grid[y][x];
            if (!v || (x < 3 && grid[y][x + 1] === v) || (y < 3 && grid[y + 1][x] === v)) return true;
          }
        }
        return false;
      }

      g.action = a => {
        if (!DIRS[a]) return;
        let moved = false;
        for (const line of lines(a)) {
          const vals = line.map(([x, y]) => grid[y][x]).filter(Boolean);
          for (let i = 0; i < vals.length - 1; i++) {
            if (vals[i] === vals[i + 1]) {
              vals[i] *= 2;
              g.score += vals[i];
              vals.splice(i + 1, 1);
            }
          }
          line.forEach(([x, y], i) => {
            const v = vals[i] || 0;
            if (grid[y][x] !== v) moved = true;
            grid[y][x] = v;
          });
        }
        if (!moved) return;
        addTile();
        if (!canMove()) api.gameOver(`No more moves \u2013 score ${g.score}`);
      };
      g.draw = r => {
        grid.forEach((row, y) => row.forEach((v, x) => {
          if (!v) {
            r.tile(x, y, 1, 1, 'both', WHITE, 0.08);
            return;
          }
          r.tile(x, y, 1, 1, 'fellow', [240, 170, 60], util.clamp(0.25 + Math.log2(v) * 0.06, 0.3, 0.9));
          const size = v < 100 ? 0.45 : v < 1000 ? 0.36 : 0.28;
          r.text(v, x + 0.5, y + 0.53, size, 'amb', WHITE);
        }));
      };
      g.hud = () => [`Score ${g.score}`, `Best tile ${Math.max(...grid.flat())}`];
      addTile();
      addTile();
      return g;
    },
  });

  DG.register({
    id: 'sudoku',
    name: 'Sudoku',
    category: 'Puzzles',
    description: 'Fill the grid so every row, column and box has 1\u20139.',
    help: 'Tap a square, then tap a number below the grid (tap the same number again to clear it). Your stronger eye sees the given numbers; your weaker eye sees the numbers you enter.',
    width: 9,
    height: 10.4,
    buttons: ['left', 'up', 'down', 'right', 'action', 'alt'],
    labels: { action: '+1', alt: 'Clear' },
    repeat: ['left', 'up', 'down', 'right'],
    lowerIsBetter: true,
    create(api) {
      const g = {};
      const board = Array(81).fill(0);
      let sel = 40;
      let t = 0;

      const peers = i => {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const br = r - (r % 3);
        const bc = c - (c % 3);
        const out = [];
        for (let k = 0; k < 9; k++) {
          out.push(r * 9 + k, k * 9 + c, (br + Math.floor(k / 3)) * 9 + bc + (k % 3));
        }
        return out.filter(j => j !== i);
      };
      const PEERS = Array.from({ length: 81 }, (_, i) => peers(i));
      const allowed = (b, i, d) => PEERS[i].every(j => b[j] !== d);

      function fill(b, i = 0) {
        if (i === 81) return true;
        if (b[i]) return fill(b, i + 1);
        for (const d of util.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (allowed(b, i, d)) {
            b[i] = d;
            if (fill(b, i + 1)) return true;
          }
        }
        b[i] = 0;
        return false;
      }
      fill(board);
      const givens = [40, 32, 27][api.difficulty];
      for (const i of util.shuffle([...Array(81).keys()]).slice(0, 81 - givens)) board[i] = 0;
      const given = board.map(Boolean);

      const conflict = i => board[i] && PEERS[i].some(j => board[j] === board[i]);

      function place(d) {
        if (given[sel]) return;
        board[sel] = board[sel] === d ? 0 : d;
        if (board.every((v, i) => v && !conflict(i))) {
          g.score = Math.round(t);
          api.gameOver(`Solved in ${util.formatTime(t * 1000)}!`);
        }
      }

      g.update = dt => { t += dt; };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || x >= 9) return;
        if (y >= 0 && y < 9) sel = Math.floor(y) * 9 + Math.floor(x);
        else if (y >= 9.4 && y <= 10.4) place(Math.floor(x) + 1);
      };
      g.key = k => {
        if (/^[1-9]$/.test(k)) place(Number(k));
        else if (k === 'Backspace' || k === 'Delete' || k === '0') {
          if (!given[sel]) board[sel] = 0;
        } else return false;
        return true;
      };
      g.action = a => {
        const cur = { x: sel % 9, y: Math.floor(sel / 9) };
        if (moveCursor(cur, a, 9, 9)) sel = cur.y * 9 + cur.x;
        else if (a === 'action' && !given[sel]) place(board[sel] === 9 ? 9 : board[sel] + 1);
        else if (a === 'alt' && !given[sel]) board[sel] = 0;
      };
      g.draw = r => {
        r.rect(sel % 9, Math.floor(sel / 9), 1, 1, 'both', WHITE, 0.15);
        const thin = [];
        const thick = [];
        for (let k = 1; k < 9; k++) (k % 3 ? thin : thick).push(k, 0, k, 9, 0, k, 9, k);
        r.lines(thin, 0.03, 'both', WHITE, 0.3);
        r.lines(thick, 0.08, 'both', WHITE, 0.7);
        board.forEach((v, i) => {
          if (!v) return;
          const x = (i % 9) + 0.5;
          const y = Math.floor(i / 9) + 0.54;
          r.text(v, x, y, 0.6, given[i] ? 'fellow' : 'amb', WHITE);
          if (!given[i] && conflict(i)) r.line(x - 0.3, y + 0.32, x + 0.3, y + 0.32, 0.06, 'both', WHITE, 0.8);
        });
        for (let d = 1; d <= 9; d++) {
          r.tile(d - 1, 9.4, 1, 1, 'both', WHITE, 0.12);
          r.text(d, d - 0.5, 9.94, 0.55, 'amb', WHITE);
        }
      };
      g.hud = () => [`Time ${util.formatTime(t * 1000)}`, `Filled ${board.filter(Boolean).length}/81`];
      return g;
    },
  });

  DG.register({
    id: 'mines',
    name: 'Mine Sweeper',
    category: 'Puzzles',
    description: 'Use the number clues to uncover every safe square.',
    help: 'Tap to dig. Switch to flag mode with \u25C6 to mark mines. Numbers show how many mines touch a square. Your weaker eye sees the numbers and flags; your stronger eye sees the covered squares.',
    width: 9,
    height: 12,
    buttons: ['left', 'up', 'down', 'right', 'action', 'alt'],
    labels: { action: 'Dig', alt: 'Flag' },
    repeat: ['left', 'up', 'down', 'right'],
    lowerIsBetter: true,
    create(api) {
      const [W, H, M] = [[8, 10, 10], [9, 12, 18], [10, 14, 28]][api.difficulty];
      const g = { width: W, height: H };
      const cells = util.grid(W, H, null).map(row => row.map(() => ({ mine: false, n: 0, open: false, flag: false })));
      const cur = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
      let placed = false;
      let flagMode = false;
      let showCursor = false;
      let lost = false;
      let opened = 0;
      let t = 0;

      const around = (x, y) => {
        const out = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < H) out.push([nx, ny]);
          }
        }
        return out;
      };

      function place(sx, sy) {
        const spots = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) if (Math.abs(x - sx) > 1 || Math.abs(y - sy) > 1) spots.push([x, y]);
        }
        util.shuffle(spots).slice(0, M).forEach(([x, y]) => { cells[y][x].mine = true; });
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) cells[y][x].n = around(x, y).filter(([nx, ny]) => cells[ny][nx].mine).length;
        }
        placed = true;
      }

      function dig(x, y) {
        if (!placed) place(x, y);
        const c = cells[y][x];
        if (c.open || c.flag) return;
        if (c.mine) {
          lost = true;
          api.gameOver('Boom! You hit a mine.');
          return;
        }
        const queue = [[x, y]];
        c.open = true;
        opened++;
        while (queue.length) {
          const [qx, qy] = queue.shift();
          if (cells[qy][qx].n) continue;
          for (const [nx, ny] of around(qx, qy)) {
            const n = cells[ny][nx];
            if (!n.open && !n.flag && !n.mine) {
              n.open = true;
              opened++;
              queue.push([nx, ny]);
            }
          }
        }
        if (opened === W * H - M) {
          g.score = Math.round(t);
          api.gameOver(`Cleared in ${util.formatTime(t * 1000)}!`);
        }
      }

      function use(x, y) {
        if (flagMode) {
          if (!cells[y][x].open) cells[y][x].flag = !cells[y][x].flag;
        } else {
          dig(x, y);
        }
      }

      g.update = dt => {
        if (placed) t += dt;
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= W || y >= H) return;
        showCursor = false;
        use(Math.floor(x), Math.floor(y));
      };
      g.action = a => {
        if (a === 'alt') flagMode = !flagMode;
        else if (moveCursor(cur, a, W, H)) showCursor = true;
        else if (a === 'action') use(cur.x, cur.y);
      };
      g.draw = r => {
        cells.forEach((row, y) => row.forEach((c, x) => {
          if (c.open) {
            r.rect(x + 0.03, y + 0.03, 0.94, 0.94, 'both', WHITE, 0.06);
            if (c.n) r.text(c.n, x + 0.5, y + 0.54, 0.6, 'amb', WHITE);
            return;
          }
          if (lost && c.mine) r.circle(x + 0.5, y + 0.5, 0.3, 'amb', [255, 80, 80]);
          else r.tile(x, y, 1, 1, 'fellow', [120, 160, 220], 0.7);
          if (c.flag) r.poly([x + 0.3, y + 0.2, x + 0.75, y + 0.38, x + 0.3, y + 0.56], 'amb', [255, 80, 80]);
        }));
        if (showCursor) r.box(cur.x + 0.04, cur.y + 0.04, 0.92, 0.92, 0.06, 'both', WHITE, 0.9);
      };
      g.hud = () => [flagMode ? 'Mode: FLAG' : 'Mode: dig', `Mines ${M - cells.flat().filter(c => c.flag).length}`];
      return g;
    },
  });

  DG.register({
    id: 'bubbleshooter',
    name: 'Bubble Shooter',
    category: 'Puzzles',
    description: 'Fire bubbles to make groups of three or more.',
    help: 'Aim by dragging and release to fire, or use \u25C0 \u25B6 and Fire. Three or more matching symbols pop, and anything left hanging drops. Your weaker eye sees the bubble you fire; your stronger eye sees the bubbles on the board.',
    width: 10,
    height: 16,
    buttons: ['left', 'action', 'right'],
    labels: { action: 'Fire' },
    repeat: ['left', 'right'],
    create(api) {
      const COLS = 10;
      const ROWS = 15;
      const ROWH = Math.sqrt(3) / 2;
      const SX = 5;
      const SY = 15;
      const TYPES = [4, 5, 6][api.difficulty];
      const SHOTS = [7, 6, 5][api.difficulty];
      const START_ROWS = [5, 6, 7][api.difficulty];
      const g = { score: 0 };
      let grid = util.grid(COLS, ROWS, -1);
      // Toggled whenever a row is pushed in from the top, so existing rows keep their offset.
      let shift = 0;
      let shot = null;
      let angle = -Math.PI / 2;
      let aiming = false;
      let misses = 0;

      const off = r => (r + shift) % 2 === 1;
      const ncols = r => (off(r) ? COLS - 1 : COLS);
      const cx = (r, c) => c + 0.5 + (off(r) ? 0.5 : 0);
      const cy = r => 0.5 + r * ROWH;

      function neighbours(r, c) {
        const list = [[r, c - 1], [r, c + 1]];
        for (const dr of [-1, 1]) {
          if (off(r)) list.push([r + dr, c], [r + dr, c + 1]);
          else list.push([r + dr, c - 1], [r + dr, c]);
        }
        return list.filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < ncols(nr));
      }

      function flood(starts, match) {
        const seen = new Set(starts.map(([r, c]) => `${r},${c}`));
        const out = [...starts];
        for (let i = 0; i < out.length; i++) {
          for (const [nr, nc] of neighbours(out[i][0], out[i][1])) {
            const k = `${nr},${nc}`;
            if (!seen.has(k) && match(nr, nc)) {
              seen.add(k);
              out.push([nr, nc]);
            }
          }
        }
        return out;
      }

      function fillRows(n) {
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < ncols(r); c++) grid[r][c] = util.randInt(TYPES);
        }
      }

      const present = () => [...new Set(grid.flat().filter(v => v >= 0))];
      const nextType = () => {
        const p = present();
        return p.length ? util.pick(p) : util.randInt(TYPES);
      };

      fillRows(START_ROWS);
      let current = nextType();
      let next = nextType();

      function addRow() {
        shift ^= 1;
        grid.pop();
        grid.unshift(Array(COLS).fill(-1));
        for (let c = 0; c < ncols(0); c++) grid[0][c] = util.randInt(TYPES);
      }

      function land() {
        let best = null;
        let bd = Infinity;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < ncols(r); c++) {
            if (grid[r][c] >= 0 || (r > 0 && !neighbours(r, c).some(([nr, nc]) => grid[nr][nc] >= 0))) continue;
            const d = Math.hypot(cx(r, c) - shot.x, cy(r) - shot.y);
            if (d < bd) {
              bd = d;
              best = [r, c];
            }
          }
        }
        const type = shot.t;
        shot = null;
        if (!best) return;
        const [r, c] = best;
        grid[r][c] = type;
        const group = flood([best], (nr, nc) => grid[nr][nc] === type);
        if (group.length >= 3) {
          group.forEach(([gr, gc]) => { grid[gr][gc] = -1; });
          g.score += group.length * 10;
          const roots = [];
          for (let k = 0; k < ncols(0); k++) if (grid[0][k] >= 0) roots.push([0, k]);
          const anchored = new Set(flood(roots, (nr, nc) => grid[nr][nc] >= 0).map(([ar, ac]) => `${ar},${ac}`));
          grid.forEach((row, gr) => row.forEach((v, gc) => {
            if (v >= 0 && !anchored.has(`${gr},${gc}`)) {
              grid[gr][gc] = -1;
              g.score += 20;
            }
          }));
        } else if (++misses >= SHOTS) {
          misses = 0;
          addRow();
        }
        if (grid[ROWS - 1].some(v => v >= 0)) {
          api.gameOver(`Game over \u2013 score ${g.score}`);
          return;
        }
        if (!present().length) fillRows(START_ROWS);
        const p = present();
        if (!p.includes(current)) current = nextType();
        if (!p.includes(next)) next = nextType();
      }

      function fire() {
        if (shot) return;
        shot = { x: SX, y: SY, vx: Math.cos(angle) * 18, vy: Math.sin(angle) * 18, t: current };
        current = next;
        next = nextType();
      }

      const aimAt = (x, y) => {
        angle = util.clamp(Math.atan2(y - SY, x - SX), -Math.PI + 0.15, -0.15);
      };

      g.action = a => {
        if (a === 'left') angle = Math.max(-Math.PI + 0.15, angle - 0.04);
        else if (a === 'right') angle = Math.min(-0.15, angle + 0.04);
        else if (a === 'action' || a === 'up') fire();
      };
      g.pointer = (type, x, y) => {
        if (type === 'up') {
          if (aiming) fire();
          aiming = false;
        } else if (y < SY - 0.3) {
          aimAt(x, y);
          aiming = true;
        }
      };
      g.update = dt => {
        if (!shot) return;
        const steps = Math.ceil(dt / 0.004);
        for (let i = 0; i < steps; i++) {
          shot.x += (shot.vx * dt) / steps;
          shot.y += (shot.vy * dt) / steps;
          if (shot.x < 0.5) { shot.x = 0.5; shot.vx = Math.abs(shot.vx); }
          if (shot.x > COLS - 0.5) { shot.x = COLS - 0.5; shot.vx = -Math.abs(shot.vx); }
          const hit = shot.y <= 0.5 || grid.some((row, r) => row.some((v, c) => v >= 0 && Math.hypot(cx(r, c) - shot.x, cy(r) - shot.y) < 0.85));
          if (hit) {
            land();
            return;
          }
        }
      };

      function bubble(rd, x, y, t, target, strength = 1) {
        rd.ring(x, y, 0.42, 0.07, target, SYMBOL_COLOURS[t], strength);
        symbol(rd, x, y, 0.2, t, target, strength);
      }

      g.draw = rd => {
        const limit = [];
        for (let x = 0.2; x < COLS; x += 0.8) limit.push(x, cy(ROWS - 1) - 0.5, x + 0.4, cy(ROWS - 1) - 0.5);
        rd.lines(limit, 0.04, 'both', WHITE, 0.25);
        grid.forEach((row, r) => row.forEach((v, c) => {
          if (v >= 0) bubble(rd, cx(r, c), cy(r), v, 'fellow');
        }));
        if (!shot) {
          const dots = [];
          for (let d = 1; d < 5; d += 0.5) dots.push(SX + Math.cos(angle) * d, SY + Math.sin(angle) * d, SX + Math.cos(angle) * (d + 0.15), SY + Math.sin(angle) * (d + 0.15));
          rd.lines(dots, 0.08, 'amb', WHITE, 0.5);
          bubble(rd, SX, SY, current, 'amb');
        } else {
          bubble(rd, shot.x, shot.y, shot.t, 'amb');
        }
        bubble(rd, 8.8, SY, next, 'amb', 0.5);
      };
      g.hud = () => [`Score ${g.score}`, `Next row in ${SHOTS - misses}`];
      return g;
    },
  });

  DG.register({
    id: 'linkpairs',
    name: 'Link Pairs',
    category: 'Puzzles',
    description: 'Join matching tiles with a path of up to three straight lines.',
    help: 'Tap two matching tiles to remove them. They must be joined by a path with no more than two turns that doesn\u2019t cross other tiles (it can go around the outside). Symbols alternate between your weaker and stronger eye.',
    width: 7,
    height: 9,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Pick' },
    repeat: ['left', 'up', 'down', 'right'],
    lowerIsBetter: true,
    create(api) {
      const [W, H, K] = [[6, 8, 12], [7, 10, 16], [8, 11, 20]][api.difficulty];
      const SYMBOLS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      // Tiles sit one cell in from the edge so paths can run around the outside; tile (x, y) is centred at (x + 1, y + 1).
      const g = { width: W + 1, height: H + 1 };
      const tiles = util.grid(W, H, null);
      const cur = { x: 0, y: 0 };
      const pool = [];
      for (let i = 0; i < (W * H) / 2; i++) pool.push(SYMBOLS[i % K], SYMBOLS[i % K]);
      util.shuffle(pool).forEach((s, i) => { tiles[Math.floor(i / W)][i % W] = s; });
      let sel = null;
      let path = null;
      let pathT = 0;
      let left = W * H;
      let t = 0;
      let showCursor = false;

      const occupied = (px, py) => px >= 1 && py >= 1 && px <= W && py <= H && tiles[py - 1][px - 1] !== null;
      const same = (a, b) => a[0] === b[0] && a[1] === b[1];

      function rays(p, target) {
        const out = [];
        for (const [dx, dy] of STEPS) {
          let x = p[0] + dx;
          let y = p[1] + dy;
          while (x >= 0 && y >= 0 && x <= W + 1 && y <= H + 1) {
            if (x === target[0] && y === target[1]) {
              out.push([x, y]);
              break;
            }
            if (occupied(x, y)) break;
            out.push([x, y]);
            x += dx;
            y += dy;
          }
        }
        return out;
      }

      function findPath(a, b) {
        const first = rays(a, b);
        if (first.some(c => same(c, b))) return [a, b];
        for (const c1 of first) {
          const second = rays(c1, b);
          if (second.some(c => same(c, b))) return [a, c1, b];
          for (const c2 of second) {
            if (!same(c2, b) && rays(c2, b).some(c => same(c, b))) return [a, c1, c2, b];
          }
        }
        return null;
      }

      function anyMove() {
        const pos = {};
        tiles.forEach((row, y) => row.forEach((s, x) => { if (s) (pos[s] ||= []).push([x + 1, y + 1]); }));
        for (const list of Object.values(pos)) {
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) if (findPath(list[i], list[j])) return true;
          }
        }
        return false;
      }

      function reshuffle() {
        for (let tries = 0; tries < 50 && left && !anyMove(); tries++) {
          const cells = [];
          const syms = [];
          tiles.forEach((row, y) => row.forEach((s, x) => {
            if (s) {
              cells.push([x, y]);
              syms.push(s);
            }
          }));
          util.shuffle(syms);
          cells.forEach(([x, y], i) => { tiles[y][x] = syms[i]; });
        }
      }
      reshuffle();

      function choose(x, y) {
        if (!tiles[y][x]) return;
        if (!sel || same(sel, [x, y])) {
          sel = sel ? null : [x, y];
          return;
        }
        const [sx, sy] = sel;
        const p = tiles[sy][sx] === tiles[y][x] && findPath([sx + 1, sy + 1], [x + 1, y + 1]);
        if (!p) {
          sel = [x, y];
          return;
        }
        tiles[sy][sx] = tiles[y][x] = null;
        left -= 2;
        sel = null;
        path = p;
        pathT = 0.4;
        if (!left) {
          g.score = Math.round(t);
          api.gameOver(`Cleared in ${util.formatTime(t * 1000)}!`);
          return;
        }
        reshuffle();
      }

      g.update = dt => {
        t += dt;
        if (pathT > 0) pathT -= dt;
      };
      g.pointer = (type, x, y) => {
        const gx = Math.floor(x - 0.5);
        const gy = Math.floor(y - 0.5);
        if (type !== 'down' || gx < 0 || gy < 0 || gx >= W || gy >= H) return;
        showCursor = false;
        choose(gx, gy);
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, W, H) && a === 'action') choose(cur.x, cur.y);
      };
      g.draw = rd => {
        tiles.forEach((row, y) => row.forEach((s, x) => {
          if (!s) return;
          rd.tile(x + 0.5, y + 0.5, 1, 1, 'both', WHITE, 0.1);
          rd.text(s, x + 1, y + 1.04, 0.6, (x + y) % 2 ? 'amb' : 'fellow', WHITE);
        }));
        if (sel) rd.box(sel[0] + 0.55, sel[1] + 0.55, 0.9, 0.9, 0.07, 'both', WHITE, 0.9);
        if (showCursor) rd.box(cur.x + 0.5, cur.y + 0.5, 1, 1, 0.04, 'both', WHITE, 0.6);
        if (path && pathT > 0) {
          const segs = [];
          for (let i = 0; i < path.length - 1; i++) segs.push(...path[i], ...path[i + 1]);
          rd.lines(segs, 0.08, 'both', WHITE, 0.8);
        }
      };
      g.hud = () => [`Pairs left ${left / 2}`, `Time ${util.formatTime(t * 1000)}`];
      return g;
    },
  });

  DG.register({
    id: 'spotdiff',
    name: 'Spot the Difference',
    category: 'Puzzles',
    description: 'Each eye sees a slightly different picture. Find the differences.',
    help: 'Your two eyes are shown almost the same picture. Shapes that only one eye can see, or that look different to each eye, seem to shimmer or flicker. Tap each one you spot.',
    width: 10,
    height: 14,
    buttons: [],
    create(api) {
      const W = 10;
      const H = 14;
      const count = [5, 7, 9][api.difficulty];
      const total = [16, 20, 24][api.difficulty];
      const g = { score: 0 };
      let shapes;
      let diffs;
      let misses = 0;
      let flash = null;
      let nextIn = 0;

      function build() {
        shapes = [];
        for (let tries = 0; shapes.length < total && tries < 3000; tries++) {
          const s = util.rand(0.35, 0.6);
          const x = util.rand(0.8, W - 0.8);
          const y = util.rand(0.8, H - 0.8);
          if (!shapes.some(o => Math.hypot(o.x - x, o.y - y) < o.s + s + 0.5)) shapes.push({ x, y, s, t: util.randInt(7) });
        }
        diffs = util.shuffle(shapes.slice()).slice(0, count);
        for (const d of diffs) {
          d.kind = util.pick(['amb', 'fellow', 'swap', 'size']);
          d.found = false;
          if (d.kind === 'swap') {
            do d.t2 = util.randInt(7);
            while (d.t2 === d.t);
          }
        }
      }
      build();

      g.update = dt => {
        if (flash) {
          flash.t -= dt;
          if (flash.t <= 0) flash = null;
        }
        if (nextIn > 0) {
          nextIn -= dt;
          if (nextIn <= 0) build();
        }
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || nextIn > 0) return;
        const d = diffs.find(o => !o.found && Math.hypot(o.x - x, o.y - y) < o.s + 0.5);
        if (d) {
          d.found = true;
          if (diffs.every(o => o.found)) {
            g.score++;
            nextIn = 1.5;
          }
        } else {
          misses++;
          flash = { x, y, t: 0.5 };
        }
      };
      g.draw = rd => {
        for (const o of shapes) {
          if (!o.kind || o.found) {
            symbol(rd, o.x, o.y, o.s, o.t, 'both', 0.7);
            if (o.found) rd.ring(o.x, o.y, o.s + 0.3, 0.06, 'both', WHITE, 0.9);
          } else if (o.kind === 'amb' || o.kind === 'fellow') {
            symbol(rd, o.x, o.y, o.s, o.t, o.kind);
          } else if (o.kind === 'swap') {
            symbol(rd, o.x, o.y, o.s, o.t, 'amb');
            symbol(rd, o.x, o.y, o.s, o.t2, 'fellow');
          } else {
            symbol(rd, o.x, o.y, o.s * 0.6, o.t, 'amb');
            symbol(rd, o.x, o.y, o.s * 1.2, o.t, 'fellow');
          }
        }
        if (flash) rd.lines([flash.x - 0.3, flash.y - 0.3, flash.x + 0.3, flash.y + 0.3, flash.x + 0.3, flash.y - 0.3, flash.x - 0.3, flash.y + 0.3], 0.08, 'both', WHITE, 0.6);
      };
      g.hud = () => [`Found ${diffs.filter(o => o.found).length}/${count}`, `Misses ${misses}`, `Pictures ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'shapesort',
    name: 'Shape Sort',
    category: 'Puzzles',
    description: 'Move shapes between tubes until each tube holds one kind.',
    help: 'Tap a tube to pick up its top shapes, then tap another tube to drop them. You can only drop onto the same shape or into an empty tube. Half the kinds of shape are shown to your weaker eye and half to your stronger eye.',
    width: 8,
    height: 11.2,
    buttons: ['left', 'action', 'right', 'alt'],
    labels: { action: 'Pick', alt: 'Undo' },
    lowerIsBetter: true,
    create(api) {
      const KINDS = [4, 5, 7][api.difficulty];
      const CAP = 4;
      const T = KINDS + 2;
      const perRow = T > 5 ? Math.ceil(T / 2) : T;
      const rows = Math.ceil(T / perRow);
      const CW = 1.3;
      const CH = 5.6;
      const g = { width: perRow * CW, height: rows * CH };
      const balls = util.shuffle(Array.from({ length: KINDS * CAP }, (_, i) => i % KINDS));
      const tubes = Array.from({ length: T }, (_, i) => (i < KINDS ? balls.slice(i * CAP, (i + 1) * CAP) : []));
      const history = [];
      let sel = null;
      let cursor = 0;
      let moves = 0;
      let showCursor = false;

      function pos(i) {
        const row = Math.floor(i / perRow);
        const inRow = row === rows - 1 ? T - perRow * (rows - 1) : perRow;
        return { x: (i % perRow) * CW + (CW - 1) / 2 + ((perRow - inRow) * CW) / 2, y: row * CH + 1.2 };
      }

      function topRun(tube) {
        let n = 0;
        for (let k = tube.length - 1; k >= 0 && tube[k] === tube[tube.length - 1]; k--) n++;
        return n;
      }

      function pour(a, b) {
        const A = tubes[a];
        const B = tubes[b];
        if (!A.length || B.length >= CAP || (B.length && B[B.length - 1] !== A[A.length - 1])) return false;
        history.push(tubes.map(tube => tube.slice()));
        const n = Math.min(topRun(A), CAP - B.length);
        for (let k = 0; k < n; k++) B.push(A.pop());
        moves++;
        return true;
      }

      const solved = () => tubes.every(tube => !tube.length || (tube.length === CAP && tube.every(v => v === tube[0])));

      function tap(i) {
        if (sel === null || sel === i) {
          sel = sel === null && tubes[i].length ? i : null;
          return;
        }
        if (pour(sel, i)) {
          sel = null;
          if (solved()) {
            g.score = moves;
            api.gameOver(`Sorted in ${moves} moves!`);
          }
        } else {
          sel = tubes[i].length ? i : null;
        }
      }

      function undo() {
        if (!history.length) return;
        history.pop().forEach((tube, i) => { tubes[i] = tube; });
        moves++;
        sel = null;
      }

      g.pointer = (type, x, y) => {
        if (type !== 'down') return;
        for (let i = 0; i < T; i++) {
          const p = pos(i);
          if (x >= p.x - 0.15 && x <= p.x + 1.15 && y >= p.y - 1.2 && y <= p.y + 4.4) {
            showCursor = false;
            tap(i);
            return;
          }
        }
      };
      g.action = a => {
        showCursor = true;
        if (a === 'left') cursor = (cursor + T - 1) % T;
        else if (a === 'right') cursor = (cursor + 1) % T;
        else if (a === 'action') tap(cursor);
        else if (a === 'alt') undo();
      };
      g.draw = rd => {
        tubes.forEach((tube, i) => {
          const { x, y } = pos(i);
          rd.lines([x, y, x, y + 4.2, x, y + 4.2, x + 1, y + 4.2, x + 1, y + 4.2, x + 1, y], 0.05, 'both', WHITE, 0.4);
          const lift = sel === i ? topRun(tube) : 0;
          tube.forEach((t, j) => {
            const cy = y + 3.7 - j * 1.0 - (j >= tube.length - lift ? 1.0 : 0);
            symbol(rd, x + 0.5, cy, 0.32, t, t % 2 ? 'fellow' : 'amb');
          });
          if (showCursor && cursor === i) rd.box(x - 0.1, y - 1.1, 1.2, 5.45, 0.05, 'both', WHITE, 0.7);
        });
      };
      g.hud = () => [`Moves ${moves}`];
      return g;
    },
  });

  DG.register({
    id: 'simon',
    name: 'Simon',
    category: 'Puzzles',
    description: 'Watch the panels light up, then repeat the sequence.',
    help: 'Watch the sequence, then tap the panels in the same order. It gets one step longer each round. Panels alternate between your weaker and stronger eye.',
    width: 2,
    height: 2,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Press' },
    create(api) {
      const [C, R] = api.difficulty === 2 ? [3, 2] : [2, 2];
      const N = C * R;
      const step = [0.75, 0.6, 0.45][api.difficulty];
      const COLS = [[240, 80, 80], [80, 200, 90], [80, 140, 255], [240, 220, 60], [200, 90, 240], [90, 220, 220]];
      const g = { score: 0, width: C, height: R };
      const seq = [];
      const cur = { x: 0, y: 0 };
      let phase = 'wait';
      let idx = 0;
      let timer = 0.8;
      let lit = -1;
      let litT = 0;
      let showCursor = false;

      const eye = i => ((i % C) + Math.floor(i / C)) % 2 ? 'fellow' : 'amb';
      const light = (i, t) => {
        lit = i;
        litT = t;
      };

      function press(i) {
        if (phase !== 'input') return;
        light(i, 0.25);
        if (seq[idx] !== i) {
          phase = 'over';
          api.gameOver(`You remembered ${seq.length - 1} step${seq.length === 2 ? '' : 's'}`);
          return;
        }
        idx++;
        if (idx === seq.length) {
          g.score = seq.length;
          phase = 'wait';
          timer = 0.9;
        }
      }

      g.update = dt => {
        if (litT > 0) {
          litT -= dt;
          if (litT <= 0) lit = -1;
        }
        if (phase !== 'wait' && phase !== 'show') return;
        timer -= dt;
        if (timer > 0) return;
        if (phase === 'wait') {
          seq.push(util.randInt(N));
          phase = 'show';
          idx = 0;
          timer = 0.3;
        } else if (idx < seq.length) {
          light(seq[idx++], step * 0.7);
          timer = step;
        } else {
          phase = 'input';
          idx = 0;
        }
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= C || y >= R) return;
        showCursor = false;
        press(Math.floor(y) * C + Math.floor(x));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, C, R) && a === 'action') press(cur.y * C + cur.x);
      };
      g.draw = rd => {
        for (let i = 0; i < N; i++) {
          const x = i % C;
          const y = Math.floor(i / C);
          rd.box(x + 0.06, y + 0.06, 0.88, 0.88, 0.03, 'both', WHITE, 0.3);
          rd.tile(x + 0.08, y + 0.08, 0.84, 0.84, eye(i), COLS[i], lit === i ? 1 : 0.18);
        }
        if (showCursor) rd.box(cur.x + 0.02, cur.y + 0.02, 0.96, 0.96, 0.04, 'both', WHITE, 0.8);
      };
      g.hud = () => [phase === 'show' ? 'Watch\u2026' : phase === 'input' ? 'Your turn' : 'Get ready', `Length ${seq.length}`];
      return g;
    },
  });

  DG.register({
    id: 'mahjong',
    name: 'Mahjong Solitaire',
    category: 'Puzzles',
    description: 'Clear the stacked tiles by removing matching free pairs.',
    help: 'Tap two matching tiles to remove them. A tile is free when nothing is on top of it and its left or right side is open. Free tiles are brighter, and the dots show how tall a stack is. Symbols alternate between your weaker and stronger eye.',
    width: 7,
    height: 6,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Pick' },
    repeat: ['left', 'up', 'down', 'right'],
    lowerIsBetter: true,
    create(api) {
      // Each layer is [width, height], centred on the one below.
      const LAYOUTS = [
        [[6, 4], [4, 2], [2, 2]],
        [[7, 6], [5, 4], [3, 2], [1, 2]],
        [[8, 6], [6, 4], [4, 2], [2, 2]],
      ];
      const SYMBOLS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const KINDS = [12, 18, 21][api.difficulty];
      const layers = LAYOUTS[api.difficulty];
      const [W, H] = layers[0];
      const g = { width: W, height: H };
      const cur = { x: 0, y: 0 };
      // stacks[y][x] lists symbols from the bottom tile to the top one.
      let stacks;
      let sel = null;
      let left = 0;
      let t = 0;
      let showCursor = false;

      const isFree = (h, x, y) => h[y][x] > 0 && (x === 0 || h[y][x - 1] < h[y][x] || x === W - 1 || h[y][x + 1] < h[y][x]);

      // Deal by removing free pairs from a full layout, so the deal is always solvable.
      function deal() {
        for (let attempt = 0; attempt < 200; attempt++) {
          const h = util.grid(W, H, 0);
          for (const [lw, lh] of layers) {
            const ox = (W - lw) / 2;
            const oy = (H - lh) / 2;
            for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) h[oy + y][ox + x]++;
          }
          const total = h.flat().reduce((a, b) => a + b, 0);
          const assign = h.map(row => row.map(n => Array(n).fill(null)));
          let ok = true;
          for (let k = 0; k < total / 2 && ok; k++) {
            const free = [];
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isFree(h, x, y)) free.push([x, y]);
            if (free.length < 2) {
              ok = false;
              break;
            }
            for (const [x, y] of util.shuffle(free).slice(0, 2)) {
              h[y][x]--;
              assign[y][x][h[y][x]] = SYMBOLS[k % KINDS];
            }
          }
          if (ok) {
            stacks = assign;
            left = total;
            return;
          }
        }
      }
      deal();

      const heights = () => stacks.map(row => row.map(s => s.length));
      const free = (x, y) => isFree(heights(), x, y);
      const top = (x, y) => stacks[y][x][stacks[y][x].length - 1];

      function anyMove() {
        const h = heights();
        const seen = new Set();
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (!isFree(h, x, y)) continue;
            if (seen.has(top(x, y))) return true;
            seen.add(top(x, y));
          }
        }
        return false;
      }

      function reshuffle() {
        for (let tries = 0; tries < 30 && left && !anyMove(); tries++) {
          const syms = util.shuffle(stacks.flat().flat());
          let i = 0;
          stacks = stacks.map(row => row.map(s => s.map(() => syms[i++])));
        }
      }

      function choose(x, y) {
        if (!free(x, y)) return;
        if (!sel || (sel[0] === x && sel[1] === y)) {
          sel = sel ? null : [x, y];
          return;
        }
        if (top(sel[0], sel[1]) !== top(x, y)) {
          sel = [x, y];
          return;
        }
        stacks[sel[1]][sel[0]].pop();
        stacks[y][x].pop();
        left -= 2;
        sel = null;
        if (!left) {
          g.score = Math.round(t);
          api.gameOver(`Cleared in ${util.formatTime(t * 1000)}!`);
          return;
        }
        reshuffle();
      }

      g.update = dt => { t += dt; };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= W || y >= H) return;
        showCursor = false;
        choose(Math.floor(x), Math.floor(y));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, W, H) && a === 'action') choose(cur.x, cur.y);
      };
      g.draw = rd => {
        const h = heights();
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (!h[y][x]) continue;
            const f = isFree(h, x, y);
            rd.rect(x + 0.05, y + 0.05, 0.9, 0.9, 'both', WHITE, 0.04 + 0.03 * h[y][x]);
            rd.box(x + 0.05, y + 0.05, 0.9, 0.9, 0.04, 'both', WHITE, f ? 0.7 : 0.2);
            for (let k = 0; k < h[y][x]; k++) rd.circle(x + 0.17 + k * 0.13, y + 0.17, 0.045, 'both', WHITE, 0.6);
            rd.text(top(x, y), x + 0.5, y + 0.58, 0.5, (x + y) % 2 ? 'amb' : 'fellow', WHITE, f ? 1 : 0.45);
          }
        }
        if (sel) rd.box(sel[0] + 0.02, sel[1] + 0.02, 0.96, 0.96, 0.07, 'both', WHITE, 0.95);
        if (showCursor) rd.box(cur.x + 0.1, cur.y + 0.1, 0.8, 0.8, 0.04, 'both', WHITE, 0.6);
      };
      g.hud = () => [`Tiles left ${left}`, `Time ${util.formatTime(t * 1000)}`];
      return g;
    },
  });

  DG.register({
    id: 'shapecrush',
    name: 'Shape Crush',
    category: 'Puzzles',
    description: 'Swap neighbouring shapes to make lines of three or more.',
    help: 'Swipe a shape, or tap two neighbours, to swap them. Lines of three or more matching shapes clear and the shapes above fall. You have 30 moves. Shapes on alternate squares are shown to your weaker and stronger eye.',
    width: 7,
    height: 8,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Pick' },
    create(api) {
      const W = 7;
      const H = 8;
      const TYPES = [5, 6, 7][api.difficulty];
      const g = { score: 0 };
      const cur = { x: 3, y: 4 };
      let grid;
      let marked = null;
      let flashing = false;
      let timer = 0;
      let chain = 0;
      let movesLeft = 30;
      let sel = null;
      let down = null;
      let showCursor = false;

      const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

      function fresh() {
        grid = util.grid(W, H, 0);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            do grid[y][x] = util.randInt(TYPES);
            while ((x >= 2 && grid[y][x - 1] === grid[y][x] && grid[y][x - 2] === grid[y][x])
              || (y >= 2 && grid[y - 1][x] === grid[y][x] && grid[y - 2][x] === grid[y][x]));
          }
        }
      }

      function findMatches() {
        const mk = util.grid(W, H, false);
        let any = false;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const v = grid[y][x];
            if (x < W - 2 && grid[y][x + 1] === v && grid[y][x + 2] === v) {
              mk[y][x] = mk[y][x + 1] = mk[y][x + 2] = true;
              any = true;
            }
            if (y < H - 2 && grid[y + 1][x] === v && grid[y + 2][x] === v) {
              mk[y][x] = mk[y + 1][x] = mk[y + 2][x] = true;
              any = true;
            }
          }
        }
        return any ? mk : null;
      }

      const swap = (a, b) => {
        [grid[a[1]][a[0]], grid[b[1]][b[0]]] = [grid[b[1]][b[0]], grid[a[1]][a[0]]];
      };

      function hasMove() {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            for (const [dx, dy] of [[1, 0], [0, 1]]) {
              if (!inside(x + dx, y + dy)) continue;
              swap([x, y], [x + dx, y + dy]);
              const ok = !!findMatches();
              swap([x, y], [x + dx, y + dy]);
              if (ok) return true;
            }
          }
        }
        return false;
      }

      do fresh();
      while (!hasMove());

      function trySwap(a, b) {
        if (flashing || movesLeft <= 0 || !inside(b[0], b[1]) || Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return;
        swap(a, b);
        marked = findMatches();
        if (!marked) {
          swap(a, b);
          return;
        }
        movesLeft--;
        chain = 0;
        flashing = true;
        timer = 0.25;
        sel = null;
      }

      function collapse() {
        for (let x = 0; x < W; x++) {
          let write = H - 1;
          for (let y = H - 1; y >= 0; y--) if (!marked[y][x]) grid[write--][x] = grid[y][x];
          for (; write >= 0; write--) grid[write][x] = util.randInt(TYPES);
        }
      }

      g.update = dt => {
        if (!flashing) return;
        timer -= dt;
        if (timer > 0) return;
        chain++;
        g.score += marked.flat().filter(Boolean).length * 10 * chain;
        collapse();
        marked = findMatches();
        if (marked) {
          timer = 0.25;
          return;
        }
        flashing = false;
        if (movesLeft <= 0) {
          api.gameOver(`Out of moves \u2013 score ${g.score}`);
          return;
        }
        while (!hasMove()) fresh();
      };
      g.pointer = (type, x, y) => {
        if (type === 'down') {
          down = inside(Math.floor(x), Math.floor(y)) ? [Math.floor(x), Math.floor(y)] : null;
          showCursor = false;
          return;
        }
        if (type !== 'up' || !down) return;
        const dx = x - (down[0] + 0.5);
        const dy = y - (down[1] + 0.5);
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 0.6) {
          trySwap(down, Math.abs(dx) > Math.abs(dy) ? [down[0] + Math.sign(dx), down[1]] : [down[0], down[1] + Math.sign(dy)]);
        } else if (sel && Math.abs(sel[0] - down[0]) + Math.abs(sel[1] - down[1]) === 1) {
          trySwap(sel, down);
        } else {
          sel = sel && sel[0] === down[0] && sel[1] === down[1] ? null : down;
        }
        down = null;
      };
      g.action = a => {
        showCursor = true;
        const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[a];
        if (d && sel) {
          trySwap(sel, [sel[0] + d[0], sel[1] + d[1]]);
          sel = null;
        } else if (d) {
          moveCursor(cur, a, W, H);
        } else if (a === 'action') {
          sel = sel ? null : [cur.x, cur.y];
        }
      };
      g.draw = rd => {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const blink = flashing && marked[y][x] && Math.floor(timer * 20) % 2;
            symbol(rd, x + 0.5, y + 0.5, 0.3, grid[y][x], (x + y) % 2 ? 'amb' : 'fellow', blink ? 0.3 : 1);
          }
        }
        if (sel) rd.box(sel[0] + 0.04, sel[1] + 0.04, 0.92, 0.92, 0.06, 'both', WHITE, 0.9);
        if (showCursor) rd.box(cur.x + 0.08, cur.y + 0.08, 0.84, 0.84, 0.04, 'both', WHITE, 0.6);
      };
      g.hud = () => [`Score ${g.score}`, `Moves ${movesLeft}`];
      return g;
    },
  });

  DG.register({
    id: 'nonogram',
    name: 'Picture Logic',
    category: 'Puzzles',
    description: 'Use the number clues to fill in a hidden picture.',
    help: 'Each number is a run of filled squares in that row or column, in order, with at least one gap between runs. Tap or drag to fill squares; switch to \u2715 mode to mark squares you know are empty. Your weaker eye sees the clues; your stronger eye sees the grid.',
    width: 8,
    height: 8,
    buttons: ['left', 'up', 'down', 'right', 'action', 'alt'],
    labels: { action: 'Fill', alt: '\u2715' },
    repeat: ['left', 'up', 'down', 'right'],
    lowerIsBetter: true,
    create(api) {
      const N = [5, 8, 10][api.difficulty];
      const STEP = 0.62;
      const runs = line => {
        const out = [];
        let n = 0;
        for (const v of line) {
          if (v) n++;
          else if (n) {
            out.push(n);
            n = 0;
          }
        }
        if (n) out.push(n);
        return out.length ? out : [0];
      };
      const column = (grid, x) => grid.map(row => row[x]);
      const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

      let target;
      do target = util.grid(N, N, false).map(row => row.map(() => Math.random() < 0.58));
      while (target.some(row => !row.some(Boolean)));
      const rowClues = target.map(runs);
      const colClues = target[0].map((_, x) => runs(column(target, x)));
      const CL = Math.max(...rowClues.map(c => c.length)) * STEP + 0.3;
      const CT = Math.max(...colClues.map(c => c.length)) * STEP + 0.3;

      const g = { width: CL + N, height: CT + N };
      // 0 = empty, 1 = filled, 2 = marked as empty.
      const cells = util.grid(N, N, 0);
      const cur = { x: 0, y: 0 };
      let markMode = false;
      let paint = null;
      let showCursor = false;
      let t = 0;

      const filled = line => line.map(v => v === 1);
      const rowDone = y => same(runs(filled(cells[y])), rowClues[y]);
      const colDone = x => same(runs(filled(column(cells, x))), colClues[x]);

      function set(x, y, v) {
        cells[y][x] = v;
        if (rowClues.every((_, i) => rowDone(i) && colDone(i))) {
          g.score = Math.round(t);
          api.gameOver(`Solved in ${util.formatTime(t * 1000)}!`);
        }
      }

      const cellAt = (x, y) => {
        const cx = Math.floor(x - CL);
        const cy = Math.floor(y - CT);
        return cx >= 0 && cy >= 0 && cx < N && cy < N ? [cx, cy] : null;
      };

      g.update = dt => { t += dt; };
      g.pointer = (type, x, y) => {
        const c = cellAt(x, y);
        if (type === 'down') {
          if (!c) return;
          showCursor = false;
          const want = markMode ? 2 : 1;
          paint = cells[c[1]][c[0]] === want ? 0 : want;
          set(c[0], c[1], paint);
        } else if (type === 'move') {
          if (paint !== null && c && cells[c[1]][c[0]] !== paint) set(c[0], c[1], paint);
        } else {
          paint = null;
        }
      };
      g.action = a => {
        showCursor = true;
        if (moveCursor(cur, a, N, N)) return;
        if (a === 'alt') markMode = !markMode;
        else if (a === 'action') {
          const want = markMode ? 2 : 1;
          set(cur.x, cur.y, cells[cur.y][cur.x] === want ? 0 : want);
        }
      };
      g.draw = rd => {
        rowClues.forEach((c, y) => {
          const s = rowDone(y) ? 0.35 : 1;
          c.forEach((n, i) => rd.text(n, CL - 0.3 - (c.length - 1 - i) * STEP, CT + y + 0.54, 0.42, 'amb', WHITE, s));
        });
        colClues.forEach((c, x) => {
          const s = colDone(x) ? 0.35 : 1;
          c.forEach((n, i) => rd.text(n, CL + x + 0.5, CT - 0.3 - (c.length - 1 - i) * STEP, 0.42, 'amb', WHITE, s));
        });
        const thin = [];
        const thick = [];
        for (let k = 0; k <= N; k++) (k % 5 === 0 || k === N ? thick : thin).push(CL + k, CT, CL + k, CT + N, CL, CT + k, CL + N, CT + k);
        rd.lines(thin, 0.03, 'both', WHITE, 0.3);
        rd.lines(thick, 0.06, 'both', WHITE, 0.6);
        cells.forEach((row, y) => row.forEach((v, x) => {
          const px = CL + x;
          const py = CT + y;
          if (v === 1) rd.tile(px, py, 1, 1, 'fellow', [80, 160, 255]);
          else if (v === 2) rd.lines([px + 0.3, py + 0.3, px + 0.7, py + 0.7, px + 0.7, py + 0.3, px + 0.3, py + 0.7], 0.05, 'fellow', WHITE, 0.6);
        }));
        if (showCursor) rd.box(CL + cur.x + 0.06, CT + cur.y + 0.06, 0.88, 0.88, 0.05, 'both', WHITE, 0.8);
      };
      g.hud = () => [markMode ? 'Mode: \u2715' : 'Mode: fill', `Time ${util.formatTime(t * 1000)}`];
      return g;
    },
  });

  DG.register({
    id: 'lightsout',
    name: 'Lights Out',
    category: 'Puzzles',
    description: 'Press squares to switch every light off.',
    help: 'Pressing a square flips it and the squares above, below, left and right of it. Switch every light off in as few presses as you can. Your weaker eye sees the lights that are on; your stronger eye sees the ones that are off.',
    width: 5,
    height: 5,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Press' },
    repeat: ['left', 'up', 'down', 'right'],
    lowerIsBetter: true,
    create(api) {
      const N = [4, 5, 6][api.difficulty];
      const PAR = [4, 7, 10][api.difficulty];
      const g = { width: N, height: N };
      const lit = util.grid(N, N, false);
      const cur = { x: Math.floor(N / 2), y: Math.floor(N / 2) };
      let showCursor = false;
      let moves = 0;

      function flip(x, y) {
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < N && ny < N) lit[ny][nx] = !lit[ny][nx];
        }
      }
      const allOff = () => lit.every(row => row.every(v => !v));
      // Scrambling from all-off guarantees the puzzle can be solved.
      do {
        util.shuffle([...Array(N * N).keys()]).slice(0, PAR).forEach(i => flip(i % N, Math.floor(i / N)));
      } while (allOff());

      function press(x, y) {
        flip(x, y);
        moves++;
        if (allOff()) {
          g.score = moves;
          api.gameOver(`All lights off in ${moves} moves!`);
        }
      }

      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= N || y >= N) return;
        showCursor = false;
        press(Math.floor(x), Math.floor(y));
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, N, N) && a === 'action') press(cur.x, cur.y);
      };
      g.draw = rd => {
        lit.forEach((row, y) => row.forEach((on, x) => {
          if (on) rd.tile(x + 0.04, y + 0.04, 0.92, 0.92, 'amb', [255, 220, 80]);
          else rd.tile(x + 0.04, y + 0.04, 0.92, 0.92, 'fellow', [80, 120, 220], 0.6);
        }));
        if (showCursor) rd.box(cur.x + 0.02, cur.y + 0.02, 0.96, 0.96, 0.06, 'both', WHITE, 0.9);
      };
      g.hud = () => [`Moves ${moves}`, `Par ${PAR}`];
      return g;
    },
  });

  DG.register({
    id: 'codebreaker',
    name: 'Code Breaker',
    category: 'Puzzles',
    description: 'Work out the hidden code of shapes from the clues.',
    help: 'Tap shapes to build a guess, then tap OK. A solid dot means a shape is right and in the right place; a ring means the shape is in the code but somewhere else. Your weaker eye sees the shapes; your stronger eye sees the clues.',
    width: 10,
    height: 11.4,
    buttons: ['left', 'action', 'right'],
    labels: { action: 'Pick' },
    repeat: ['left', 'right'],
    create(api) {
      const LEN = [3, 4, 5][api.difficulty];
      const K = [5, 6, 7][api.difficulty];
      const repeats = api.difficulty === 2;
      const TRIES = 10;
      const ROW = 0.95;
      const PY = TRIES * ROW + 0.5;
      const items = [...Array(K).keys(), 'DEL', 'OK'];
      const IW = 10 / items.length;
      const g = { score: 0 };
      let code;
      let guesses;
      let typed;
      let message;
      let nextIn;
      let cursor = items.length - 1;
      let showCursor = false;

      function newRound() {
        code = repeats ? Array.from({ length: LEN }, () => util.randInt(K)) : util.shuffle([...Array(K).keys()]).slice(0, LEN);
        guesses = [];
        typed = [];
        message = '';
        nextIn = 0;
      }
      newRound();

      function mark(guess) {
        let exact = 0;
        const inCode = {};
        const inGuess = {};
        guess.forEach((s, i) => {
          if (s === code[i]) exact++;
          else {
            inCode[code[i]] = (inCode[code[i]] || 0) + 1;
            inGuess[s] = (inGuess[s] || 0) + 1;
          }
        });
        const near = Object.keys(inGuess).reduce((n, s) => n + Math.min(inGuess[s], inCode[s] || 0), 0);
        return { exact, near };
      }

      function press(item) {
        if (nextIn > 0) return;
        message = '';
        if (item === 'DEL') typed.pop();
        else if (item !== 'OK') {
          if (typed.length < LEN) typed.push(item);
        } else if (typed.length < LEN) {
          message = 'Not enough shapes';
        } else {
          const res = mark(typed);
          guesses.push({ shapes: typed, ...res });
          typed = [];
          if (res.exact === LEN) {
            g.score++;
            message = 'Cracked it!';
            nextIn = 2.5;
          } else if (guesses.length === TRIES) {
            message = 'Out of guesses';
            nextIn = 4;
          }
        }
      }

      g.update = dt => {
        if (nextIn > 0) {
          nextIn -= dt;
          if (nextIn <= 0) newRound();
        }
      };
      g.key = k => {
        const n = Number(k);
        if (n >= 1 && n <= K) press(n - 1);
        else if (k === 'Backspace' || k === 'Delete') press('DEL');
        else if (k === 'Enter') press('OK');
        else return false;
        return true;
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || y < PY || y > PY + 1.2 || x < 0 || x >= 10) return;
        showCursor = false;
        press(items[Math.floor(x / IW)]);
      };
      g.action = a => {
        showCursor = true;
        if (a === 'left') cursor = (cursor + items.length - 1) % items.length;
        else if (a === 'right') cursor = (cursor + 1) % items.length;
        else if (a === 'action') press(items[cursor]);
      };
      g.draw = rd => {
        for (let r = 0; r < TRIES; r++) {
          const y = r * ROW;
          const guess = guesses[r];
          const active = r === guesses.length && nextIn <= 0;
          if (active) rd.rect(0, y, 10, ROW, 'both', WHITE, 0.08);
          for (let c = 0; c < LEN; c++) {
            const cx = 0.9 + c * 1.05;
            const cy = y + ROW / 2;
            const s = guess ? guess.shapes[c] : active ? typed[c] : undefined;
            if (s !== undefined) symbol(rd, cx, cy, 0.28, s, 'amb');
            else rd.circle(cx, cy, 0.08, 'both', WHITE, 0.3);
          }
          if (!guess) continue;
          for (let i = 0; i < LEN; i++) {
            const px = 6.6 + i * 0.6;
            const cy = y + ROW / 2;
            if (i < guess.exact) rd.circle(px, cy, 0.17, 'fellow', WHITE);
            else if (i < guess.exact + guess.near) rd.ring(px, cy, 0.14, 0.06, 'fellow', WHITE);
            else rd.circle(px, cy, 0.05, 'both', WHITE, 0.3);
          }
        }
        rd.line(6.1, 0, 6.1, TRIES * ROW, 0.03, 'both', WHITE, 0.3);
        const lost = nextIn > 0 && guesses.length === TRIES && guesses[TRIES - 1].exact < LEN;
        if (lost) {
          rd.text('Code:', 1.4, PY + 0.6, 0.5, 'both', WHITE, 0.8);
          code.forEach((s, i) => symbol(rd, 3.2 + i * 1.1, PY + 0.6, 0.3, s, 'both'));
          return;
        }
        items.forEach((item, i) => {
          const x = i * IW;
          rd.rect(x + 0.06, PY, IW - 0.12, 1.2, 'both', WHITE, 0.1);
          if (typeof item === 'number') symbol(rd, x + IW / 2, PY + 0.6, 0.27, item, 'amb');
          else rd.text(item, x + IW / 2, PY + 0.62, 0.32, 'amb', WHITE);
        });
        if (showCursor) rd.box(cursor * IW + 0.03, PY - 0.03, IW - 0.06, 1.26, 0.05, 'both', WHITE, 0.9);
      };
      g.hud = () => [message || `Guess ${Math.min(guesses.length + 1, TRIES)}/${TRIES}`, `Solved ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'flowgrid',
    name: 'Flowgrid',
    category: 'Puzzles',
    description: 'Join each pair of matching shapes with a path, filling every square.',
    help: 'Drag from a shape to draw a path to its matching shape. Paths can\u2019t cross, and every square must be filled. Drag back along a path to shorten it. Your weaker eye sees the shapes; your stronger eye sees the paths.',
    width: 6,
    height: 6,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Draw' },
    lowerIsBetter: true,
    create(api) {
      const N = [5, 6, 7][api.difficulty];
      const P = [4, 5, 6][api.difficulty];
      const g = { width: N, height: N };
      const same = (a, b) => a[0] === b[0] && a[1] === b[1];
      const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
      const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

      // A random path through every square, cut into pieces, gives a puzzle that is known to be solvable.
      function generate() {
        let path = [];
        for (let y = 0; y < N; y++) for (let k = 0; k < N; k++) path.push([y % 2 ? N - 1 - k : k, y]);
        for (let i = 0; i < N * N * 30; i++) {
          if (Math.random() < 0.5) path.reverse();
          const [ex, ey] = path[path.length - 1];
          const options = Object.values(DIRS).map(([dx, dy]) => [ex + dx, ey + dy]).filter(([x, y]) => inside(x, y));
          const n = util.pick(options);
          const idx = path.findIndex(c => same(c, n));
          path = path.slice(0, idx + 1).concat(path.slice(idx + 1).reverse());
        }
        const lens = Array(P).fill(3);
        for (let i = 0; i < N * N - 3 * P; i++) lens[util.randInt(P)]++;
        const segs = [];
        let k = 0;
        for (const len of lens) {
          segs.push(path.slice(k, k + len));
          k += len;
        }
        return segs;
      }
      let segs;
      for (let tries = 0; tries < 30; tries++) {
        segs = generate();
        if (!segs.some(s => adj(s[0], s[s.length - 1]))) break;
      }
      const ends = segs.map(s => [s[0], s[s.length - 1]]);
      const kinds = util.shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, P);
      const endAt = util.grid(N, N, -1);
      ends.forEach((pair, c) => pair.forEach(([x, y]) => { endAt[y][x] = c; }));
      const paths = ends.map(() => []);
      const cur = { x: 0, y: 0 };
      let active = null;
      let showCursor = false;
      let t = 0;

      const joined = c => {
        const p = paths[c];
        if (p.length < 2) return false;
        const other = same(p[0], ends[c][0]) ? ends[c][1] : ends[c][0];
        return same(p[p.length - 1], other);
      };
      const filled = () => paths.reduce((n, p) => n + p.length, 0);

      function check() {
        if (paths.every((_, c) => joined(c)) && filled() === N * N) {
          g.score = Math.round(t);
          api.gameOver(`Solved in ${util.formatTime(t * 1000)}!`);
        }
      }

      function begin(x, y) {
        const e = endAt[y][x];
        active = null;
        if (e >= 0) {
          paths[e] = [[x, y]];
          active = e;
          return;
        }
        paths.forEach((p, c) => {
          const i = p.findIndex(q => same(q, [x, y]));
          if (i >= 0) {
            p.length = i + 1;
            active = c;
          }
        });
      }

      function step(cell) {
        if (active === null || !inside(cell[0], cell[1])) return false;
        const p = paths[active];
        if (!adj(p[p.length - 1], cell)) return false;
        const i = p.findIndex(q => same(q, cell));
        if (i >= 0) {
          p.length = i + 1;
          return true;
        }
        if (joined(active)) return false;
        const e = endAt[cell[1]][cell[0]];
        if (e >= 0 && e !== active) return false;
        paths.forEach((q, c) => {
          const j = q.findIndex(r => same(r, cell));
          if (c !== active && j >= 0) q.length = j;
        });
        p.push(cell);
        check();
        return true;
      }

      function dragTo(x, y) {
        const target = [util.clamp(Math.floor(x), 0, N - 1), util.clamp(Math.floor(y), 0, N - 1)];
        for (let n = 0; n < 2 * N && active !== null; n++) {
          const last = paths[active][paths[active].length - 1];
          if (same(last, target)) return;
          const dx = target[0] - last[0];
          const dy = target[1] - last[1];
          const next = Math.abs(dx) >= Math.abs(dy) ? [last[0] + Math.sign(dx), last[1]] : [last[0], last[1] + Math.sign(dy)];
          if (!step(next)) return;
        }
      }

      g.update = dt => { t += dt; };
      g.pointer = (type, x, y) => {
        if (type === 'down') {
          showCursor = false;
          if (inside(Math.floor(x), Math.floor(y))) begin(Math.floor(x), Math.floor(y));
        } else if (type === 'move') {
          if (active !== null) dragTo(x, y);
        } else {
          active = null;
        }
      };
      g.action = a => {
        showCursor = true;
        if (a === 'action') {
          if (active === null) begin(cur.x, cur.y);
          else active = null;
          return;
        }
        const d = DIRS[a];
        if (!d) return;
        const next = [cur.x + d[0], cur.y + d[1]];
        if (!inside(next[0], next[1])) return;
        if (active !== null && !step(next)) return;
        [cur.x, cur.y] = next;
      };
      g.draw = rd => {
        const segsGrid = [];
        for (let k = 0; k <= N; k++) segsGrid.push(k, 0, k, N, 0, k, N, k);
        rd.lines(segsGrid, 0.03, 'both', WHITE, 0.3);
        paths.forEach((p, c) => {
          const col = SYMBOL_COLOURS[kinds[c]];
          const strength = joined(c) ? 1 : 0.7;
          p.forEach(([x, y]) => rd.rect(x + 0.08, y + 0.08, 0.84, 0.84, 'fellow', col, 0.25 * strength));
          const line = [];
          for (let i = 1; i < p.length; i++) line.push(p[i - 1][0] + 0.5, p[i - 1][1] + 0.5, p[i][0] + 0.5, p[i][1] + 0.5);
          if (line.length) rd.lines(line, 0.26, 'fellow', col, strength);
        });
        ends.forEach((pair, c) => pair.forEach(([x, y]) => symbol(rd, x + 0.5, y + 0.5, 0.28, kinds[c], 'amb')));
        if (showCursor) rd.box(cur.x + 0.04, cur.y + 0.04, 0.92, 0.92, active !== null ? 0.1 : 0.05, 'both', WHITE, 0.9);
      };
      g.hud = () => [`Joined ${paths.filter((_, c) => joined(c)).length}/${P}`, `Filled ${Math.round((filled() * 100) / (N * N))}%`, `Time ${util.formatTime(t * 1000)}`];
      return g;
    },
  });

  DG.register({
    id: 'prism',
    name: 'Prism',
    category: 'Puzzles',
    description: 'Turn the mirrors to bounce the light beam onto every target.',
    help: 'Tap a mirror to turn it. Guide the beam from the light on the left so that it passes through every target. Your weaker eye sees the beam and targets; your stronger eye sees the mirrors and walls.',
    width: 7,
    height: 6,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Turn' },
    repeat: ['left', 'up', 'down', 'right'],
    lowerIsBetter: true,
    create(api) {
      const N = [5, 6, 7][api.difficulty];
      const MIRRORS = [5, 8, 11][api.difficulty];
      const TARGETS = [2, 3, 4][api.difficulty];
      const WALLS = [0, 2, 3][api.difficulty];
      const MIN_BOUNCES = [2, 3, 4][api.difficulty];
      const EMPTY = 0;
      const SLASH = 1;
      const BACK = 2;
      const WALL = 3;
      const g = { width: N + 1, height: N };
      const cur = { x: 0, y: 0 };
      let grid;
      let src;
      let targets;
      let moves = 0;
      let showCursor = false;

      // Follows the beam; screen x is grid x + 1 because the light sits in an extra column on the left.
      function trace() {
        const cells = new Set();
        const pts = [0.5, src + 0.5];
        const seen = new Set();
        let x = -1;
        let y = src;
        let dx = 1;
        let dy = 0;
        let bounces = 0;
        for (;;) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) {
            pts.push(x + 1.5 + dx * 0.5, y + 0.5 + dy * 0.5);
            break;
          }
          x = nx;
          y = ny;
          const c = grid[y][x];
          if (c === WALL) {
            pts.push(x + 1.5 - dx * 0.5, y + 0.5 - dy * 0.5);
            break;
          }
          const state = `${x},${y},${dx},${dy}`;
          if (seen.has(state)) {
            pts.push(x + 1.5, y + 0.5);
            break;
          }
          seen.add(state);
          if (c === SLASH || c === BACK) {
            pts.push(x + 1.5, y + 0.5);
            [dx, dy] = c === SLASH ? [-dy, -dx] : [dy, dx];
            bounces++;
          } else {
            cells.add(`${x},${y}`);
          }
        }
        return { cells, pts, bounces };
      }

      const solved = () => {
        const { cells } = trace();
        return targets.every(k => cells.has(k));
      };

      for (let tries = 0; tries < 5000; tries++) {
        grid = util.grid(N, N, EMPTY);
        src = util.randInt(N);
        const spots = util.shuffle([...Array(N * N).keys()]);
        spots.slice(0, MIRRORS).forEach(i => { grid[Math.floor(i / N)][i % N] = util.pick([SLASH, BACK]); });
        spots.slice(MIRRORS, MIRRORS + WALLS).forEach(i => { grid[Math.floor(i / N)][i % N] = WALL; });
        const { cells, bounces } = trace();
        if (bounces < MIN_BOUNCES || cells.size < TARGETS + 2) continue;
        // Cells before the first mirror are lit whatever you do, so they make poor targets.
        const firstRow = new Set([...Array(N).keys()].map(x => `${x},${src}`));
        const pool = [...cells].filter(k => !firstRow.has(k));
        if (pool.length < TARGETS) continue;
        targets = util.shuffle(pool).slice(0, TARGETS);
        const mirrorCells = [];
        grid.forEach((row, y) => row.forEach((c, x) => { if (c === SLASH || c === BACK) mirrorCells.push([x, y]); }));
        for (let k = 0; k < 30 && solved(); k++) {
          for (const [x, y] of mirrorCells) grid[y][x] = util.pick([SLASH, BACK]);
        }
        if (!solved()) break;
      }

      function turn(x, y) {
        const c = grid[y][x];
        if (c !== SLASH && c !== BACK) return;
        grid[y][x] = c === SLASH ? BACK : SLASH;
        moves++;
        if (solved()) {
          g.score = moves;
          api.gameOver(`All targets lit in ${moves} moves!`);
        }
      }

      g.pointer = (type, x, y) => {
        const gx = Math.floor(x - 1);
        const gy = Math.floor(y);
        if (type !== 'down' || gx < 0 || gy < 0 || gx >= N || gy >= N) return;
        showCursor = false;
        turn(gx, gy);
      };
      g.action = a => {
        showCursor = true;
        if (!moveCursor(cur, a, N, N) && a === 'action') turn(cur.x, cur.y);
      };
      g.draw = rd => {
        const lines = [];
        for (let k = 0; k <= N; k++) lines.push(1 + k, 0, 1 + k, N, 1, k, 1 + N, k);
        rd.lines(lines, 0.03, 'both', WHITE, 0.25);
        grid.forEach((row, y) => row.forEach((c, x) => {
          const px = x + 1;
          if (c === WALL) rd.rect(px + 0.08, y + 0.08, 0.84, 0.84, 'fellow', [150, 150, 170], 0.8);
          else if (c === SLASH) rd.line(px + 0.15, y + 0.85, px + 0.85, y + 0.15, 0.12, 'fellow', [200, 230, 255]);
          else if (c === BACK) rd.line(px + 0.15, y + 0.15, px + 0.85, y + 0.85, 0.12, 'fellow', [200, 230, 255]);
        }));
        const { cells, pts } = trace();
        for (const k of targets) {
          const [x, y] = k.split(',').map(Number);
          if (cells.has(k)) rd.circle(x + 1.5, y + 0.5, 0.26, 'amb', [120, 255, 140]);
          rd.ring(x + 1.5, y + 0.5, 0.32, 0.07, 'amb', [120, 255, 140]);
        }
        const segs = [];
        for (let i = 2; i < pts.length; i += 2) segs.push(pts[i - 2], pts[i - 1], pts[i], pts[i + 1]);
        rd.lines(segs, 0.09, 'amb', [255, 220, 80], 0.9);
        rd.poly([0.15, src + 0.2, 0.85, src + 0.5, 0.15, src + 0.8], 'amb', [255, 220, 80]);
        if (showCursor) rd.box(cur.x + 1.04, cur.y + 0.04, 0.92, 0.92, 0.05, 'both', WHITE, 0.9);
      };
      g.hud = () => {
        const { cells } = trace();
        return [`Lit ${targets.filter(k => cells.has(k)).length}/${TARGETS}`, `Moves ${moves}`];
      };
      return g;
    },
  });
})();
