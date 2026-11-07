// 게임 규칙과 수치 (PRD 4~7장)

export const N = 8; // 판 크기 8×8
export const MOVES = 30; // 한 게임 이동 횟수
export const MAX_BOARD_PX = 520; // 판 최대 폭
export const MIN_CELL_PX = 32; // 한 칸 최소 크기

const poly = (n, rot, sx = 1, sy = 1) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return [Math.cos(a) * sx, Math.sin(a) * sy];
  });

// 보석 6종: 외곽 꼭짓점(반지름 1 기준)과 윗면 비율
export const GEMS = [
  { name: 'red', color: '#e8262f', pts: [[0, -0.98], [0.98, 0], [0, 0.98], [-0.98, 0]], inner: 0.5 },
  { name: 'green', color: '#2cc23a', pts: [[0, -1], [0.98, 0.78], [-0.98, 0.78]], inner: 0.42 },
  { name: 'blue', color: '#2f74ec', pts: [[-0.55, -0.78], [0.55, -0.78], [0.98, -0.28], [0, 0.98], [-0.98, -0.28]], inner: 0.5 },
  { name: 'pink', color: '#e256c2', pts: poly(8, Math.PI / 8, 0.97, 0.97), inner: 0.55 },
  { name: 'yellow', color: '#f7b512', pts: poly(6, 0, 0.98, 0.9), inner: 0.55 },
  { name: 'purple', color: '#a64ff5', pts: poly(10, Math.PI / 10, 0.95, 0.95), inner: 0.55 },
];

export const T = GEMS.length; // 일반 보석 종류 수. 무지개 보석의 타입 값으로도 씀
export const RAINBOW = T;

export const gemColor = t => (t < T ? GEMS[t].color : '#ffffff');

// 아이템 (PRD 5장)
export const ITEMS = ['row', 'col', 'bomb', 'rainbow'];
export const ITEM_NAMES = {
  row: '가로 한줄 깨기',
  col: '세로 한줄 깨기',
  bomb: '3×3 폭탄',
  rainbow: '같은 보석 모두 없애기',
};
export const ITEM_COMBO_THRESHOLD = 3;

// 콤보 보정: 새 보석이 아래/왼쪽 보석 색을 따라갈 확률 (PRD 4.5)
export const REFILL_BIAS = { below: 0.22, left: 0.18 };

// 연출 시간과 속도
export const TIMING = {
  clearMs: 180,
  beamMs: 380,
  popMs: 450,
  particleMs: 600,
  floatMs: 1100,
  hintIdleMs: 6000,
  accel: 0.00008, // 칸/ms²
  maxSpeed: 0.03, // 칸/ms
  swapSpeed: 0.006, // 칸/ms
};

export const DRAG_THRESHOLD = 0.35; // 칸 단위
export const BEST_SCORE_KEY = 'jewel-best';
