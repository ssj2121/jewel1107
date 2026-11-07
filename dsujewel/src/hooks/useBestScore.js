import { useEffect, useState } from 'react';
import { BEST_SCORE_KEY } from '../game/constants.js';

// 최고 점수를 localStorage에 저장. 저장이 막힌 환경에서도 게임은 동작 (PRD 4.9)
function readBest() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function useBestScore(score) {
  const [best, setBest] = useState(readBest);

  useEffect(() => {
    if (score <= best) return;
    setBest(score);
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(score));
    } catch {
      // 저장 실패는 무시
    }
  }, [score, best]);

  return Math.max(best, score);
}
