import { N } from './constants.js';

// 게임 상태를 캔버스에 그림 (PRD 6~7장)
export function drawGame(ctx, game, { S, dpr, time, images }) {
  if (!images.length) return;
  const W = N * S;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 바탕 체크무늬
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, W);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#0c0c16' : '#11111d';
      ctx.fillRect(c * S, r * S, S, S);
    }
  }

  const cellOutline = (cell, color, lw) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(cell.c * S + 3, cell.r * S + 3, S - 6, S - 6, S * 0.18);
    ctx.stroke();
  };

  // 선택 표시
  const sel = game.selected;
  if (sel) {
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.roundRect(sel.c * S + 3, sel.r * S + 3, S - 6, S - 6, S * 0.18);
    ctx.fill();
    cellOutline(sel, 'rgba(255,255,255,.8)', 2);
  }

  // 힌트
  if (game.hint && game.state === 'idle') {
    const a = 0.4 + 0.4 * Math.sin(time / 180);
    game.hint.forEach(h => cellOutline(h, `rgba(255,220,80,${a})`, 3));
  }

  const drawGem = (t, x, y, s) => {
    const sz = S * s;
    ctx.drawImage(images[t], x * S + (S - sz) / 2, y * S + (S - sz) / 2, sz, sz);
  };

  // 보석과 아이템 표시
  const pulse = 0.5 + 0.5 * Math.sin(time / 160);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const g = game.board[r][c];
      if (!g) continue;
      let s = 1;
      if (sel && sel.r === r && sel.c === c) s = 1.06 + 0.04 * Math.sin(time / 120);
      if (g.pop) s *= 1 + 0.45 * Math.sin(g.pop * Math.PI);
      const px = (g.x + 0.5) * S, py = (g.y + 0.5) * S;

      if (g.sp === 'bomb' || g.sp === 'rainbow') {
        const halo = ctx.createRadialGradient(px, py, S * 0.15, px, py, S * 0.55);
        halo.addColorStop(0, g.sp === 'bomb' ? `rgba(255,150,40,${0.5 + 0.3 * pulse})` : `rgba(255,255,255,${0.4 + 0.3 * pulse})`);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(px - S * 0.6, py - S * 0.6, S * 1.2, S * 1.2);
      }

      drawGem(g.t, g.x, g.y, s);

      if (g.sp === 'row' || g.sp === 'col') {
        ctx.save();
        ctx.translate(px, py);
        if (g.sp === 'col') ctx.rotate(Math.PI / 2);
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = S * 0.2;
        ctx.fillStyle = `rgba(255,255,255,${0.7 + 0.3 * pulse})`;
        ctx.fillRect(-S * 0.32, -S * 0.13, S * 0.64, S * 0.07);
        ctx.fillRect(-S * 0.32, S * 0.06, S * 0.64, S * 0.07);
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(d * S * 0.47, 0);
          ctx.lineTo(d * S * 0.34, -S * 0.1);
          ctx.lineTo(d * S * 0.34, S * 0.1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (g.sp === 'bomb') {
        ctx.save();
        ctx.strokeStyle = `rgba(255,210,90,${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ff9a2a';
        ctx.shadowBlur = S * 0.25;
        ctx.beginPath();
        ctx.roundRect(px - S * 0.44, py - S * 0.44, S * 0.88, S * 0.88, S * 0.2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // 사라지는 보석
  game.dying.forEach(d => {
    ctx.globalAlpha = Math.max(0, d.s);
    drawGem(d.t, d.x, d.y, 1 + (1 - d.s) * 0.4);
  });
  ctx.globalAlpha = 1;

  // 아이템 발동 이펙트
  ctx.globalCompositeOperation = 'lighter';
  game.beams.forEach(b => {
    ctx.globalAlpha = b.life;
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = S * 0.5;
    const th = S * (0.25 + 0.5 * b.life);
    if (b.sp === 'row') ctx.fillRect(0, (b.r + 0.5) * S - th / 2, W, th);
    else if (b.sp === 'col') ctx.fillRect((b.c + 0.5) * S - th / 2, 0, th, W);
    else if (b.sp === 'bomb') ctx.fillRect((b.c - 1) * S, (b.r - 1) * S, S * 3, S * 3);
    else {
      ctx.globalAlpha = b.life * 0.45;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, W);
    }
  });
  ctx.shadowBlur = 0;

  // 파티클
  game.particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * S, p.y * S, S * 0.06 * p.life + 1, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // 떠오르는 글자
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  game.floats.forEach(f => {
    ctx.font = `800 ${Math.round(S * (f.size || 0.42))}px -apple-system, sans-serif`;
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeText(f.text, f.x * S, f.y * S);
    ctx.fillStyle = f.color || '#ffe066';
    ctx.fillText(f.text, f.x * S, f.y * S);
  });
  ctx.globalAlpha = 1;
}
