export default function GameOverOverlay({ score, isRecord, onRestart }) {
  return (
    <div className="overlay" role="dialog" aria-label="게임 종료">
      <h2>게임 종료!</h2>
      <p>
        최종 점수: {score}점{isRecord && ' 🏆 신기록!'}
      </p>
      <button type="button" className="primary" onClick={onRestart}>다시 하기</button>
    </div>
  );
}
