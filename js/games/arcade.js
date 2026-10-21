'use strict';

(() => {
  const { util, WHITE, symbol } = DG;
  const RAINBOW = [[240, 60, 60], [240, 150, 40], [240, 230, 40], [60, 220, 80], [60, 160, 240], [170, 80, 240]];

  // Paddle position from held buttons and/or a dragged pointer target.
  function steer(api, x, target, speed, dt, lo, hi) {
    if (target !== null) x += util.clamp(target - x, -speed * dt, speed * dt);
    if (api.held('left')) x -= speed * dt;
    if (api.held('right')) x += speed * dt;
    return util.clamp(x, lo, hi);
  }

  {
    const COLS = 10;
    const ROWS = 20;
    const PIECES = [
      { m: [[1, 1, 1, 1]], c: [0, 240, 240] },
      { m: [[1, 1], [1, 1]], c: [240, 240, 0] },
      { m: [[0, 1, 0], [1, 1, 1]], c: [160, 0, 240] },
      { m: [[0, 1, 1], [1, 1, 0]], c: [0, 240, 0] },
      { m: [[1, 1, 0], [0, 1, 1]], c: [240, 0, 0] },
      { m: [[1, 0, 0], [1, 1, 1]], c: [0, 0, 240] },
      { m: [[0, 0, 1], [1, 1, 1]], c: [240, 160, 0] },
    ];
    const rotate = m => m[0].map((_, i) => m.map(row => row[i]).reverse());

    DG.register({
      id: 'blocks',
      name: 'Blocks',
      category: 'Arcade',
      description: 'Slide and rotate falling pieces to clear lines.',
      help: 'Move and rotate the falling piece to complete lines. Your weaker eye sees the falling piece; your stronger eye sees the stack.',
      width: 16,
      height: 20,
      buttons: ['left', 'up', 'right', 'down', 'action'],
      labels: { up: '\u27F3', action: '\u2913' },
      repeat: ['left', 'right', 'down'],
      create(api) {
        const g = { score: 0 };
        const startLevel = [1, 3, 6][api.difficulty];
        let board = util.grid(COLS, ROWS, null);
        let bag = [];
        let piece = null;
        let next = null;
        let lines = 0;
        let level = startLevel;
        let timer = 0;

        const fits = (m, x, y) => m.every((row, r) => row.every((v, c) =>
          !v || (x + c >= 0 && x + c < COLS && y + r < ROWS && (y + r < 0 || !board[y + r][x + c]))));
        const take = () => {
          if (!bag.length) bag = util.shuffle(PIECES.slice());
          return bag.pop();
        };

        function spawn() {
          const p = next || take();
          next = take();
          piece = { m: p.m, c: p.c, x: Math.floor((COLS - p.m[0].length) / 2), y: 0 };
          if (!fits(piece.m, piece.x, piece.y)) api.gameOver(`Game over \u2013 score ${g.score}, lines ${lines}`);
        }

        function move(dx, dy) {
          if (!fits(piece.m, piece.x + dx, piece.y + dy)) return false;
          piece.x += dx;
          piece.y += dy;
          return true;
        }

        function lock() {
          piece.m.forEach((row, r) => row.forEach((v, c) => {
            if (v) board[piece.y + r][piece.x + c] = piece.c;
          }));
          const kept = board.filter(row => row.some(cell => !cell));
          const cleared = ROWS - kept.length;
          while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
          board = kept;
          if (cleared) {
            lines += cleared;
            g.score += [0, 100, 300, 500, 800][cleared] * level;
            level = startLevel + Math.floor(lines / 10);
          }
          timer = 0;
          spawn();
        }

        function turn() {
          const m = rotate(piece.m);
          for (const dx of [0, -1, 1, -2, 2]) {
            if (fits(m, piece.x + dx, piece.y)) {
              piece.m = m;
              piece.x += dx;
              return;
            }
          }
        }

        g.action = a => {
          if (a === 'left') move(-1, 0);
          else if (a === 'right') move(1, 0);
          else if (a === 'up' || a === 'alt') turn();
          else if (a === 'down') {
            if (!move(0, 1)) lock();
            timer = 0;
          } else if (a === 'action') {
            while (move(0, 1));
            lock();
          }
        };

        g.update = dt => {
          timer += dt;
          if (timer >= Math.max(0.08, 0.8 * Math.pow(0.85, level - 1))) {
            timer = 0;
            if (!move(0, 1)) lock();
          }
        };

        g.draw = r => {
          r.box(0, 0, COLS, ROWS, 0.06, 'both', WHITE, 0.4);
          board.forEach((row, y) => row.forEach((c, x) => {
            if (c) r.tile(x, y, 1, 1, 'fellow', c);
          }));
          piece.m.forEach((row, y) => row.forEach((v, x) => {
            if (v) r.tile(piece.x + x, piece.y + y, 1, 1, 'amb', piece.c);
          }));
          r.text('NEXT', 13, 0.8, 0.7, 'both', WHITE, 0.8);
          const x0 = 13 - next.m[0].length * 0.45;
          next.m.forEach((row, y) => row.forEach((v, x) => {
            if (v) r.tile(x0 + x * 0.9, 1.8 + y * 0.9, 0.9, 0.9, 'amb', next.c);
          }));
        };

        g.hud = () => [`Score ${g.score}`, `Lines ${lines}`, `Level ${level}`];
        spawn();
        return g;
      },
    });
  }

  DG.register({
    id: 'snake',
    name: 'Snake',
    category: 'Arcade',
    description: 'Guide the snake to the food without crashing.',
    help: 'Steer with the arrows or by swiping. Your weaker eye sees the snake; your stronger eye sees the food.',
    width: 20,
    height: 20,
    buttons: ['left', 'up', 'down', 'right'],
    swipe: true,
    create(api) {
      const N = 20;
      const DIRS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
      const step = [0.16, 0.12, 0.09][api.difficulty];
      const g = { score: 0 };
      const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      const queue = [];
      let dir = DIRS.right;
      let food;
      let timer = 0;

      function placeFood() {
        do food = { x: util.randInt(N), y: util.randInt(N) };
        while (snake.some(s => s.x === food.x && s.y === food.y));
      }
      placeFood();

      g.action = a => {
        const d = DIRS[a];
        if (!d) return;
        const last = queue.length ? queue[queue.length - 1] : dir;
        if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return;
        if (queue.length < 3) queue.push(d);
      };

      g.update = dt => {
        timer += dt;
        if (timer < step) return;
        timer -= step;
        if (queue.length) dir = queue.shift();
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        const hitSelf = snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y);
        if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || hitSelf) {
          api.gameOver(`Game over \u2013 score ${g.score}`);
          return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          g.score += 10;
          if (snake.length >= N * N) {
            api.gameOver('You filled the board!');
            return;
          }
          placeFood();
        } else {
          snake.pop();
        }
      };

      g.draw = r => {
        snake.forEach((s, i) => r.tile(s.x, s.y, 1, 1, 'amb', [60, 220, 80], i === 0 ? 1 : 0.7));
        r.circle(food.x + 0.5, food.y + 0.5, 0.4, 'fellow', [240, 60, 60]);
      };

      g.hud = () => [`Score ${g.score}`, `Length ${snake.length}`];
      return g;
    },
  });

  DG.register({
    id: 'bricks',
    name: 'Brick Breaker',
    category: 'Arcade',
    description: 'Keep the ball in play and break every brick.',
    help: 'Move the paddle with the buttons or by dragging. Press Launch or tap to serve. Your weaker eye sees the ball and paddle; your stronger eye sees the bricks.',
    width: 12,
    height: 16,
    buttons: ['left', 'action', 'right'],
    labels: { action: 'Launch' },
    create(api) {
      const W = 12;
      const H = 16;
      const R = 0.22;
      const PY = 15;
      const PH = 0.35;
      const pw = [3, 2.5, 2][api.difficulty];
      const baseSpeed = [8, 9.5, 11][api.difficulty];
      const g = { score: 0 };
      let lives = 3;
      let level = 1;
      let px = W / 2;
      let target = null;
      let ball;
      let bricks;

      function buildBricks() {
        bricks = [];
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 10; col++) bricks.push({ x: 1 + col, y: 1.5 + row * 0.6, w: 1, h: 0.6, c: RAINBOW[row] });
        }
      }
      const resetBall = () => { ball = { x: px, y: PY - R, vx: 0, vy: 0, stuck: true }; };
      buildBricks();
      resetBall();

      function launch() {
        if (!ball.stuck) return;
        const sp = baseSpeed * (1 + (level - 1) * 0.1);
        const ang = util.rand(-0.5, 0.5);
        ball.vx = sp * Math.sin(ang);
        ball.vy = -sp * Math.cos(ang);
        ball.stuck = false;
      }

      function step(dt) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }
        if (ball.vy > 0 && ball.y + R >= PY && ball.y + R <= PY + PH + 0.3 && Math.abs(ball.x - px) <= pw / 2 + R) {
          const sp = Math.hypot(ball.vx, ball.vy);
          const ang = util.clamp((ball.x - px) / (pw / 2), -1, 1) * 1.05;
          ball.vx = sp * Math.sin(ang);
          ball.vy = -sp * Math.cos(ang);
          ball.y = PY - R;
        }
        if (ball.y > H + R) {
          lives--;
          if (lives <= 0) api.gameOver(`Game over \u2013 score ${g.score}`);
          else resetBall();
          return false;
        }
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          const dx = ball.x - util.clamp(ball.x, b.x, b.x + b.w);
          const dy = ball.y - util.clamp(ball.y, b.y, b.y + b.h);
          if (dx * dx + dy * dy > R * R) continue;
          bricks.splice(i, 1);
          g.score += 10 * level;
          if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
          else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
          break;
        }
        if (!bricks.length) {
          level++;
          buildBricks();
          resetBall();
          return false;
        }
        return true;
      }

      g.action = a => {
        if (a === 'action' || a === 'up') launch();
      };
      g.pointer = (type, x) => {
        if (type === 'down' || type === 'move') target = x;
        if (type === 'down') launch();
        if (type === 'up') target = null;
      };
      g.update = dt => {
        px = steer(api, px, target, 14, dt, pw / 2, W - pw / 2);
        if (ball.stuck) {
          ball.x = px;
          return;
        }
        const steps = Math.ceil(dt / 0.005);
        for (let i = 0; i < steps; i++) if (!step(dt / steps)) return;
      };
      g.draw = r => {
        bricks.forEach(b => r.tile(b.x, b.y, b.w, b.h, 'fellow', b.c));
        r.rect(px - pw / 2, PY, pw, PH, 'amb', [200, 200, 255]);
        r.circle(ball.x, ball.y, R, 'amb', WHITE);
        if (ball.stuck) r.text('Tap or press Launch', W / 2, 11, 0.6, 'both', WHITE, 0.6);
      };
      g.hud = () => [`Score ${g.score}`, `Lives ${lives}`, `Level ${level}`];
      return g;
    },
  });

  DG.register({
    id: 'tennis',
    name: 'Table Tennis',
    category: 'Arcade',
    description: 'Return the ball and beat the computer to 7.',
    help: 'Move your paddle (bottom) with the buttons or by dragging. First to 7 wins. Your weaker eye sees the ball; your stronger eye sees the paddles.',
    width: 12,
    height: 18,
    buttons: ['left', 'right'],
    create(api) {
      const W = 12;
      const H = 18;
      const R = 0.25;
      const PW = 2.6;
      const PH = 0.35;
      const PY = H - 1.2;
      const CY = 0.85;
      const cpuSpeed = [5, 7, 9.5][api.difficulty];
      const g = { score: 0 };
      let px = W / 2;
      let cx = W / 2;
      let target = null;
      let you = 0;
      let cpu = 0;
      let wait = 0;
      let ball;

      function serve(dir) {
        ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, dir };
        wait = 0.8;
      }
      serve(1);

      function hit(dirY, paddleX) {
        const sp = Math.min(Math.hypot(ball.vx, ball.vy) * 1.06, 20);
        const ang = util.clamp((ball.x - paddleX) / (PW / 2), -1, 1) * 0.95;
        ball.vx = sp * Math.sin(ang);
        ball.vy = dirY * sp * Math.cos(ang);
      }

      function point(playerScored) {
        if (playerScored) you++;
        else cpu++;
        g.score = you;
        if (you >= 7 || cpu >= 7) {
          api.gameOver(you > cpu ? `You win ${you}\u2013${cpu}!` : `Computer wins ${cpu}\u2013${you}`);
          return;
        }
        serve(playerScored ? -1 : 1);
      }

      g.pointer = (type, x) => {
        target = type === 'up' ? null : x;
      };
      g.update = dt => {
        px = steer(api, px, target, 16, dt, PW / 2, W - PW / 2);
        const goal = ball.vy < 0 ? ball.x : W / 2;
        cx = util.clamp(cx + util.clamp(goal - cx, -cpuSpeed * dt, cpuSpeed * dt), PW / 2, W - PW / 2);
        if (wait > 0) {
          wait -= dt;
          if (wait <= 0) {
            const ang = util.rand(-0.6, 0.6);
            ball.vx = 8 * Math.sin(ang);
            ball.vy = 8 * Math.cos(ang) * ball.dir;
          }
          return;
        }
        const steps = Math.ceil(dt / 0.005);
        for (let i = 0; i < steps; i++) {
          const s = dt / steps;
          ball.x += ball.vx * s;
          ball.y += ball.vy * s;
          if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); }
          if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
          if (ball.vy > 0 && ball.y + R >= PY && ball.y + R <= PY + PH + 0.4 && Math.abs(ball.x - px) <= PW / 2 + R) {
            hit(-1, px);
            ball.y = PY - R;
          }
          if (ball.vy < 0 && ball.y - R <= CY + PH && ball.y - R >= CY - 0.4 && Math.abs(ball.x - cx) <= PW / 2 + R) {
            hit(1, cx);
            ball.y = CY + PH + R;
          }
          if (ball.y > H + R) return point(false);
          if (ball.y < -R) return point(true);
        }
      };
      g.draw = r => {
        const dashes = [];
        for (let x = 0.2; x < W; x += 1) dashes.push(x, H / 2, x + 0.5, H / 2);
        r.lines(dashes, 0.08, 'both', WHITE, 0.4);
        r.rect(px - PW / 2, PY, PW, PH, 'fellow', [80, 160, 255]);
        r.rect(cx - PW / 2, CY, PW, PH, 'fellow', [255, 120, 80]);
        r.circle(ball.x, ball.y, R, 'amb', WHITE);
      };
      g.hud = () => [`You ${you}`, `CPU ${cpu}`];
      return g;
    },
  });

  DG.register({
    id: 'flap',
    name: 'Flap',
    category: 'Arcade',
    description: 'Flap through the gaps without touching the walls.',
    help: 'Tap or press Flap to rise. Your weaker eye sees the bird; your stronger eye sees the walls.',
    width: 10,
    height: 16,
    buttons: ['action'],
    labels: { action: 'Flap' },
    create(api) {
      const W = 10;
      const BX = 3;
      const R = 0.42;
      const PIPE = 1.4;
      const GROUND = 15.2;
      const gap = [5, 4.4, 3.8][api.difficulty];
      const speed = [3.2, 3.8, 4.4][api.difficulty];
      const g = { score: 0 };
      let y = 7;
      let vy = 0;
      let started = false;
      let pipes = [];
      let spawn = 0;

      const flap = () => {
        started = true;
        vy = -8.5;
      };
      g.action = a => {
        if (a === 'action' || a === 'up') flap();
      };
      g.pointer = type => {
        if (type === 'down') flap();
      };
      g.update = dt => {
        if (!started) return;
        vy += 26 * dt;
        y += vy * dt;
        if (y < R) { y = R; vy = 0; }
        spawn -= dt;
        if (spawn <= 0) {
          spawn = 9 / speed;
          pipes.push({ x: W, top: util.rand(1.5, GROUND - gap - 1.5), passed: false });
        }
        for (const p of pipes) {
          p.x -= speed * dt;
          if (!p.passed && p.x + PIPE < BX - R) {
            p.passed = true;
            g.score++;
          }
        }
        pipes = pipes.filter(p => p.x > -PIPE);
        const crashed = y + R >= GROUND || pipes.some(p => BX + R > p.x && BX - R < p.x + PIPE && (y - R < p.top || y + R > p.top + gap));
        if (crashed) api.gameOver(`Game over \u2013 score ${g.score}`);
      };
      g.draw = r => {
        for (const p of pipes) {
          r.rect(p.x, 0, PIPE, p.top, 'fellow', [60, 200, 60]);
          r.rect(p.x, p.top + gap, PIPE, GROUND - p.top - gap, 'fellow', [60, 200, 60]);
        }
        r.rect(0, GROUND, W, 0.1, 'both', WHITE, 0.5);
        r.circle(BX, y, R, 'amb', [255, 220, 0]);
        if (!started) r.text('Tap to flap', W / 2, 10, 0.7, 'both', WHITE, 0.7);
      };
      g.hud = () => [`Score ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'runner',
    name: 'Runner',
    category: 'Arcade',
    description: 'Jump and duck past obstacles for as long as you can.',
    help: 'Jump over the blocks and duck under the flyers. Your weaker eye sees the obstacles; your stronger eye sees the runner.',
    width: 20,
    height: 10,
    buttons: ['down', 'action'],
    labels: { down: 'Duck', action: 'Jump' },
    create(api) {
      const GROUND = 8.5;
      const X = 3;
      const RW = 0.8;
      const g = { score: 0 };
      let y = 0;
      let vy = 0;
      let speed = [6, 7.5, 9][api.difficulty];
      let dist = 0;
      let spawn = 1;
      let obstacles = [];
      let ducking = false;

      const jump = () => {
        if (y === 0) vy = 14;
      };
      const runner = () => {
        const h = ducking ? 0.6 : 1.2;
        return { x: X, y: GROUND - y - h, w: RW, h };
      };

      g.action = a => {
        if (a === 'action' || a === 'up') jump();
      };
      g.pointer = type => {
        if (type === 'down') jump();
      };
      g.update = dt => {
        ducking = api.held('down') && y === 0;
        speed += dt * 0.12;
        if (y > 0 || vy > 0) {
          vy -= 40 * dt;
          y += vy * dt;
          if (y <= 0) { y = 0; vy = 0; }
        }
        dist += speed * dt;
        g.score = Math.floor(dist);
        spawn -= dt;
        if (spawn <= 0) {
          spawn = (util.rand(0.9, 1.8) * 7.5) / speed + 0.35;
          if (g.score > 150 && Math.random() < 0.3) {
            obstacles.push({ x: 20, y: GROUND - 1.3, w: 1.1, h: 0.55, flyer: true });
          } else {
            const h = util.rand(0.9, 1.6);
            obstacles.push({ x: 20, y: GROUND - h, w: util.rand(0.5, 1.1), h });
          }
        }
        obstacles.forEach(o => { o.x -= speed * dt; });
        obstacles = obstacles.filter(o => o.x > -2);
        const me = runner();
        if (obstacles.some(o => util.overlap(me, o))) api.gameOver(`Game over \u2013 distance ${g.score}`);
      };
      g.draw = r => {
        r.rect(0, GROUND, 20, 0.08, 'both', WHITE, 0.5);
        const me = runner();
        r.rect(me.x, me.y, me.w, me.h, 'fellow', [80, 160, 255]);
        for (const o of obstacles) {
          if (o.flyer) r.poly([o.x, o.y + o.h / 2, o.x + o.w / 2, o.y, o.x + o.w, o.y + o.h / 2, o.x + o.w / 2, o.y + o.h], 'amb', [255, 120, 80]);
          else r.rect(o.x, o.y, o.w, o.h, 'amb', [60, 200, 60]);
        }
      };
      g.hud = () => [`Distance ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'racer',
    name: 'Traffic Racer',
    category: 'Arcade',
    description: 'Change lanes to weave through traffic.',
    help: 'Change lanes with the buttons or by tapping either side of your car. Your weaker eye sees the traffic; your stronger eye sees your car.',
    width: 9,
    height: 16,
    buttons: ['left', 'right'],
    create(api) {
      const LW = 3;
      const CW = 1.8;
      const CH = 2.6;
      const PY = 12.6;
      const laneX = l => l * LW + LW / 2;
      const g = { score: 0 };
      let lane = 1;
      let px = laneX(1);
      let speed = [8, 10, 12][api.difficulty];
      let dist = 0;
      let nextRow = 8;
      let stripe = 0;
      let cars = [];

      g.action = a => {
        if (a === 'left') lane = Math.max(0, lane - 1);
        if (a === 'right') lane = Math.min(2, lane + 1);
      };
      g.pointer = (type, x) => {
        if (type === 'down') g.action(x < px ? 'left' : 'right');
      };
      g.update = dt => {
        speed += dt * 0.15;
        dist += speed * dt;
        g.score = Math.floor(dist / 10);
        stripe = (stripe + speed * dt) % 2;
        px += util.clamp(laneX(lane) - px, -14 * dt, 14 * dt);
        nextRow -= speed * dt;
        if (nextRow <= 0) {
          nextRow = util.rand(6, 10);
          const v = util.rand(2, 4);
          util.shuffle([0, 1, 2]).slice(0, Math.random() < 0.35 ? 2 : 1).forEach(l => cars.push({ lane: l, y: -CH, v }));
        }
        cars.forEach(c => { c.y += (speed - c.v) * dt; });
        cars = cars.filter(c => c.y < 18);
        const me = { x: px - CW / 2 + 0.1, y: PY + 0.1, w: CW - 0.2, h: CH - 0.2 };
        if (cars.some(c => util.overlap(me, { x: laneX(c.lane) - CW / 2, y: c.y, w: CW, h: CH }))) {
          api.gameOver(`Crash! Distance ${g.score}`);
        }
      };
      g.draw = r => {
        const dashes = [];
        for (let y = -2 + stripe; y < 16; y += 2) dashes.push(3, y, 3, y + 1, 6, y, 6, y + 1);
        r.lines(dashes, 0.1, 'both', WHITE, 0.4);
        for (const c of cars) r.tile(laneX(c.lane) - CW / 2, c.y, CW, CH, 'amb', [255, 120, 80]);
        r.tile(px - CW / 2, PY, CW, CH, 'fellow', [80, 160, 255]);
      };
      g.hud = () => [`Distance ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'shooter',
    name: 'Space Shooter',
    category: 'Arcade',
    description: 'Blast the incoming waves and dodge their fire.',
    help: 'Move your ship with the buttons or by dragging; it fires automatically. Your weaker eye sees the enemies and their shots; your stronger eye sees your ship.',
    width: 12,
    height: 18,
    buttons: ['left', 'right'],
    create(api) {
      const W = 12;
      const SY = 16.4;
      const g = { score: 0 };
      let sx = W / 2;
      let target = null;
      let shots = [];
      let enemies = [];
      let bombs = [];
      let fire = 0;
      let spawn = 1;
      let lives = 3;
      let invuln = 0;
      let t = 0;

      g.pointer = (type, x) => {
        target = type === 'up' ? null : x;
      };
      g.update = dt => {
        t += dt;
        sx = steer(api, sx, target, 12, dt, 0.6, W - 0.6);
        fire -= dt;
        if (fire <= 0) {
          fire = 0.28;
          shots.push({ x: sx, y: SY - 0.6 });
        }
        spawn -= dt;
        if (spawn <= 0) {
          spawn = Math.max(0.35, [1.3, 1.0, 0.8][api.difficulty] - t * 0.004);
          enemies.push({ x: util.rand(1, W - 1), y: -1, vy: util.rand(1.5, 3) + t * 0.01, phase: util.rand(0, 6), fire: util.rand(1, 3) });
        }
        shots.forEach(s => { s.y -= 16 * dt; });
        bombs.forEach(b => { b.y += 7 * dt; });
        for (const e of enemies) {
          e.y += e.vy * dt;
          e.phase += dt * 2;
          e.x = util.clamp(e.x + Math.sin(e.phase) * dt * 1.5, 0.6, W - 0.6);
          e.fire -= dt;
          if (e.fire <= 0) {
            e.fire = util.rand(1.5, 3.5);
            bombs.push({ x: e.x, y: e.y + 0.5 });
          }
        }
        for (const e of enemies) {
          for (const s of shots) {
            if (!s.dead && !e.dead && Math.abs(s.x - e.x) < 0.6 && Math.abs(s.y - e.y) < 0.6) {
              s.dead = e.dead = true;
              g.score += 10;
            }
          }
        }
        invuln -= dt;
        if (invuln <= 0) {
          const hit = bombs.some(b => Math.abs(b.x - sx) < 0.55 && Math.abs(b.y - SY) < 0.6)
            || enemies.some(e => !e.dead && Math.abs(e.x - sx) < 0.9 && Math.abs(e.y - SY) < 0.9);
          if (hit) {
            lives--;
            invuln = 1.5;
            bombs = [];
            if (lives <= 0) {
              api.gameOver(`Game over \u2013 score ${g.score}`);
              return;
            }
          }
        }
        shots = shots.filter(s => !s.dead && s.y > -1);
        bombs = bombs.filter(b => b.y < 19);
        enemies = enemies.filter(e => !e.dead && e.y < 19);
      };
      g.draw = r => {
        if (invuln <= 0 || Math.floor(invuln * 8) % 2 === 0) {
          r.poly([sx, SY - 0.6, sx + 0.6, SY + 0.5, sx - 0.6, SY + 0.5], 'fellow', [80, 160, 255]);
        }
        shots.forEach(s => r.rect(s.x - 0.06, s.y - 0.25, 0.12, 0.5, 'fellow', [120, 220, 255]));
        enemies.forEach(e => r.poly([e.x - 0.5, e.y - 0.4, e.x + 0.5, e.y - 0.4, e.x, e.y + 0.5], 'amb', [255, 120, 80]));
        bombs.forEach(b => r.circle(b.x, b.y, 0.15, 'amb', [255, 220, 0]));
      };
      g.hud = () => [`Score ${g.score}`, `Lives ${lives}`];
      return g;
    },
  });

  DG.register({
    id: 'bubbles',
    name: 'Bubble Pop',
    category: 'Arcade',
    description: 'Pop rising bubbles before they escape. Avoid the mines!',
    help: 'Tap bubbles to pop them before they float away, but don\u2019t tap the spiky mines. Your weaker eye sees the bubbles; your stronger eye sees the mines.',
    width: 10,
    height: 16,
    buttons: [],
    create(api) {
      const g = { score: 0 };
      let items = [];
      let spawn = 0;
      let t = 0;
      let lives = 5;
      const mineChance = [0.15, 0.22, 0.3][api.difficulty];

      g.pointer = (type, x, y) => {
        if (type !== 'down') return;
        const hit = items.filter(i => Math.hypot(i.x - x, i.y - y) < i.r + 0.15).pop();
        if (!hit) return;
        items = items.filter(i => i !== hit);
        if (hit.mine) lives--;
        else g.score++;
        if (lives <= 0) api.gameOver(`Game over \u2013 popped ${g.score}`);
      };
      g.update = dt => {
        t += dt;
        spawn -= dt;
        if (spawn <= 0) {
          spawn = Math.max(0.3, 1.1 - t * 0.01);
          const mine = Math.random() < mineChance;
          items.push({ x: util.rand(1, 9), y: 17, r: mine ? 0.5 : util.rand(0.55, 0.9), vy: util.rand(1.5, 2.5) + t * 0.02, mine });
        }
        items.forEach(i => { i.y -= i.vy * dt; });
        lives -= items.filter(i => !i.mine && i.y < -1).length;
        items = items.filter(i => i.y >= -1);
        if (lives <= 0) api.gameOver(`Game over \u2013 popped ${g.score}`);
      };
      g.draw = r => {
        for (const i of items) {
          if (i.mine) {
            const spikes = [];
            for (let k = 0; k < 8; k++) {
              const a = (k * Math.PI) / 4;
              spikes.push(i.x, i.y, i.x + Math.cos(a) * i.r * 1.4, i.y + Math.sin(a) * i.r * 1.4);
            }
            r.lines(spikes, 0.08, 'fellow', [255, 80, 80]);
            r.circle(i.x, i.y, i.r * 0.8, 'fellow', [255, 80, 80]);
          } else {
            r.ring(i.x, i.y, i.r, 0.1, 'amb', [120, 200, 255]);
            r.circle(i.x - i.r * 0.35, i.y - i.r * 0.35, i.r * 0.18, 'amb', WHITE, 0.8);
          }
        }
      };
      g.hud = () => [`Popped ${g.score}`, `Lives ${lives}`];
      return g;
    },
  });

  DG.register({
    id: 'lanedash',
    name: 'Lane Dash',
    category: 'Arcade',
    description: 'Hop across busy roads and fill every goal.',
    help: 'Hop with the arrows or by swiping. Cross the roads without being hit and land in each empty goal at the top. Your weaker eye sees the traffic; your stronger eye sees you.',
    width: 9,
    height: 13,
    buttons: ['left', 'up', 'down', 'right'],
    swipe: true,
    create(api) {
      const W = 9;
      const H = 13;
      const MEDIAN = 6;
      const GOALS = [0, 2, 4, 6, 8];
      const g = { score: 0 };
      const filled = new Set();
      let lives = 3;
      let level = 1;
      let fx = 4;
      let fy = H - 1;
      let furthest = fy;
      let lanes;

      function buildLanes() {
        lanes = [];
        for (let y = 1; y < H - 1; y++) {
          if (y === MEDIAN) {
            lanes.push(null);
            continue;
          }
          const len = util.pick([1, 1.5, 2, 2.5]);
          const spacing = len + util.rand(2.2, 4);
          const n = Math.ceil((W + 3) / spacing);
          const speed = (util.rand(1.2, 2.6) + level * 0.3 + api.difficulty * 0.4) * (y % 2 ? 1 : -1);
          lanes.push({ len, speed, span: n * spacing, cars: Array.from({ length: n }, (_, i) => i * spacing) });
        }
      }
      buildLanes();

      const reset = () => {
        fx = 4;
        fy = H - 1;
        furthest = fy;
      };

      function die() {
        lives--;
        if (lives <= 0) api.gameOver(`Game over \u2013 score ${g.score}`);
        else reset();
      }

      g.action = a => {
        const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[a];
        if (!d) return;
        fx = util.clamp(fx + d[0], 0, W - 1);
        fy = util.clamp(fy + d[1], 0, H - 1);
        if (fy < furthest) {
          furthest = fy;
          g.score += 10;
        }
        if (fy !== 0) return;
        if (!GOALS.includes(fx) || filled.has(fx)) {
          die();
          return;
        }
        filled.add(fx);
        g.score += 100;
        if (filled.size === GOALS.length) {
          filled.clear();
          level++;
          g.score += 500;
          buildLanes();
        }
        reset();
      };
      g.update = dt => {
        for (const l of lanes) {
          if (!l) continue;
          l.cars = l.cars.map(x => {
            x += l.speed * dt;
            if (l.speed > 0 && x > W) x -= l.span;
            if (l.speed < 0 && x < -l.len) x += l.span;
            return x;
          });
        }
        const lane = lanes[fy - 1];
        if (lane && lane.cars.some(x => fx + 0.15 < x + lane.len && fx + 0.85 > x)) die();
      };
      g.draw = rd => {
        rd.rect(0, MEDIAN, W, 1, 'both', WHITE, 0.08);
        rd.rect(0, H - 1, W, 1, 'both', WHITE, 0.08);
        for (const x of GOALS) {
          rd.box(x + 0.1, 0.1, 0.8, 0.8, 0.05, 'both', WHITE, 0.5);
          if (filled.has(x)) rd.circle(x + 0.5, 0.5, 0.3, 'fellow', [60, 220, 80], 0.7);
        }
        lanes.forEach((l, i) => {
          if (l) l.cars.forEach(x => rd.tile(x, i + 1, l.len, 1, 'amb', RAINBOW[i % RAINBOW.length]));
        });
        rd.circle(fx + 0.5, fy + 0.5, 0.35, 'fellow', [60, 220, 80]);
      };
      g.hud = () => [`Score ${g.score}`, `Lives ${lives}`, `Level ${level}`];
      return g;
    },
  });

  DG.register({
    id: 'whack',
    name: 'Whack-a-Mole',
    category: 'Arcade',
    description: 'Tap the moles before they hide. Leave the bombs alone!',
    help: 'Tap each mole as it pops up \u2013 you have one minute. Don\u2019t tap the spiky bombs. Moles appear to either your weaker or your stronger eye, so keep both working.',
    width: 3,
    height: 4,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Whack' },
    create(api) {
      const [C, R] = [[3, 3], [3, 4], [4, 4]][api.difficulty];
      const LENGTH = 60;
      const life = [1.6, 1.25, 1.0][api.difficulty];
      const g = { score: 0, width: C, height: R };
      const cur = { x: 0, y: 0 };
      let moles = [];
      let spawn = 0.5;
      let t = 0;
      let misses = 0;
      let showCursor = false;

      function whack(i) {
        const mole = moles.find(o => o.i === i);
        if (!mole) return;
        moles = moles.filter(o => o !== mole);
        g.score = mole.bomb ? Math.max(0, g.score - 3) : g.score + 1;
      }

      g.update = dt => {
        t += dt;
        if (t >= LENGTH) {
          api.gameOver(`Time\u2019s up \u2013 ${g.score} hits, ${misses} missed`);
          return;
        }
        moles.forEach(o => { o.age += dt; });
        misses += moles.filter(o => !o.bomb && o.age >= o.life).length;
        moles = moles.filter(o => o.age < o.life);
        spawn -= dt;
        if (spawn <= 0) {
          spawn = Math.max(0.35, 0.9 - t * 0.008);
          const free = [];
          for (let i = 0; i < C * R; i++) if (!moles.some(o => o.i === i)) free.push(i);
          if (free.length) {
            moles.push({ i: util.pick(free), age: 0, life: life * util.rand(0.8, 1.2), bomb: Math.random() < 0.18, eye: Math.random() < 0.5 ? 'amb' : 'fellow' });
          }
        }
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down' || x < 0 || y < 0 || x >= C || y >= R) return;
        showCursor = false;
        whack(Math.floor(y) * C + Math.floor(x));
      };
      g.action = a => {
        showCursor = true;
        const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[a];
        if (d) {
          cur.x = util.clamp(cur.x + d[0], 0, C - 1);
          cur.y = util.clamp(cur.y + d[1], 0, R - 1);
        } else if (a === 'action') {
          whack(cur.y * C + cur.x);
        }
      };
      g.draw = rd => {
        for (let i = 0; i < C * R; i++) rd.ring((i % C) + 0.5, Math.floor(i / C) + 0.62, 0.36, 0.03, 'both', WHITE, 0.3);
        for (const o of moles) {
          const x = (o.i % C) + 0.5;
          const y = Math.floor(o.i / C) + 0.55;
          const size = 0.3 * Math.min(1, o.age / 0.12, (o.life - o.age) / 0.12);
          if (o.bomb) {
            const spikes = [];
            for (let k = 0; k < 8; k++) {
              const a = (k * Math.PI) / 4;
              spikes.push(x, y, x + Math.cos(a) * size * 1.4, y + Math.sin(a) * size * 1.4);
            }
            rd.lines(spikes, 0.05, o.eye, [255, 80, 80]);
            rd.circle(x, y, size * 0.75, o.eye, [255, 80, 80]);
          } else {
            rd.circle(x, y, size, o.eye, [200, 150, 90]);
          }
        }
        if (showCursor) rd.box(cur.x + 0.04, cur.y + 0.04, 0.92, 0.92, 0.04, 'both', WHITE, 0.7);
      };
      g.hud = () => [`Hits ${g.score}`, `Missed ${misses}`, `${Math.ceil(LENGTH - t)}s`];
      return g;
    },
  });

  DG.register({
    id: 'asteroids',
    name: 'Asteroids',
    category: 'Arcade',
    description: 'Turn, thrust and shoot to break up drifting rocks.',
    help: '\u25C0 \u25B6 turn, Thrust moves you forward and Fire shoots (hold to keep firing). Big rocks split into smaller ones. Your weaker eye sees the rocks; your stronger eye sees your ship and shots.',
    width: 12,
    height: 16,
    buttons: ['left', 'up', 'right', 'action'],
    labels: { up: 'Thrust', action: 'Fire' },
    create(api) {
      const W = 12;
      const H = 16;
      const SIZES = [1.0, 0.6, 0.35];
      const POINTS = [20, 50, 100];
      const g = { score: 0 };
      const ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0 };
      let rocks = [];
      let shots = [];
      let lives = 3;
      let invuln = 2;
      let wave = 0;
      let cooldown = 0;

      const wrap = o => {
        o.x = (o.x + W) % W;
        o.y = (o.y + H) % H;
      };

      function rock(x, y, size) {
        const sp = util.rand(0.8, 2) * (1 + size * 0.5) * (1 + api.difficulty * 0.25);
        const dir = util.rand(0, Math.PI * 2);
        return { x, y, size, r: SIZES[size], vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, rot: 0, spin: util.rand(-1, 1), pts: Array.from({ length: 9 }, () => util.rand(0.75, 1.1)) };
      }

      function nextWave() {
        wave++;
        for (let i = 0; i < 2 + wave + api.difficulty; i++) {
          let x;
          let y;
          do {
            x = util.rand(0, W);
            y = util.rand(0, H);
          } while (Math.hypot(x - ship.x, y - ship.y) < 5);
          rocks.push(rock(x, y, 0));
        }
      }
      nextWave();

      function fire() {
        if (cooldown > 0 || shots.length >= 6) return;
        cooldown = 0.22;
        const c = Math.cos(ship.a);
        const s = Math.sin(ship.a);
        shots.push({ x: ship.x + c * 0.5, y: ship.y + s * 0.5, vx: ship.vx + c * 14, vy: ship.vy + s * 14, life: 0.9 });
      }

      g.action = a => {
        if (a === 'action') fire();
      };
      g.update = dt => {
        cooldown -= dt;
        invuln -= dt;
        if (api.held('left')) ship.a -= 4 * dt;
        if (api.held('right')) ship.a += 4 * dt;
        if (api.held('up')) {
          ship.vx += Math.cos(ship.a) * 12 * dt;
          ship.vy += Math.sin(ship.a) * 12 * dt;
        }
        if (api.held('action')) fire();
        const drag = Math.pow(0.5, dt);
        ship.vx *= drag;
        ship.vy *= drag;
        const sp = Math.hypot(ship.vx, ship.vy);
        if (sp > 9) {
          ship.vx *= 9 / sp;
          ship.vy *= 9 / sp;
        }
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        wrap(ship);
        for (const s of shots) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.life -= dt;
          wrap(s);
        }
        for (const r of rocks) {
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          r.rot += r.spin * dt;
          wrap(r);
        }
        const born = [];
        for (const r of rocks) {
          for (const s of shots) {
            if (r.dead || s.life <= 0 || Math.hypot(r.x - s.x, r.y - s.y) >= r.r) continue;
            r.dead = true;
            s.life = 0;
            g.score += POINTS[r.size];
            if (r.size < 2) born.push(rock(r.x, r.y, r.size + 1), rock(r.x, r.y, r.size + 1));
          }
        }
        rocks = rocks.filter(r => !r.dead).concat(born);
        shots = shots.filter(s => s.life > 0);
        if (invuln <= 0 && rocks.some(r => Math.hypot(r.x - ship.x, r.y - ship.y) < r.r * 0.9 + 0.3)) {
          lives--;
          if (lives <= 0) {
            api.gameOver(`Game over \u2013 score ${g.score}`);
            return;
          }
          Object.assign(ship, { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2 });
          invuln = 2.5;
        }
        if (!rocks.length) nextWave();
      };
      g.draw = rd => {
        for (const r of rocks) {
          const pts = [];
          r.pts.forEach((k, i) => {
            const a = r.rot + (i * Math.PI * 2) / r.pts.length;
            pts.push(r.x + Math.cos(a) * r.r * k, r.y + Math.sin(a) * r.r * k);
          });
          rd.poly(pts, 'amb', [200, 160, 120]);
        }
        if (invuln <= 0 || Math.floor(invuln * 8) % 2 === 0) {
          const { x, y, a } = ship;
          rd.poly([x + Math.cos(a) * 0.55, y + Math.sin(a) * 0.55, x + Math.cos(a + 2.5) * 0.4, y + Math.sin(a + 2.5) * 0.4, x + Math.cos(a - 2.5) * 0.4, y + Math.sin(a - 2.5) * 0.4], 'fellow', [80, 160, 255]);
          if (api.held('up')) rd.circle(x - Math.cos(a) * 0.45, y - Math.sin(a) * 0.45, 0.12, 'fellow', [255, 180, 60], 0.7);
        }
        shots.forEach(s => rd.circle(s.x, s.y, 0.08, 'fellow', WHITE));
      };
      g.hud = () => [`Score ${g.score}`, `Lives ${lives}`, `Wave ${wave}`];
      return g;
    },
  });

  DG.register({
    id: 'missiles',
    name: 'Missile Defence',
    category: 'Arcade',
    description: 'Tap to stop falling missiles before they reach your cities.',
    help: 'Tap the sky to launch an interceptor that explodes where you tapped, destroying any missiles caught in the blast. Protect your cities for as many waves as you can. Your weaker eye sees the missiles; your stronger eye sees your cities and blasts.',
    width: 12,
    height: 16,
    buttons: ['left', 'up', 'down', 'right', 'action'],
    labels: { action: 'Fire' },
    create(api) {
      const W = 12;
      const GROUND = 15;
      const BASE = { x: 6, y: 14.6 };
      const g = { score: 0 };
      const cities = [1.2, 2.9, 4.6, 7.4, 9.1, 10.8].map(x => ({ x, alive: true }));
      const cross = { x: 6, y: 7 };
      let missiles = [];
      let interceptors = [];
      let blasts = [];
      let wave = 0;
      let toLaunch = 0;
      let spawn = 0;
      let cool = 0;

      function startWave() {
        wave++;
        toLaunch = 6 + wave * 2;
        spawn = 1.5;
      }
      startWave();

      function launch() {
        const tx = util.pick([...cities.filter(c => c.alive).map(c => c.x), BASE.x]);
        const x = util.rand(0.5, W - 0.5);
        const speed = (1.1 + wave * 0.15) * (1 + api.difficulty * 0.3);
        const len = Math.hypot(tx - x, GROUND);
        missiles.push({ sx: x, sy: 0, x, y: 0, vx: ((tx - x) / len) * speed, vy: (GROUND / len) * speed });
      }

      function fireAt(x, y) {
        if (cool > 0 || y >= GROUND - 1) return;
        cool = 0.25;
        const len = Math.hypot(x - BASE.x, y - BASE.y);
        interceptors.push({ x: BASE.x, y: BASE.y, tx: x, ty: y, vx: ((x - BASE.x) / len) * 14, vy: ((y - BASE.y) / len) * 14, left: len });
      }

      g.pointer = (type, x, y) => {
        if (type === 'down') fireAt(x, y);
      };
      g.action = a => {
        if (a === 'action') fireAt(cross.x, cross.y);
      };
      g.update = dt => {
        cool -= dt;
        const axis = (plus, minus) => (api.held(plus) ? 1 : 0) - (api.held(minus) ? 1 : 0);
        cross.x = util.clamp(cross.x + axis('right', 'left') * 8 * dt, 0.3, W - 0.3);
        cross.y = util.clamp(cross.y + axis('down', 'up') * 8 * dt, 0.3, GROUND - 1.2);
        if (toLaunch > 0) {
          spawn -= dt;
          if (spawn <= 0) {
            spawn = util.rand(0.5, 1.6) / (1 + wave * 0.1);
            launch();
            toLaunch--;
          }
        }
        for (const m of missiles) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
        }
        for (const i of interceptors) {
          i.x += i.vx * dt;
          i.y += i.vy * dt;
          i.left -= 14 * dt;
          if (i.left <= 0) blasts.push({ x: i.tx, y: i.ty, t: 0, r: 0 });
        }
        interceptors = interceptors.filter(i => i.left > 0);
        for (const b of blasts) {
          b.t += dt;
          b.r = b.t < 0.4 ? (b.t / 0.4) * 1.3 : Math.max(0, 1.3 * (1 - (b.t - 0.4) / 0.4));
        }
        blasts = blasts.filter(b => b.t < 0.8);
        for (const m of missiles) {
          if (blasts.some(b => Math.hypot(b.x - m.x, b.y - m.y) < b.r)) {
            m.dead = true;
            g.score += 25;
          } else if (m.y >= GROUND) {
            m.dead = true;
            const hit = cities.find(c => c.alive && Math.abs(c.x - m.x) < 0.8);
            if (hit) hit.alive = false;
          }
        }
        missiles = missiles.filter(m => !m.dead);
        if (!cities.some(c => c.alive)) {
          api.gameOver(`All cities lost \u2013 score ${g.score}`);
          return;
        }
        if (toLaunch === 0 && !missiles.length) {
          g.score += cities.filter(c => c.alive).length * 100;
          startWave();
        }
      };
      g.draw = rd => {
        rd.rect(0, GROUND, W, 0.08, 'both', WHITE, 0.4);
        for (const c of cities) {
          if (c.alive) {
            rd.poly([c.x - 0.5, GROUND, c.x - 0.5, GROUND - 0.5, c.x - 0.2, GROUND - 0.5, c.x - 0.2, GROUND - 0.8, c.x + 0.2, GROUND - 0.8, c.x + 0.2, GROUND - 0.4, c.x + 0.5, GROUND - 0.4, c.x + 0.5, GROUND], 'fellow', [80, 160, 255]);
          } else {
            rd.rect(c.x - 0.5, GROUND - 0.12, 1, 0.12, 'fellow', [80, 160, 255], 0.3);
          }
        }
        rd.poly([BASE.x - 0.6, GROUND, BASE.x, BASE.y - 0.3, BASE.x + 0.6, GROUND], 'fellow', [120, 220, 120]);
        for (const m of missiles) {
          rd.line(m.sx, m.sy, m.x, m.y, 0.05, 'amb', [255, 120, 80], 0.45);
          rd.circle(m.x, m.y, 0.13, 'amb', [255, 120, 80]);
        }
        interceptors.forEach(i => rd.circle(i.x, i.y, 0.1, 'fellow', WHITE));
        blasts.forEach(b => rd.circle(b.x, b.y, b.r, 'fellow', [255, 220, 120], 0.6));
        rd.lines([cross.x - 0.35, cross.y, cross.x + 0.35, cross.y, cross.x, cross.y - 0.35, cross.x, cross.y + 0.35], 0.05, 'both', WHITE, 0.6);
      };
      g.hud = () => [`Score ${g.score}`, `Wave ${wave}`, `Cities ${cities.filter(c => c.alive).length}`];
      return g;
    },
  });

  DG.register({
    id: 'shapehero',
    name: 'Shape Hero',
    category: 'Arcade',
    description: 'Switch the catchers so every falling shape lands on its match.',
    help: 'Tap a lane (or choose it with \u25C0 \u25B6 and press Switch) to change the shape of its catcher. Each falling shape must land on a catcher with the same shape. Your weaker eye sees the falling shapes; your stronger eye sees the catchers.',
    width: 10,
    height: 16,
    buttons: ['left', 'action', 'right'],
    labels: { action: 'Switch' },
    create(api) {
      const W = 10;
      const CY = 14.6;
      const L = [3, 3, 4][api.difficulty];
      const K = [3, 4, 5][api.difficulty];
      const LW = W / L;
      const g = { score: 0 };
      const catchers = Array.from({ length: L }, (_, i) => i % K);
      let sel = Math.floor(L / 2);
      let showCursor = false;
      let items = [];
      let marks = [];
      let spawn = 1;
      let t = 0;
      let lives = 3;

      const laneX = i => i * LW + LW / 2;
      const turn = i => { catchers[i] = (catchers[i] + 1) % K; };

      g.pointer = (type, x) => {
        if (type !== 'down') return;
        showCursor = false;
        turn(util.clamp(Math.floor(x / LW), 0, L - 1));
      };
      g.action = a => {
        showCursor = true;
        if (a === 'left') sel = Math.max(0, sel - 1);
        else if (a === 'right') sel = Math.min(L - 1, sel + 1);
        else if (a === 'action') turn(sel);
      };
      g.update = dt => {
        t += dt;
        const speed = [2.6, 3.2, 3.8][api.difficulty] + t * 0.03;
        spawn -= dt;
        if (spawn <= 0) {
          spawn = Math.max(0.5, [1.7, 1.35, 1.1][api.difficulty] - t * 0.006);
          const free = [];
          for (let i = 0; i < L; i++) if (!items.some(o => o.lane === i && o.y < 3)) free.push(i);
          if (free.length) items.push({ lane: util.pick(free), y: -0.8, k: util.randInt(K) });
        }
        for (const o of items) {
          o.y += speed * dt;
          if (o.y < CY) continue;
          o.done = true;
          const ok = catchers[o.lane] === o.k;
          marks.push({ lane: o.lane, ok, t: 0.4 });
          if (ok) g.score++;
          else lives--;
        }
        items = items.filter(o => !o.done);
        marks.forEach(m => { m.t -= dt; });
        marks = marks.filter(m => m.t > 0);
        if (lives <= 0) api.gameOver(`Game over \u2013 caught ${g.score}`);
      };
      g.draw = rd => {
        const segs = [];
        for (let i = 1; i < L; i++) segs.push(i * LW, 0, i * LW, 16);
        rd.lines(segs, 0.05, 'both', WHITE, 0.25);
        for (let i = 0; i < L; i++) {
          rd.box(laneX(i) - 0.85, CY - 0.85, 1.7, 1.7, 0.06, 'both', WHITE, 0.4);
          symbol(rd, laneX(i), CY, 0.5, catchers[i], 'fellow');
        }
        for (const o of items) symbol(rd, laneX(o.lane), o.y, 0.45, o.k, 'amb');
        for (const m of marks) {
          const x = laneX(m.lane);
          if (m.ok) rd.ring(x, CY, 1.1, 0.08, 'both', WHITE, m.t * 2);
          else rd.lines([x - 0.6, CY - 0.6, x + 0.6, CY + 0.6, x + 0.6, CY - 0.6, x - 0.6, CY + 0.6], 0.1, 'both', [255, 80, 80], m.t * 2);
        }
        if (showCursor) rd.box(laneX(sel) - 1, CY - 1, 2, 2, 0.06, 'both', WHITE, 0.8);
      };
      g.hud = () => [`Caught ${g.score}`, `Lives ${lives}`];
      return g;
    },
  });

  {
    const MAZE = [
      '#############',
      '#o....#....o#',
      '#.##.#.#.##.#',
      '#...........#',
      '#.##.#.#.##.#',
      '#....#.#....#',
      '###.##-##.###',
      '   .#CCC#.   ',
      '###.#####.###',
      '#.....P.....#',
      '#.##.###.##.#',
      '#o.#.....#.o#',
      '##.#.#.#.#.##',
      '#...........#',
      '#############',
    ];
    const MW = MAZE[0].length;
    const MH = MAZE.length;
    const MOVES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const cellAt = (x, y) => MAZE[y][((x % MW) + MW) % MW];
    const find = ch => {
      const out = [];
      MAZE.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push([x, y]); }));
      return out;
    };
    const START = find('P')[0];
    const HOUSE = find('C');
    const EXIT = [6, 5];

    DG.register({
      id: 'chaser',
      name: 'Chaser',
      category: 'Arcade',
      description: 'Collect every spark in the maze while dodging the chasers.',
      help: 'Steer with the arrows or by swiping. Collect every spark to clear the maze. Big sparks let you chase the chasers for a few seconds. Your weaker eye sees the chasers and sparks; your stronger eye sees you and the maze.',
      width: MW,
      height: MH,
      buttons: ['left', 'up', 'down', 'right'],
      swipe: true,
      create(api) {
        const count = [2, 3, 3][api.difficulty];
        const smart = [0.55, 0.75, 0.9][api.difficulty];
        const scare = [8, 6, 4][api.difficulty];
        const g = { score: 0 };
        let level = 1;
        let lives = 3;
        let sparks;
        let player;
        let chasers;
        let want = null;
        let frightened = 0;
        let eaten = 0;
        let pause = 0;

        const open = (x, y, ghost) => {
          const c = cellAt(x, y);
          return c !== '#' && (c !== '-' || ghost);
        };

        function fillSparks() {
          sparks = new Map();
          MAZE.forEach((row, y) => [...row].forEach((c, x) => {
            if (c === '.' || c === 'o') sparks.set(`${x},${y}`, c === 'o');
          }));
        }

        function resetActors() {
          player = { x: START[0], y: START[1], dx: 0, dy: 0, p: 0 };
          chasers = HOUSE.slice(0, count).map(([x, y], i) => ({ x, y, dx: 0, dy: 0, p: 0, home: true, wait: 1 + i * 3 }));
          want = null;
          frightened = 0;
          pause = 1;
        }
        fillSparks();
        resetActors();

        const pos = e => [e.x + e.dx * e.p, e.y + e.dy * e.p];
        const playerSpeed = () => 4.4 * (1 + (level - 1) * 0.05);
        const chaserSpeed = c => (c.home ? 2.5 : frightened > 0 ? 2.4 : [3.3, 3.7, 4.1][api.difficulty] * (1 + (level - 1) * 0.05));

        // Advance along the grid; at each tile centre `choose` may change direction.
        function advance(e, speed, dt, choose) {
          if (!e.dx && !e.dy) {
            choose(e);
            if (!e.dx && !e.dy) return;
          }
          e.p += speed * dt;
          while (e.p >= 1) {
            e.p -= 1;
            e.x = (((e.x + e.dx) % MW) + MW) % MW;
            e.y += e.dy;
            choose(e);
            if (!e.dx && !e.dy) {
              e.p = 0;
              return;
            }
          }
        }

        function steerPlayer(e) {
          if (want && open(e.x + want[0], e.y + want[1])) [e.dx, e.dy] = want;
          else if (!open(e.x + e.dx, e.y + e.dy)) e.dx = e.dy = 0;
          const key = `${e.x},${e.y}`;
          if (sparks.has(key)) {
            if (sparks.get(key)) {
              g.score += 50;
              frightened = scare;
              eaten = 0;
            } else {
              g.score += 10;
            }
            sparks.delete(key);
          }
        }

        function steerChaser(c) {
          if (c.home && c.y <= EXIT[1]) c.home = false;
          const options = MOVES.filter(([dx, dy]) => open(c.x + dx, c.y + dy, c.home) && !(dx === -c.dx && dy === -c.dy && (c.dx || c.dy)));
          const list = options.length ? options : MOVES.filter(([dx, dy]) => open(c.x + dx, c.y + dy, c.home));
          if (!list.length) return;
          const [tx, ty] = c.home ? EXIT : [player.x, player.y];
          const dist = ([dx, dy]) => Math.hypot(c.x + dx - tx, c.y + dy - ty);
          let choice;
          if (c.home) choice = list.reduce((a, b) => (dist(b) < dist(a) ? b : a));
          else if (frightened > 0) choice = Math.random() < 0.7 ? list.reduce((a, b) => (dist(b) > dist(a) ? b : a)) : util.pick(list);
          else choice = Math.random() < smart ? list.reduce((a, b) => (dist(b) < dist(a) ? b : a)) : util.pick(list);
          [c.dx, c.dy] = choice;
        }

        g.action = a => {
          const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[a];
          if (!d) return;
          want = d;
          if (d[0] === -player.dx && d[1] === -player.dy && (player.dx || player.dy)) {
            player.x = (((player.x + player.dx) % MW) + MW) % MW;
            player.y += player.dy;
            player.dx = d[0];
            player.dy = d[1];
            player.p = 1 - player.p;
          }
        };
        g.update = dt => {
          if (pause > 0) {
            pause -= dt;
            return;
          }
          frightened = Math.max(0, frightened - dt);
          advance(player, playerSpeed(), dt, steerPlayer);
          for (const c of chasers) {
            if (c.wait > 0) {
              c.wait -= dt;
              continue;
            }
            advance(c, chaserSpeed(c), dt, steerChaser);
          }
          const [px, py] = pos(player);
          for (const c of chasers) {
            const [cx, cy] = pos(c);
            if (c.home || Math.hypot(cx - px, cy - py) > 0.6) continue;
            if (frightened > 0) {
              eaten++;
              g.score += 100 * 2 ** eaten;
              const [hx, hy] = HOUSE[1];
              Object.assign(c, { x: hx, y: hy, dx: 0, dy: 0, p: 0, home: true, wait: 2 });
            } else {
              lives--;
              if (lives <= 0) {
                api.gameOver(`Game over \u2013 score ${g.score}`);
                return;
              }
              resetActors();
              return;
            }
          }
          if (!sparks.size) {
            level++;
            fillSparks();
            resetActors();
          }
        };
        g.draw = rd => {
          MAZE.forEach((row, y) => [...row].forEach((c, x) => {
            if (c === '#') rd.rect(x + 0.1, y + 0.1, 0.8, 0.8, 'fellow', [60, 100, 230], 0.7);
            else if (c === '-') rd.rect(x, y + 0.45, 1, 0.1, 'fellow', WHITE, 0.6);
          }));
          for (const [key, big] of sparks) {
            const [x, y] = key.split(',').map(Number);
            rd.circle(x + 0.5, y + 0.5, big ? 0.24 : 0.09, 'amb', [255, 220, 150]);
          }
          const blink = frightened > 0 && frightened < 1.5 && Math.floor(frightened * 6) % 2;
          for (const c of chasers) {
            const [x, y] = pos(c);
            if (frightened > 0 && !c.home) rd.ring(x + 0.5, y + 0.5, 0.33, 0.1, 'amb', blink ? WHITE : [120, 160, 255]);
            else rd.circle(x + 0.5, y + 0.5, 0.38, 'amb', [255, 100, 80]);
          }
          const [px, py] = pos(player);
          rd.circle(px + 0.5, py + 0.5, 0.38, 'fellow', [255, 220, 0]);
        };
        g.hud = () => [`Score ${g.score}`, `Lives ${lives}`, `Level ${level}`];
        return g;
      },
    });
  }

  DG.register({
    id: 'eclipse',
    name: 'Eclipse Runner',
    category: 'Arcade',
    description: 'Jump between the inner and outer track to dodge the blocks.',
    help: 'You run round the ring by yourself. Tap (or press Switch) to jump between the inner and outer track and dodge the blocks. Your weaker eye sees the blocks; your stronger eye sees you.',
    width: 10,
    height: 10,
    buttons: ['action'],
    labels: { action: 'Switch' },
    create(api) {
      const C = 5;
      const R = [2.6, 3.9];
      const g = { score: 0 };
      let a = -Math.PI / 2;
      let track = 1;
      let r = R[1];
      let t = 0;
      let blocks = [];
      let nextA = a + 3.2;
      let lastTrack = 1;

      const flip = () => { track = 1 - track; };
      g.action = x => {
        if (x === 'action' || x === 'up' || x === 'down') flip();
      };
      g.pointer = type => {
        if (type === 'down') flip();
      };
      g.update = dt => {
        t += dt;
        a += ([1.1, 1.35, 1.6][api.difficulty] + t * 0.006) * dt;
        r += util.clamp(R[track] - r, -12 * dt, 12 * dt);
        while (nextA < a + 3.6) {
          const tr = util.randInt(2);
          // Leave extra room when the next block is on the other track, so there is time to switch.
          if (tr !== lastTrack) nextA += 0.3;
          blocks.push({ a: nextA, track: tr });
          lastTrack = tr;
          nextA += util.rand(0.55, 1.1) * [1.25, 1, 0.85][api.difficulty];
        }
        for (const b of blocks) {
          if (b.passed) continue;
          if (a > b.a + 0.25) {
            b.passed = true;
            g.score++;
          } else if (Math.abs(b.a - a) * R[b.track] < 0.55 && Math.abs(r - R[b.track]) < 0.5) {
            api.gameOver(`Game over \u2013 dodged ${g.score}`);
            return;
          }
        }
        blocks = blocks.filter(b => a - b.a < 1);
      };
      g.draw = rd => {
        rd.circle(C, C, 1.4, 'both', WHITE, 0.12);
        rd.ring(C, C, R[0], 0.05, 'both', WHITE, 0.3);
        rd.ring(C, C, R[1], 0.05, 'both', WHITE, 0.3);
        for (const b of blocks) {
          const rr = R[b.track];
          const x = C + Math.cos(b.a) * rr;
          const y = C + Math.sin(b.a) * rr;
          const tx = -Math.sin(b.a) * 0.3;
          const ty = Math.cos(b.a) * 0.3;
          const nx = Math.cos(b.a) * 0.3;
          const ny = Math.sin(b.a) * 0.3;
          rd.poly([x + tx + nx, y + ty + ny, x - tx + nx, y - ty + ny, x - tx - nx, y - ty - ny, x + tx - nx, y + ty - ny], 'amb', [255, 120, 80]);
        }
        rd.circle(C + Math.cos(a) * r, C + Math.sin(a) * r, 0.3, 'fellow', [255, 220, 0]);
      };
      g.hud = () => [`Dodged ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'bouncer',
    name: 'Bouncer',
    category: 'Arcade',
    description: 'Slide the platforms so the bouncing ball drops through the gaps.',
    help: 'Drag sideways (or use \u25C0 \u25B6) to slide every platform. Line up a gap under the ball to drop through, and keep it off the red sections. Drop through three gaps in a row to smash the next platform. Your weaker eye sees the ball and red sections; your stronger eye sees the platforms.',
    width: 10,
    height: 16,
    buttons: ['left', 'right'],
    create(api) {
      const W = 10;
      const BX = 5;
      const BR = 0.32;
      const STEP = 3.4;
      const GRAVITY = 30;
      const BOUNCE = 10.5;
      const GW = [2.6, 2.2, 1.8][api.difficulty];
      const g = { score: 0 };
      const wrap = v => ((v % W) + W) % W;
      let off = 0;
      let by = 3;
      let vy = 0;
      let cam = 0;
      let combo = 0;
      let dragX = null;
      let made = 0;
      let plats = [];
      let flash = 0;

      function addPlat() {
        const y = plats.length ? plats[plats.length - 1].y + STEP : 5;
        const n = made++;
        const gx = n === 0 ? wrap(BX + 2) : util.rand(0, W);
        const count = n < 2 ? 0 : util.clamp(Math.floor(n / 6) + api.difficulty, 1, 4);
        const danger = [];
        const solid = W - GW - 0.8;
        const slot = solid / Math.max(1, count);
        for (let i = 0; i < count; i++) {
          const w = Math.min(1.6, slot * 0.7);
          danger.push({ x: wrap(gx + GW + 0.4 + i * slot + util.rand(0, slot - w)), w });
        }
        plats.push({ y, gx, danger });
      }
      while (plats.length < 8) addPlat();

      g.pointer = (type, x) => {
        if (type === 'down') dragX = x;
        else if (type === 'move' && dragX !== null) {
          off = wrap(off + x - dragX);
          dragX = x;
        } else if (type === 'up') dragX = null;
      };
      g.update = dt => {
        off = wrap(off + ((api.held('right') ? 1 : 0) - (api.held('left') ? 1 : 0)) * 7 * dt);
        flash = Math.max(0, flash - dt);
        vy += GRAVITY * dt;
        const prev = by;
        by += vy * dt;
        if (vy > 0) {
          const lx = wrap(BX - off);
          for (const p of plats) {
            if (p.gone || prev + BR > p.y || by + BR < p.y) continue;
            if (wrap(lx - p.gx) < GW) {
              p.gone = true;
              combo++;
              g.score += combo;
              continue;
            }
            if (combo >= 3) {
              p.gone = true;
              g.score += combo;
              combo = 0;
              flash = 0.3;
              continue;
            }
            if (p.danger.some(s => wrap(lx - s.x) < s.w)) {
              api.gameOver(`Game over \u2013 score ${g.score}`);
              return;
            }
            by = p.y - BR;
            vy = -BOUNCE;
            combo = 0;
            break;
          }
        }
        cam = Math.max(cam, by - 5);
        while (plats[plats.length - 1].y < cam + 20) addPlat();
        plats = plats.filter(p => p.y > cam - 2);
      };
      g.draw = rd => {
        const seg = (start, len, y, target, colour) => {
          const s = wrap(start + off);
          if (s + len <= W) rd.rect(s, y, len, 0.4, target, colour);
          else {
            rd.rect(s, y, W - s, 0.4, target, colour);
            rd.rect(0, y, s + len - W, 0.4, target, colour);
          }
        };
        for (const p of plats) {
          if (p.gone) continue;
          const y = p.y - cam;
          seg(p.gx + GW, W - GW, y, 'fellow', [80, 160, 255]);
          for (const s of p.danger) seg(s.x, s.w, y, 'amb', [255, 70, 70]);
        }
        rd.circle(BX, by - cam, BR, 'amb', WHITE);
        if (combo >= 3) rd.ring(BX, by - cam, BR + 0.2, 0.06, 'amb', [255, 220, 0]);
        if (flash > 0) rd.ring(BX, by - cam, 1.5 * (1 - flash / 0.3) + 0.4, 0.08, 'both', WHITE, flash * 3);
      };
      g.hud = () => (combo >= 2 ? [`Score ${g.score}`, `Combo ${combo}`] : [`Score ${g.score}`]);
      return g;
    },
  });
})();
