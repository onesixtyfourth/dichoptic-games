'use strict';

(() => {
  const { util, WHITE } = DG;
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
      const COLOURS = [[240, 80, 80], [80, 200, 90], [80, 140, 255], [240, 220, 60], [200, 90, 240], [90, 220, 220]];
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
        const col = COLOURS[t];
        const s = 0.2;
        rd.ring(x, y, 0.42, 0.07, target, col, strength);
        if (t === 0) rd.circle(x, y, s, target, col, strength);
        else if (t === 1) rd.poly([x, y - s * 1.2, x + s * 1.1, y + s * 0.8, x - s * 1.1, y + s * 0.8], target, col, strength);
        else if (t === 2) rd.rect(x - s, y - s, 2 * s, 2 * s, target, col, strength);
        else if (t === 3) rd.poly([x, y - s * 1.3, x + s * 1.1, y, x, y + s * 1.3, x - s * 1.1, y], target, col, strength);
        else if (t === 4) rd.lines([x - s, y - s, x + s, y + s, x + s, y - s, x - s, y + s], 0.09, target, col, strength);
        else rd.lines([x - s * 1.2, y, x + s * 1.2, y, x, y - s * 1.2, x, y + s * 1.2], 0.09, target, col, strength);
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
})();
