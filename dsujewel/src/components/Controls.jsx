export default function Controls({ onHint, onNewGame }) {
  return (
    <div className="controls">
      <button type="button" onClick={onHint}>💡 힌트</button>
      <button type="button" className="primary" onClick={onNewGame}>새 게임</button>
    </div>
  );
}
