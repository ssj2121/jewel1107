import {
  N, T, RAINBOW, MOVES, ITEMS, ITEM_NAMES, ITEM_COMBO_THRESHOLD,
  REFILL_BIAS, TIMING, gemColor,
} from './constants.js';

// 화면(React, Canvas)과 분리된 게임 규칙과 상태.
// React는 subscribe/getSnapshot 으로 점수·이동·종료 여부만 구독함.

const inBounds = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
const toCell = k => ({ r: Math.floor(k / N), c: k % N });

export class JewelGame {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.listeners = new Set();
    this.snapshot = null;
    this.newGame();
  }

  // ---------- 외부 구독 (useSyncExternalStore) ----------
  subscribe = fn => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  emit() {
    const next = { score: this.score, moves: this.moves, over: this.state === 'over' };
    const prev = this.snapshot;
    if (prev && prev.score === next.score && prev.moves === next.moves && prev.over === next.over) return;
    this.snapshot = next;
    this.listeners.forEach(fn => fn());
  }

  // ---------- 판 도우미 ----------
  randType() {
    return Math.floor(this.rng() * T);
  }

  newGem(t, r, c) {
    return { t, x: c, y: r, v: 0 };
  }

  typeAt(r, c) {
    return inBounds(r, c) && this.board[r][c] ? this.board[r][c].t : -1;
  }

  makesMatch(r, c) {
    const t = this.typeAt(r, c);
    if (t < 0) return false;
    let h = 1, v = 1;
    for (let k = c - 1; this.typeAt(r, k) === t; k--) h++;
    for (let k = c + 1; this.typeAt(r, k) === t; k++) h++;
    for (let k = r - 1; this.typeAt(k, c) === t; k--) v++;
    for (let k = r + 1; this.typeAt(k, c) === t; k++) v++;
    return h >= 3 || v >= 3;
  }

  findMatches() {
    const set = new Set();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N;) {
        const t = this.typeAt(r, c);
        let e = c + 1;
        while (e < N && this.typeAt(r, e) === t) e++;
        if (t >= 0 && t !== RAINBOW && e - c >= 3) for (let k = c; k < e; k++) set.add(r * N + k);
        c = e;
      }
    }
    for (let c = 0; c < N; c++) {
      for (let r = 0; r < N;) {
        const t = this.typeAt(r, c);
        let e = r + 1;
        while (e < N && this.typeAt(e, c) === t) e++;
        if (t >= 0 && t !== RAINBOW && e - r >= 3) for (let k = r; k < e; k++) set.add(k * N + c);
        r = e;
      }
    }
    return set;
  }

  swapCells(a, b) {
    const tmp = this.board[a.r][a.c];
    this.board[a.r][a.c] = this.board[b.r][b.c];
    this.board[b.r][b.c] = tmp;
  }

  findMove() {
    // 무지개 보석은 아무 이웃과 바꿔도 발동
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (this.board[r][c]?.sp === 'rainbow') return [{ r, c }, c + 1 < N ? { r, c: c + 1 } : { r, c: c - 1 }];
      }
    }
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const a = { r, c }, b = { r: r + dr, c: c + dc };
          if (!inBounds(b.r, b.c)) continue;
          this.swapCells(a, b);
          const ok = this.makesMatch(a.r, a.c) || this.makesMatch(b.r, b.c);
          this.swapCells(a, b);
          if (ok) return [a, b];
        }
      }
    }
    return null;
  }

  fillNoMatches() {
    do {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          let t;
          do {
            t = this.randType();
          } while (
            (c >= 2 && this.board[r][c - 1].t === t && this.board[r][c - 2].t === t) ||
            (r >= 2 && this.board[r - 1][c].t === t && this.board[r - 2][c].t === t)
          );
          this.board[r][c] = this.newGem(t, r, c);
        }
      }
    } while (!this.findMove());
  }

  // ---------- 게임 진행 ----------
  newGame({ dropIn = true } = {}) {
    this.board = Array.from({ length: N }, () => Array(N).fill(null));
    this.fillNoMatches();
    if (dropIn) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) this.board[r][c].y = r - N - 1 - c * 0.15;
    }
    this.score = 0;
    this.moves = MOVES;
    this.combo = 0;
    this.state = dropIn ? 'fall' : 'idle';
    this.selected = null;
    this.hint = null;
    this.idleTime = 0;
    this.lastSwap = null;
    this.dying = [];
    this.particles = [];
    this.floats = [];
    this.beams = [];
    this.emit();
  }

  canInput() {
    return this.state === 'idle' && this.moves > 0;
  }

  // 클릭/탭: 선택 → 이웃 클릭 시 바꾸기
  tap(cell) {
    if (!this.canInput() || !inBounds(cell.r, cell.c)) return;
    const s = this.selected;
    if (s && s.r === cell.r && s.c === cell.c) this.selected = null;
    else if (s && adjacent(s, cell)) this.trySwap(s, cell);
    else this.selected = cell;
  }

  trySwap(a, b) {
    if (!this.canInput() || !inBounds(a.r, a.c) || !inBounds(b.r, b.c) || !adjacent(a, b)) return false;
    this.selected = null;
    this.hint = null;
    this.idleTime = 0;
    this.swapCells(a, b);
    this.board[a.r][a.c].v = this.board[b.r][b.c].v = TIMING.swapSpeed;
    this.state = 'swap';
    this.lastSwap = [a, b];
    return true;
  }

  requestHint() {
    if (this.state === 'idle') this.hint = this.findMove();
  }

  shuffle() {
    const gems = this.board.flat();
    do {
      for (let i = gems.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [gems[i], gems[j]] = [gems[j], gems[i]];
      }
      gems.forEach((g, i) => (this.board[Math.floor(i / N)][i % N] = g));
    } while (this.findMatches().size || !this.findMove());
    this.floats.push({ x: N / 2, y: N / 2, text: '섞는 중!', life: 1 });
    this.state = 'fall';
  }

  // 아이템이 지우는 칸 목록 (PRD 5.2)
  itemCells(g, r, c) {
    const out = [];
    if (g.sp === 'row') {
      for (let k = 0; k < N; k++) out.push(r * N + k);
    } else if (g.sp === 'col') {
      for (let k = 0; k < N; k++) out.push(k * N + c);
    } else if (g.sp === 'bomb') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) if (inBounds(r + dr, c + dc)) out.push((r + dr) * N + c + dc);
      }
    } else if (g.sp === 'rainbow') {
      let t = g.target;
      if (t == null) {
        // 다른 아이템에 휘말리면 판에 있는 색 중 하나를 무작위로
        const pool = this.board.flat().filter(x => x && x.t < T);
        t = pool.length ? pool[Math.floor(this.rng() * pool.length)].t : 0;
      }
      for (let rr = 0; rr < N; rr++) {
        for (let cc = 0; cc < N; cc++) if (this.board[rr][cc]?.t === t) out.push(rr * N + cc);
      }
    }
    return out;
  }

  clearMatches(set) {
    this.combo++;

    // 지워지는 칸의 아이템 발동 (연쇄 포함)
    const queue = [...set];
    while (queue.length) {
      const k = queue.pop();
      const { r, c } = toCell(k);
      const g = this.board[r][c];
      if (!g || !g.sp || g.fired) continue;
      g.fired = true;
      this.beams.push({ sp: g.sp, r, c, life: 1, color: gemColor(g.t) });
      for (const k2 of this.itemCells(g, r, c)) {
        if (!set.has(k2)) {
          set.add(k2);
          queue.push(k2);
        }
      }
    }

    // 콤보 3단계 이상: 지워질 일반 보석 하나를 아이템으로 바꿔 남김
    let item = null;
    if (this.combo >= ITEM_COMBO_THRESHOLD) {
      const cand = [...set].filter(k => {
        const { r, c } = toCell(k);
        return this.board[r][c] && !this.board[r][c].sp;
      });
      if (cand.length) {
        const k = cand[Math.floor(this.rng() * cand.length)];
        set.delete(k);
        const { r, c } = toCell(k);
        const g = this.board[r][c];
        g.sp = ITEMS[Math.floor(this.rng() * ITEMS.length)];
        if (g.sp === 'rainbow') g.t = RAINBOW;
        g.pop = 1;
        item = { sp: g.sp, y: r + 0.5 };
      }
    }

    // 점수 (PRD 4.6)
    const n = set.size + (item ? 1 : 0);
    const gained = n * 10 * this.combo + Math.max(0, n - 3) * 20;
    this.score += gained;

    let sx = 0, sy = 0;
    set.forEach(k => {
      const { r, c } = toCell(k);
      const g = this.board[r][c];
      sx += c;
      sy += r;
      this.dying.push({ t: g.t, x: g.x, y: g.y, s: 1 });
      for (let i = 0; i < 8; i++) {
        const a = this.rng() * Math.PI * 2, sp = 0.002 + this.rng() * 0.006;
        this.particles.push({ x: c + 0.5, y: r + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color: gemColor(g.t) });
      }
      this.board[r][c] = null;
    });

    const cnt = Math.max(1, set.size);
    this.floats.push({
      x: sx / cnt + 0.5,
      y: sy / cnt + 0.5,
      text: (this.combo > 1 ? `콤보 x${this.combo}  ` : '') + `+${gained}`,
      life: 1,
    });
    if (item) {
      this.floats.push({
        x: N / 2, y: Math.min(N - 1, Math.max(1, item.y)),
        text: `✨ ${ITEM_NAMES[item.sp]}!`, life: 1.4, color: '#7ff3ff', size: 0.32,
      });
    }
    this.state = 'clear';
  }

  collapse() {
    for (let c = 0; c < N; c++) {
      let w = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        if (this.board[r][c]) {
          if (r !== w) {
            this.board[w][c] = this.board[r][c];
            this.board[r][c] = null;
          }
          w--;
        }
      }
      const empty = w + 1;
      for (let r = w; r >= 0; r--) {
        // 콤보 보정: 아래/왼쪽 보석 색을 따라갈 확률을 높임
        let t = this.randType();
        const below = this.board[r + 1]?.[c];
        const left = c > 0 ? this.board[r][c - 1] : null;
        const p = this.rng();
        if (p < REFILL_BIAS.below && below && below.t < T) t = below.t;
        else if (p < REFILL_BIAS.below + REFILL_BIAS.left && left && left.t < T) t = left.t;
        this.board[r][c] = this.newGem(t, r - empty - 0.3, c);
      }
    }
  }

  settled() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const g = this.board[r][c];
        if (g && (g.x !== c || g.y !== r)) return false;
      }
    }
    return true;
  }

  update(dt) {
    // 보석 이동
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const g = this.board[r][c];
        if (!g) continue;
        if (g.pop) g.pop = Math.max(0, g.pop - dt / TIMING.popMs);
        const dx = c - g.x, dy = r - g.y, dist = Math.hypot(dx, dy);
        if (dist === 0) {
          g.v = 0;
          continue;
        }
        g.v = Math.min(g.v + TIMING.accel * dt, TIMING.maxSpeed);
        const step = g.v * dt;
        if (step >= dist) {
          g.x = c;
          g.y = r;
          g.v = 0;
        } else {
          g.x += (dx / dist) * step;
          g.y += (dy / dist) * step;
        }
      }
    }

    // 연출 수명
    this.dying.forEach(d => (d.s -= dt / TIMING.clearMs));
    this.dying = this.dying.filter(d => d.s > 0);
    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.00002 * dt;
      p.life -= dt / TIMING.particleMs;
    });
    this.particles = this.particles.filter(p => p.life > 0);
    this.floats.forEach(f => {
      f.y -= dt * 0.0008;
      f.life -= dt / TIMING.floatMs;
    });
    this.floats = this.floats.filter(f => f.life > 0);
    this.beams.forEach(b => (b.life -= dt / TIMING.beamMs));
    this.beams = this.beams.filter(b => b.life > 0);

    // 상태 전환 (PRD 8장 상태 흐름)
    if (this.state === 'swap' && this.settled()) {
      this.afterSwap();
    } else if (this.state === 'swapback' && this.settled()) {
      this.state = 'idle';
    } else if (this.state === 'clear' && this.dying.length === 0) {
      this.collapse();
      this.state = 'fall';
    } else if (this.state === 'fall' && this.settled()) {
      const m = this.findMatches();
      if (m.size) {
        this.clearMatches(m);
      } else {
        this.combo = 0;
        this.state = 'idle';
        this.idleTime = 0;
        if (this.moves <= 0) this.state = 'over';
        else if (!this.findMove()) this.shuffle();
      }
    }

    if (this.state === 'idle') {
      this.idleTime += dt;
      if (this.idleTime > TIMING.hintIdleMs && !this.hint) this.hint = this.findMove();
    }
    this.emit();
  }

  afterSwap() {
    const [a, b] = this.lastSwap;
    const ga = this.board[a.r][a.c], gb = this.board[b.r][b.c];
    if (ga.sp === 'rainbow' || gb.sp === 'rainbow') {
      // 무지개: 바꾼 보석과 같은 색을 모두 없앰. 무지개끼리는 판 전체
      this.moves--;
      this.combo = 0;
      const set = new Set();
      if (ga.sp === 'rainbow' && gb.sp === 'rainbow') {
        for (let k = 0; k < N * N; k++) set.add(k);
      } else {
        const [rb, cell, other] = ga.sp === 'rainbow' ? [ga, a, gb] : [gb, b, ga];
        rb.target = other.t;
        set.add(cell.r * N + cell.c);
      }
      this.clearMatches(set);
      return;
    }
    const m = this.findMatches();
    if (m.size) {
      this.moves--;
      this.combo = 0;
      this.clearMatches(m);
    } else {
      this.swapCells(a, b);
      this.state = 'swapback';
    }
  }
}
