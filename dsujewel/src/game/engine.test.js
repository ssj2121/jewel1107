import { describe, it, expect } from 'vitest';
import { JewelGame } from './engine.js';
import { N, T, RAINBOW, MOVES, ITEMS } from './constants.js';

// 결과를 재현할 수 있도록 시드 고정 난수
const seeded = (seed = 42) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// 매치가 없는 기본 판: (c + 2r) % 6
const baseTypes = () => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (c + 2 * r) % T));

function setBoard(game, types) {
  game.board = types.map((row, r) =>
    row.map((t, c) => (t === RAINBOW ? { t, sp: 'rainbow', x: c, y: r, v: 0 } : { t, x: c, y: r, v: 0 })),
  );
  game.state = 'idle';
}

function runUntil(game, pred, maxSteps = 5000) {
  for (let i = 0; i < maxSteps && !pred(); i++) game.update(16);
}

const settleIdle = game => runUntil(game, () => game.state === 'idle' || game.state === 'over');
const countType = (game, t) => game.board.flat().filter(g => g && g.t === t).length;

describe('새 게임', () => {
  it('8×8 판에 매치가 없고 둘 수 있는 수가 있다', () => {
    const game = new JewelGame({ rng: seeded(1) });
    expect(game.board).toHaveLength(N);
    expect(game.board.every(row => row.length === N)).toBe(true);
    expect(game.findMatches().size).toBe(0);
    expect(game.findMove()).not.toBeNull();
    expect(game.moves).toBe(MOVES);
    expect(game.score).toBe(0);
  });
});

describe('매치 찾기', () => {
  it('가로·세로 3개 이상을 찾는다', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    types[0][0] = types[0][1] = types[0][2] = 5; // 가로 3
    types[3][7] = types[4][7] = types[5][7] = types[6][7] = 4; // 세로 4
    setBoard(game, types);
    const m = game.findMatches();
    expect([...m].sort((a, b) => a - b)).toEqual([0, 1, 2, 3 * N + 7, 4 * N + 7, 5 * N + 7, 6 * N + 7]);
  });

  it('무지개 보석끼리는 일반 매치가 되지 않는다', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    types[0][0] = types[0][1] = types[0][2] = RAINBOW;
    setBoard(game, types);
    expect(game.findMatches().size).toBe(0);
  });
});

describe('바꾸기', () => {
  it('매치가 안 되면 원래대로 돌아가고 이동이 줄지 않는다', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    setBoard(game, types);
    expect(game.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 })).toBe(true);
    settleIdle(game);
    expect(game.board[0][0].t).toBe(types[0][0]);
    expect(game.board[0][1].t).toBe(types[0][1]);
    expect(game.moves).toBe(MOVES);
    expect(game.score).toBe(0);
  });

  it('이웃이 아닌 칸은 바꾸지 않는다', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    expect(game.trySwap({ r: 0, c: 0 }, { r: 0, c: 2 })).toBe(false);
    expect(game.state).toBe('idle');
  });

  it('매치가 되면 이동이 1 줄고 3개 매치는 최소 30점', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    types[0][0] = 0;
    types[0][1] = 0;
    types[1][2] = 0; // (0,2)와 (1,2)를 바꾸면 첫 줄이 0,0,0
    setBoard(game, types);
    expect(game.findMatches().size).toBe(0);
    game.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
    runUntil(game, () => game.state === 'clear');
    expect(game.moves).toBe(MOVES - 1);
    expect(game.score).toBe(30); // 3 × 10 × 콤보1
    settleIdle(game);
    expect(game.score).toBeGreaterThanOrEqual(30);
  });

  it('클릭으로 선택한 뒤 이웃을 클릭하면 바꾼다', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    game.tap({ r: 2, c: 2 });
    expect(game.selected).toEqual({ r: 2, c: 2 });
    game.tap({ r: 2, c: 2 });
    expect(game.selected).toBeNull();
    game.tap({ r: 2, c: 2 });
    game.tap({ r: 2, c: 3 });
    expect(game.state).toBe('swap');
  });
});

