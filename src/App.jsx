import { useState, useEffect, useRef } from 'react';
import './App.css';

// const API_URL = "http://localhost:8000/api";
// const API_URL = "http://192.168.10.154:8000/api";
const API_URL = "https://poker-backend-ijjj.onrender.com/api";

function App() {
  // --- 1. 状態（State）の定義 ---
  // ★追加：現在の画面を管理するState（'TITLE' または 'GAME'）
  const [currentScreen, setCurrentScreen] = useState('TITLE');
  
  const [gameState, setGameState] = useState(null);
  const [raiseAmount, setRaiseAmount] = useState(50);
  const [logs, setLogs] = useState(["ゲームを開始してください"]);
  const logEndRef = useRef(null);

  const appendLog = (message, isNewHand = false) => {
    const timeStr = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    if (isNewHand) {
      setLogs(prev => [...prev, `--- 新しいハンド ---`, `[${timeStr}] ${message}`]);
    } else {
      setLogs(prev => [...prev, `[${timeStr}] ${message}`]);
    }
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- 3. API通信処理 ---
  const startGame = async () => {
    try {
      const response = await fetch(`${API_URL}/start`, { method: "POST" });
      const data = await response.json();
      setGameState(data.game_state);
      appendLog(data.game_state.message, true);
      // ★追加：ゲームデータの取得に成功したら、ゲーム画面へ遷移する
      setCurrentScreen('GAME');
    } catch (error) {
      alert("サーバーに接続できません。FastAPIを起動してください。");
    }
  };

  // ★追加：タイトル画面に戻る関数
  const backToTitle = () => {
    // 状態を初期化してタイトルへ
    setGameState(null);
    setLogs(["ゲームを開始してください"]);
    setCurrentScreen('TITLE');
  };

  const takeAction = async (actionType, amount = 0) => {
    try {
      const response = await fetch(`${API_URL}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: "p1", action_type: actionType, amount: amount })
      });
      const data = await response.json();
      setGameState(data.game_state);
      appendLog(data.game_state.message);
    } catch (error) {
      console.error("通信エラー", error);
    }
  };

  const resetGame = async () => {
    try {
      const response = await fetch(`${API_URL}/reset`, { method: "POST" });
      const data = await response.json();
      setGameState(data.game_state);
      appendLog("【リセット】チップが初期化されました", true);
    } catch (error) {
      alert("通信エラーが発生しました。");
    }
  };

  // --- 4. 画面の描画（JSX） ---

  // ★追加：タイトル画面のレンダリング
  if (currentScreen === 'TITLE') {
    return (
      <div className="title-screen">
        <h1 className="game-title">♠ TEXAS HOLD'EM ♠</h1>
        <div className="game-subtitle">Webブラウザ版 ポーカー</div>
        
        <div className="menu-buttons">
          <button className="btn-menu" onClick={startGame}>2人対戦 (vs CPU)</button>
          
          {/* 将来のためのボタン（今は押せないように disabled にしておく） */}
          <button className="btn-menu" disabled>
            複数人対戦 (準備中...)
          </button>
        </div>
      </div>
    );
  }

  // --- これ以下はゲーム画面（GAME）のレンダリング ---
  if (!gameState) return null; // データロード中の安全対策

  const p1 = gameState.players.find(p => p.id === "p1");
  const p2 = gameState.players.find(p => p.id === "p2");
  const isMyTurn = gameState.current_turn === "p1" && gameState.phase !== "SHOWDOWN";
  const isGameOver = gameState.phase === "SHOWDOWN" && (p1.stack <= 0 || p2.stack <= 0);

  const callRequired = p2.current_bet - p1.current_bet;
  const maxRaise = Math.max(0, p1.stack - callRequired);

  const submitRaise = () => {
    if (raiseAmount <= 0) return alert("正しい金額を入力してください");
    if (raiseAmount > maxRaise) {
      alert(`所持金が足りません！(最大レイズ可能額: ${maxRaise} チップ)`);
      setRaiseAmount(maxRaise);
      return;
    }
    takeAction('raise', raiseAmount);
  };

  const renderCard = (cardData, index, isBack = false) => {
    if (isBack) return <div key={index} className="card back" style={{ animationDelay: `${index * 0.1}s` }}></div>;
    const isRed = cardData.display.includes("♥") || cardData.display.includes("♦");
    return (
      <div key={index} className={`card ${isRed ? "red" : ""}`} style={{ animationDelay: `${index * 0.1}s` }}>
        {cardData.display}
      </div>
    );
  };

  return (
    <div className="app-container">
      {isGameOver && (
        <div className="game-over-modal">
          <div className="modal-content">
            <h1 style={{ color: p2.stack === 0 ? "#ffeb3b" : "#f44336", fontSize: "48px", margin: "0 0 20px 0" }}>
              {p2.stack === 0 ? "🎉 完全勝利 🎉" : "💀 破産 💀"}
            </h1>
            <p style={{ fontSize: "20px", marginBottom: "30px" }}>
              {p2.stack === 0 ? "素晴らしい！CPUのチップをすべて奪い取りました！" : "チップが尽きました... CPUの勝利です。"}
            </p>
            <button className="btn-reset" onClick={resetGame}>もう一度プレイする</button>
            <div style={{ marginTop: "15px" }}>
              <button className="btn-back-title" onClick={backToTitle}>タイトルに戻る</button>
            </div>
          </div>
        </div>
      )}

      {/* ★追加：ゲーム画面上部のヘッダー領域（戻るボタンと新しいハンドボタン） */}
      <div className="game-header">
        <button className="btn-back-title" onClick={backToTitle}>◀ タイトルに戻る</button>
        <button className="btn-start" onClick={startGame} style={{ marginBottom: 0 }}>♠ 新しいハンドを配る ♠</button>
        <div style={{ width: "130px" }}></div> {/* レイアウト調整用の空箱 */}
      </div>

      <div id="game-message">{gameState.message}</div>

      <div className="game-container">
        <div className="table">
          <div className="area">
            <div className="info-tag">CPU | チップ: {p2.stack} | ベット: {p2.current_bet}</div>
            <div>
              {gameState.phase === "SHOWDOWN" 
                ? p2.hand.map((c, i) => renderCard(c, i))
                : [0, 1].map(i => renderCard(null, i, true))}
            </div>
          </div>

          <div className="area">
            <div id="info-board">{gameState.phase} | ポット: ${gameState.pot}</div>
            <div style={{ minHeight: '90px' }}>
              {gameState.community_cards.map((c, i) => renderCard(c, i))}
            </div>
          </div>

          <div className="area">
            <div style={{ minHeight: '90px' }}>
              {p1.hand.map((c, i) => renderCard(c, i))}
            </div>
            <div className="info-tag">あなた | チップ: {p1.stack} | ベット: {p1.current_bet}</div>
            
            <div className="action-buttons">
              <button className="btn-call" onClick={() => takeAction('call')} disabled={!isMyTurn}>
                {maxRaise <= 0 ? "オールイン (全額コール)" : "コール / チェック"}
              </button>
              <div className="raise-box">
                <input 
                  type="number" 
                  value={raiseAmount} 
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  max={maxRaise}
                  disabled={!isMyTurn || maxRaise <= 0}
                />
                <button className="btn-raise" onClick={submitRaise} disabled={!isMyTurn || maxRaise <= 0}>レイズ</button>
              </div>
              <button className="btn-fold" onClick={() => takeAction('fold')} disabled={!isMyTurn}>フォールド</button>
            </div>
          </div>
        </div>

        <div className="log-panel">
          <h3>📜 アクションログ</h3>
          <div id="game-log">
            {logs.map((log, index) => (
              <div key={index} className="log-entry" dangerouslySetInnerHTML={{ __html: log }}></div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;