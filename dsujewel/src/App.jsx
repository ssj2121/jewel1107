import { useState, useSyncExternalStore } from 'react';
import { JewelGame } from './game/engine.js';
import { useBestScore } from './hooks/useBestScore.js';
import Hud from './components/Hud.jsx';
import Board from './components/Board.jsx';
import Controls from './components/Controls.jsx';
import ItemHelp from './components/ItemHelp.jsx';
import GameOverOverlay from './components/GameOverOverlay.jsx';

export default function App() {
  // 게임 엔진은 앱 전체에서 하나만 사용
  const [game] = useState(() => new JewelGame());
  const { score, moves, over } = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const best = useBestScore(score);
  const newGame = () => game.newGame();

  return (
    <div className="wrap">
      <h1 className="title">💎 보석 맞추기</h1>
      <Hud score={score} moves={moves} best={best} />
      <Board game={game}>
        {over && <GameOverOverlay score={score} isRecord={score > 0 && score >= best} onRestart={newGame} />}
      </Board>
      <Controls onHint={() => game.requestHint()} onNewGame={newGame} />
      <ItemHelp />
    </div>
  );
}
