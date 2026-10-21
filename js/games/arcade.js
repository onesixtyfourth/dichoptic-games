'use strict';

(() => {
  const { util, WHITE } = DG;
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
})();
