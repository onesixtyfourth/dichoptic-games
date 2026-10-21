'use strict';

(() => {
  const { util, WHITE } = DG;

  const THEMES = {
    Animals: ['TIGER', 'ZEBRA', 'HORSE', 'RABBIT', 'MONKEY', 'GIRAFFE', 'LION', 'BEAR', 'OTTER', 'WHALE', 'EAGLE', 'SNAKE', 'MOUSE', 'PANDA', 'CAMEL', 'SHEEP'],
    Fruit: ['APPLE', 'BANANA', 'CHERRY', 'GRAPE', 'LEMON', 'MANGO', 'PEACH', 'PLUM', 'ORANGE', 'MELON', 'KIWI', 'PEAR', 'LIME', 'BERRY'],
    Colours: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'PINK', 'BROWN', 'BLACK', 'WHITE', 'SILVER', 'GOLD', 'VIOLET'],
    Sports: ['TENNIS', 'SOCCER', 'RUGBY', 'GOLF', 'HOCKEY', 'CRICKET', 'BOXING', 'ROWING', 'SKIING', 'DARTS', 'CYCLING', 'SWIMMING'],
    Ocean: ['SHARK', 'CORAL', 'WAVE', 'TIDE', 'SHELL', 'CRAB', 'SQUID', 'REEF', 'DOLPHIN', 'SEAL', 'ANCHOR', 'ISLAND'],
    Space: ['PLANET', 'COMET', 'STAR', 'MOON', 'ORBIT', 'ROCKET', 'GALAXY', 'NEBULA', 'SATURN', 'MARS', 'VENUS', 'METEOR'],
    Weather: ['RAIN', 'SNOW', 'STORM', 'CLOUD', 'SUNNY', 'WIND', 'FROST', 'THUNDER', 'FOG', 'HAIL', 'BREEZE'],
    Kitchen: ['SPOON', 'FORK', 'KNIFE', 'PLATE', 'BOWL', 'KETTLE', 'OVEN', 'TOASTER', 'PAN', 'CUP', 'WHISK'],
  };

  const FIVE = (
    'ABOUT ABOVE ACTOR ADULT AFTER AGAIN AGREE ALARM ALBUM ALIVE ALLOW ALONE ANGLE ANGRY APPLE APRON ARENA ARROW AWAKE ' +
    'BACON BADGE BAKER BEACH BEARD BEAST BENCH BIRTH BLACK BLADE BLAME BLANK BLAST BLEND BLIND BLOCK BLOOM BOARD BOAST ' +
    'BONUS BOOTH BRAIN BRAND BRAVE BREAD BREAK BRICK BRIDE BRIEF BRING BROOM BROWN BRUSH BUILD BUNCH CABIN CABLE CAMEL ' +
    'CANDY CARGO CARRY CATCH CAUSE CHAIN CHAIR CHALK CHARM CHART CHASE CHEAP CHECK CHEEK CHEER CHESS CHEST CHIEF CHILD ' +
    'CHILL CLEAN CLEAR CLIMB CLOCK CLOSE CLOUD COACH COAST COUNT COVER CRAFT CRANE CRASH CREAM CRISP CROWD CROWN CURVE ' +
    'DAILY DAIRY DANCE DEPTH DIRTY DOUBT DOZEN DRAFT DRAIN DRAMA DREAM DRESS DRIFT DRINK DRIVE EAGER EARLY EARTH EIGHT ' +
    'ELBOW EMPTY ENJOY ENTER EQUAL ERROR EVENT EXTRA FAINT FAITH FALSE FANCY FEAST FENCE FIELD FIGHT FINAL FLAME FLASH ' +
    'FLOAT FLOOR FLOUR FLUTE FOCUS FORCE FRAME FRESH FRONT FROST FRUIT GHOST GIANT GLASS GLOVE GRACE GRADE GRAIN GRAND ' +
    'GRAPE GRASS GREAT GREEN GRILL GROUP GUARD GUESS GUIDE HABIT HAPPY HEART HEAVY HONEY HORSE HOTEL HOUSE HUMAN IMAGE ' +
    'INDEX JELLY JUICE KNIFE LABEL LARGE LASER LAUGH LAYER LEARN LEMON LEVEL LIGHT LIMIT LUNCH MAGIC MAJOR MANGO MAPLE ' +
    'MARCH MATCH MEDAL METAL MIGHT MODEL MONEY MONTH MOTOR MOUNT MOUSE MOUTH MUSIC NERVE NIGHT NOISE NORTH NOVEL NURSE ' +
    'OCEAN OFFER OLIVE ONION ORBIT ORDER OTHER OWNER PAINT PANEL PAPER PARTY PASTA PEACE PEARL PEDAL PHONE PIANO PILOT ' +
    'PITCH PIZZA PLACE PLAIN PLANE PLANT PLATE POINT POWER PRESS PRICE PRIDE PRIZE PROUD QUEEN QUICK QUIET RADIO RAISE ' +
    'RANGE RAPID REACH READY RIVER ROAST ROBIN ROBOT ROUND ROUTE ROYAL SALAD SAUCE SCALE SCARF SCENE SCORE SHADE SHAPE ' +
    'SHARE SHARK SHEEP SHELF SHELL SHINE SHIRT SHORE SHORT SKATE SLEEP SLICE SMILE SMOKE SNACK SNAKE SOLID SOUND SOUTH ' +
    'SPACE SPARK SPEAK SPEED SPELL SPICE SPOON SPORT SQUAD STAGE STAIR STAMP STAND START STEAM STEEL STICK STONE STORM ' +
    'STORY STOVE SUGAR SUNNY SWEET SWING TABLE TASTE TEACH THEME THICK THING THREE TIGER TOAST TODAY TOOTH TORCH TOTAL ' +
    'TOUCH TOWEL TOWER TRACK TRADE TRAIN TREAT TRIBE TRUCK TRUST TRUTH UNCLE UNDER UNITY UPPER VALUE VIDEO VISIT VOICE ' +
    'WAGON WATCH WATER WHALE WHEAT WHEEL WHITE WHOLE WORLD WRIST YOUTH ZEBRA'
  ).split(' ').filter(w => w.length === 5);

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  DG.register({
    id: 'wordsearch',
    name: 'Word Search',
    category: 'Words',
    description: 'Find the hidden words in a themed letter grid.',
    help: 'Drag across a word to circle it. Letters alternate between your weaker and stronger eye, so you need both to read them.',
    width: 10,
    height: 13,
    buttons: [],
    create(api) {
      const N = [8, 10, 12][api.difficulty];
      const count = [5, 7, 9][api.difficulty];
      const straight = [[1, 0], [0, 1]];
      const diagonal = [[1, 1], [1, -1]];
      const backwards = [[-1, 0], [0, -1], [-1, -1], [-1, 1]];
      const dirs = [straight, [...straight, ...diagonal], [...straight, ...diagonal, ...backwards]][api.difficulty];
      const size = Math.max(0.5, N * 0.05);
      const rowH = size * 1.5;
      const g = { score: 0, width: N, height: N + 0.4 + Math.ceil(count / 2) * rowH };
      let puzzle;
      let sel = null;
      let nextIn = 0;

      function build() {
        const theme = util.pick(Object.keys(THEMES));
        const grid = util.grid(N, N, '');
        const words = [];
        for (const word of util.shuffle(THEMES[theme].filter(w => w.length <= N))) {
          if (words.length >= count) break;
          for (let attempt = 0; attempt < 150; attempt++) {
            const [dx, dy] = util.pick(dirs);
            const x0 = util.randInt(N);
            const y0 = util.randInt(N);
            const x1 = x0 + dx * (word.length - 1);
            const y1 = y0 + dy * (word.length - 1);
            if (x1 < 0 || y1 < 0 || x1 >= N || y1 >= N) continue;
            let ok = true;
            for (let k = 0; k < word.length && ok; k++) {
              const ch = grid[y0 + dy * k][x0 + dx * k];
              ok = !ch || ch === word[k];
            }
            if (!ok) continue;
            for (let k = 0; k < word.length; k++) grid[y0 + dy * k][x0 + dx * k] = word[k];
            words.push(word);
            break;
          }
        }
        grid.forEach(row => row.forEach((ch, x) => { if (!ch) row[x] = util.pick(ALPHABET); }));
        puzzle = { theme, grid, words: words.sort(), found: [] };
      }
      build();

      const cellAt = (x, y) => ({ x: util.clamp(Math.floor(x), 0, N - 1), y: util.clamp(Math.floor(y), 0, N - 1) });

      function check() {
        const dx = Math.sign(sel.x1 - sel.x0);
        const dy = Math.sign(sel.y1 - sel.y0);
        const len = Math.max(Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)) + 1;
        let str = '';
        for (let k = 0; k < len; k++) str += puzzle.grid[sel.y0 + dy * k][sel.x0 + dx * k];
        const rev = str.split('').reverse().join('');
        const word = puzzle.words.find(w => (w === str || w === rev) && !puzzle.found.some(f => f.word === w));
        if (!word) return;
        puzzle.found.push({ word, ...sel });
        if (puzzle.found.length === puzzle.words.length) {
          g.score++;
          nextIn = 1.5;
        }
      }

      g.update = dt => {
        if (nextIn > 0) {
          nextIn -= dt;
          if (nextIn <= 0) build();
        }
      };
      g.pointer = (type, x, y) => {
        if (nextIn > 0) return;
        if (type === 'down') {
          if (x < 0 || y < 0 || x >= N || y >= N) return;
          const c = cellAt(x, y);
          sel = { x0: c.x, y0: c.y, x1: c.x, y1: c.y };
        } else if (type === 'move' && sel) {
          const c = cellAt(x, y);
          const dx = c.x - sel.x0;
          const dy = c.y - sel.y0;
          if (!dx || !dy || Math.abs(dx) === Math.abs(dy)) {
            sel.x1 = c.x;
            sel.y1 = c.y;
          }
        } else if (type === 'up' && sel) {
          check();
          sel = null;
        }
      };
      g.draw = r => {
        for (const f of puzzle.found) r.line(f.x0 + 0.5, f.y0 + 0.5, f.x1 + 0.5, f.y1 + 0.5, 0.75, 'both', WHITE, 0.2);
        if (sel) r.line(sel.x0 + 0.5, sel.y0 + 0.5, sel.x1 + 0.5, sel.y1 + 0.5, 0.75, 'both', WHITE, 0.35);
        puzzle.grid.forEach((row, y) => row.forEach((ch, x) => {
          r.text(ch, x + 0.5, y + 0.54, 0.6, (x + y) % 2 ? 'amb' : 'fellow', WHITE);
        }));
        puzzle.words.forEach((w, i) => {
          const done = puzzle.found.some(f => f.word === w);
          const x = i % 2 ? N * 0.75 : N * 0.25;
          const y = N + 0.4 + Math.floor(i / 2) * rowH + rowH / 2;
          r.text(w, x, y, size, 'both', WHITE, done ? 0.25 : 0.85);
          if (done) r.line(x - w.length * size * 0.36, y, x + w.length * size * 0.36, y, 0.05, 'both', WHITE, 0.5);
        });
      };
      g.hud = () => [puzzle.theme, `Found ${puzzle.found.length}/${puzzle.words.length}`, `Puzzles ${g.score}`];
      return g;
    },
  });

  DG.register({
    id: 'wordguess',
    name: 'Word Guess',
    category: 'Words',
    description: 'Guess the hidden five-letter word in six tries.',
    help: 'Type a five-letter word and press ENTER. A solid square means the right letter in the right place; an outline means the letter is in the word but somewhere else. Your weaker eye sees the letters; your stronger eye sees the clues.',
    width: 10,
    height: 12.3,
    buttons: [],
    create(api) {
      const LEN = 5;
      const TRIES = 6;
      const CELL = 1.2;
      const STEP = 1.3;
      const X0 = (10 - (LEN * STEP - 0.1)) / 2;
      const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
      const keys = [];
      ROWS[0].split('').forEach((k, i) => keys.push({ k, x: i, y: 8.3, w: 1 }));
      ROWS[1].split('').forEach((k, i) => keys.push({ k, x: 0.5 + i, y: 9.65, w: 1 }));
      keys.push({ k: 'ENTER', x: 0, y: 11, w: 1.5 });
      ROWS[2].split('').forEach((k, i) => keys.push({ k, x: 1.5 + i, y: 11, w: 1 }));
      keys.push({ k: 'DEL', x: 8.5, y: 11, w: 1.5 });

      const g = { score: 0 };
      let answer;
      let guesses;
      let typed;
      let letters;
      let message;
      let nextIn;

      function newRound() {
        answer = util.pick(FIVE);
        guesses = [];
        typed = '';
        letters = {};
        message = '';
        nextIn = 0;
      }
      newRound();

      function mark(word) {
        const res = Array(LEN).fill(0);
        const counts = {};
        for (let i = 0; i < LEN; i++) {
          if (word[i] === answer[i]) res[i] = 2;
          else counts[answer[i]] = (counts[answer[i]] || 0) + 1;
        }
        for (let i = 0; i < LEN; i++) {
          if (!res[i] && counts[word[i]]) {
            res[i] = 1;
            counts[word[i]]--;
          }
        }
        return res;
      }

      function submit() {
        if (typed.length < LEN) {
          message = 'Not enough letters';
          return;
        }
        const marks = mark(typed);
        guesses.push({ word: typed, marks });
        typed.split('').forEach((ch, i) => { letters[ch] = Math.max(letters[ch] ?? 0, marks[i]); });
        typed = '';
        if (marks.every(v => v === 2)) {
          g.score++;
          message = 'Correct!';
          nextIn = 2.5;
        } else if (guesses.length === TRIES) {
          message = `The word was ${answer}`;
          nextIn = 3.5;
        } else {
          message = '';
        }
      }

      function press(k) {
        if (nextIn > 0) return;
        if (k === 'ENTER') submit();
        else if (k === 'DEL') typed = typed.slice(0, -1);
        else if (typed.length < LEN) typed += k;
      }

      g.update = dt => {
        if (nextIn > 0) {
          nextIn -= dt;
          if (nextIn <= 0) newRound();
        }
      };
      g.key = k => {
        if (/^[a-z]$/i.test(k)) press(k.toUpperCase());
        else if (k === 'Enter') press('ENTER');
        else if (k === 'Backspace') press('DEL');
        else return false;
        return true;
      };
      g.pointer = (type, x, y) => {
        if (type !== 'down') return;
        const hit = keys.find(key => x >= key.x && x < key.x + key.w && y >= key.y && y < key.y + 1.2);
        if (hit) press(hit.k);
      };
      g.draw = r => {
        for (let row = 0; row < TRIES; row++) {
          const guess = guesses[row];
          for (let c = 0; c < LEN; c++) {
            const x = X0 + c * STEP;
            const y = row * STEP;
            let ch = '';
            if (guess) {
              ch = guess.word[c];
              if (guess.marks[c] === 2) r.rect(x, y, CELL, CELL, 'fellow', [60, 200, 90], 0.6);
              else if (guess.marks[c] === 1) r.box(x + 0.08, y + 0.08, CELL - 0.16, CELL - 0.16, 0.14, 'fellow', [230, 200, 40]);
            } else {
              r.box(x, y, CELL, CELL, 0.04, 'both', WHITE, 0.25);
              if (row === guesses.length) ch = typed[c] || '';
            }
            if (ch) r.text(ch, x + CELL / 2, y + CELL / 2 + 0.04, 0.7, 'amb', WHITE);
          }
        }
        for (const key of keys) {
          const state = letters[key.k];
          r.rect(key.x + 0.05, key.y, key.w - 0.1, 1.2, 'both', WHITE, 0.1);
          if (state === 2) r.rect(key.x + 0.05, key.y, key.w - 0.1, 1.2, 'fellow', [60, 200, 90], 0.6);
          else if (state === 1) r.box(key.x + 0.12, key.y + 0.07, key.w - 0.24, 1.06, 0.1, 'fellow', [230, 200, 40]);
          r.text(key.k, key.x + key.w / 2, key.y + 0.62, key.k.length > 1 ? 0.3 : 0.5, 'amb', WHITE, state === 0 ? 0.3 : 1);
        }
      };
      g.hud = () => [message || `Guess ${Math.min(guesses.length + 1, TRIES)}/${TRIES}`, `Solved ${g.score}`];
      return g;
    },
  });
})();
