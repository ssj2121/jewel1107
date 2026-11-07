import { GEMS } from './constants.js';

// 보석 이미지를 오프스크린 캔버스에 미리 그림 (PRD 4.2)

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (hex, to, t) => {
  const a = hex2rgb(hex);
  return `rgb(${a.map((v, i) => Math.round(v + (to[i] - v) * t)).join(',')})`;
};
const shade = (hex, d) => (d >= 0 ? mix(hex, [255, 255, 255], d) : mix(hex, [0, 0, 0], -d));

function renderGem(def, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const R = size * 0.44, cx = size / 2, cy = size / 2;
  const outer = def.pts.map(([x, y]) => [cx + x * R, cy + y * R]);
  const mx = outer.reduce((s, p) => s + p[0], 0) / outer.length;
  const my = outer.reduce((s, p) => s + p[1], 0) / outer.length;
  const inner = outer.map(([x, y]) => [mx + (x - mx) * def.inner, my + (y - my) * def.inner]);
  const light = [-0.6, -0.8];
  const path = pts => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };

  // 그림자
  g.save();
  g.translate(0, size * 0.03);
  path(outer);
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fill();
  g.restore();

  // 옆면: 빛 방향에 따라 밝기 조절
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const ex = (outer[i][0] + outer[j][0]) / 2 - mx, ey = (outer[i][1] + outer[j][1]) / 2 - my;
    const len = Math.hypot(ex, ey) || 1;
    const d = (ex / len) * light[0] + (ey / len) * light[1];
    path([outer[i], outer[j], inner[j], inner[i]]);
    g.fillStyle = shade(def.color, d * 0.5);
    g.fill();
  }

  // 윗면
  path(inner);
  const grd = g.createLinearGradient(inner[0][0] - R, my - R * 0.5, mx + R * 0.5, my + R * 0.5);
  grd.addColorStop(0, shade(def.color, 0.35));
  grd.addColorStop(1, shade(def.color, -0.05));
  g.fillStyle = grd;
  g.fill();

  // 면 경계선
  g.strokeStyle = 'rgba(255,255,255,.25)';
  g.lineWidth = Math.max(1, size * 0.01);
  for (let i = 0; i < outer.length; i++) {
    g.beginPath();
    g.moveTo(...outer[i]);
    g.lineTo(...inner[i]);
    g.stroke();
  }
  path(inner);
  g.stroke();

  // 외곽선
  path(outer);
  g.lineJoin = 'round';
  g.strokeStyle = shade(def.color, -0.65);
  g.lineWidth = size * 0.035;
  g.stroke();

  // 반짝임
  g.save();
  path(inner);
  g.clip();
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath();
  g.ellipse(mx - R * 0.18, my - R * 0.2, R * 0.16, R * 0.08, -0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath();
  g.arc(outer[0][0] * 0.2 + mx * 0.8 - R * 0.25, my - R * 0.45, size * 0.018, 0, Math.PI * 2);
  g.fill();
  return canvas;
}

// 무지개 보석 (같은 보석 모두 없애기 아이템)
function renderRainbow(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const m = size / 2, R = size * 0.38;

  g.beginPath();
  g.arc(m, m + size * 0.03, R, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fill();

  const cg = g.createConicGradient(0, m, m);
  const colors = ['#ff3b3b', '#ffb020', '#ffe94d', '#3ddc5a', '#3d8bff', '#b44dff', '#ff3b3b'];
  colors.forEach((col, i) => cg.addColorStop(i / (colors.length - 1), col));
  g.beginPath();
  g.arc(m, m, R, 0, Math.PI * 2);
  g.fillStyle = cg;
  g.fill();

  const rg = g.createRadialGradient(m - R * 0.3, m - R * 0.3, R * 0.1, m, m, R);
  rg.addColorStop(0, 'rgba(255,255,255,.85)');
  rg.addColorStop(0.5, 'rgba(255,255,255,.1)');
  rg.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = rg;
  g.fill();
  g.lineWidth = size * 0.035;
  g.strokeStyle = '#1a1030';
  g.stroke();

  // 가운데 별
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.2 : R * 0.45;
    g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = size * 0.1;
  g.fill();
  return canvas;
}

// 일반 보석 6종 + 무지개(인덱스 6)
export function createGemImages(sizePx) {
  return [...GEMS.map(d => renderGem(d, sizePx)), renderRainbow(sizePx)];
}
