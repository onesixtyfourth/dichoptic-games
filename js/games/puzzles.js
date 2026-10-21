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
})();