describe('점수 공식', () => {
  it('보석 수 × 10 × 콤보 + 3개 초과분 × 20', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    game.combo = 1; // 이번 지우기가 콤보 2단계
    game.clearMatches(new Set([0, 1, 2, 3])); // 4개
    expect(game.score).toBe(4 * 10 * 2 + 1 * 20);
  });
});

describe('아이템', () => {
  it('가로·세로·폭탄이 지우는 칸 수', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    expect(game.itemCells({ sp: 'row' }, 3, 3)).toHaveLength(N);
    expect(game.itemCells({ sp: 'col' }, 3, 3)).toHaveLength(N);
    expect(game.itemCells({ sp: 'bomb' }, 3, 3)).toHaveLength(9);
    expect(game.itemCells({ sp: 'bomb' }, 0, 0)).toHaveLength(4);
  });

  it('콤보 3단계에서 아이템이 하나 생겨 판에 남는다', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    game.combo = 2;
    game.clearMatches(new Set([0, 1, 2]));
    const items = game.board.flat().filter(g => g && g.sp);
    expect(items).toHaveLength(1);
    expect(ITEMS).toContain(items[0].sp);
  });

  it('콤보 2단계 이하에서는 아이템이 생기지 않는다', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    game.combo = 1;
    game.clearMatches(new Set([0, 1, 2]));
    expect(game.board.flat().filter(g => g && g.sp)).toHaveLength(0);
  });

  it('지워지는 칸의 가로 아이템이 줄 전체를 지운다', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    game.board[4][0].sp = 'row';
    game.combo = 0;
    game.clearMatches(new Set([4 * N]));
    expect(game.board[4].every(g => g === null)).toBe(true);
  });

  it('아이템이 다른 아이템을 연쇄 발동시킨다', () => {
    const game = new JewelGame({ rng: seeded() });
    setBoard(game, baseTypes());
    game.board[4][0].sp = 'row';
    game.board[4][6].sp = 'col'; // 가로줄에 휘말려 세로줄도 발동
    game.combo = 0;
    game.clearMatches(new Set([4 * N]));
    expect(game.board[4].every(g => g === null)).toBe(true);
    expect(game.board.every(row => row[6] === null)).toBe(true);
  });

  it('무지개와 바꾸면 그 색 보석이 모두 사라지고 이동이 1 준다', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    types[0][0] = RAINBOW;
    setBoard(game, types);
    const target = game.board[0][1].t;
    expect(countType(game, target)).toBeGreaterThan(1);
    game.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 });
    runUntil(game, () => game.state === 'clear');
    expect(countType(game, target)).toBe(0);
    expect(game.moves).toBe(MOVES - 1);
  });

  it('무지개끼리 바꾸면 판 전체가 사라진다', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    types[0][0] = RAINBOW;
    types[0][1] = RAINBOW;
    setBoard(game, types);
    game.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 });
    runUntil(game, () => game.state === 'clear');
    expect(game.board.flat().every(g => g === null)).toBe(true);
  });

  it('무지개가 있으면 힌트가 무지개를 먼저 보여준다', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    types[5][5] = RAINBOW;
    setBoard(game, types);
    game.requestHint();
    expect(game.hint[0]).toEqual({ r: 5, c: 5 });
  });
});

describe('게임 종료', () => {
  it('이동을 다 쓰고 연쇄가 끝나면 종료되고 구독자에게 알린다', () => {
    const game = new JewelGame({ rng: seeded() });
    const types = baseTypes();
    types[0][0] = 0;
    types[0][1] = 0;
    types[1][2] = 0;
    setBoard(game, types);
    game.moves = 1;
    let calls = 0;
    game.subscribe(() => calls++);
    game.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
    settleIdle(game);
    expect(game.state).toBe('over');
    expect(game.getSnapshot()).toMatchObject({ moves: 0, over: true });
    expect(calls).toBeGreaterThan(0);
    expect(game.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 })).toBe(false);
  });
});
