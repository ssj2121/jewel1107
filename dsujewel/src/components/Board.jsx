import { useEffect, useRef } from 'react';
import { N, MAX_BOARD_PX, MIN_CELL_PX, DRAG_THRESHOLD } from '../game/constants.js';
import { createGemImages } from '../game/gems.js';
import { drawGame } from '../game/renderer.js';

// 캔버스 게임판: 크기 조절, 애니메이션 루프, 마우스/터치 입력 (PRD 4.3, 6장)
export default function Board({ game, children }) {
  const containerRef = useRef(null);
  const boardRef = useRef(null);
  const canvasRef = useRef(null);
  const viewRef = useRef({ S: 0, dpr: 1, images: [] });
  const dragRef = useRef(null);

  // 화면 폭에 맞춰 칸 크기 계산, 보석 이미지 다시 그리기
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const avail = Math.min(container.clientWidth || window.innerWidth - 32, MAX_BOARD_PX);
      const S = Math.max(MIN_CELL_PX, Math.floor(avail / N));
      if (S === viewRef.current.S && dpr === viewRef.current.dpr) return;
      const px = N * S;
      boardRef.current.style.width = `${px}px`;
      canvas.style.width = canvas.style.height = `${px}px`;
      canvas.width = canvas.height = Math.round(px * dpr);
      viewRef.current = { S, dpr, images: createGemImages(Math.round(S * dpr)) };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // 애니메이션 루프
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let last = performance.now();
    let id;
    const loop = t => {
      const dt = Math.min(t - last, 50);
      last = t;
      game.update(dt);
      drawGame(ctx, game, { ...viewRef.current, time: t });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [game]);

  const toCellPos = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const { S } = viewRef.current;
    const x = (e.clientX - rect.left) / S, y = (e.clientY - rect.top) / S;
    return { r: Math.floor(y), c: Math.floor(x), x, y };
  };

  const onPointerDown = e => {
    if (!game.canInput()) return;
    const p = toCellPos(e);
    if (p.r < 0 || p.r >= N || p.c < 0 || p.c >= N) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { ...p, moved: false };
  };

  const onPointerMove = e => {
    const d = dragRef.current;
    if (!d || d.moved) return;
    const p = toCellPos(e);
    const dx = p.x - d.x, dy = p.y - d.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const to = Math.abs(dx) > Math.abs(dy) ? { r: d.r, c: d.c + Math.sign(dx) } : { r: d.r + Math.sign(dy), c: d.c };
    game.trySwap({ r: d.r, c: d.c }, to);
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) game.tap({ r: d.r, c: d.c });
  };

  return (
    <div ref={containerRef} className="board-area">
      <div ref={boardRef} className="board">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
        />
        {children}
      </div>
    </div>
  );
}
