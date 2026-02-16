import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = "https://poker-backend-ijjj.onrender.com/api"; 

function App() {
  const [currentScreen, setCurrentScreen] = useState('TITLE');
  const [gameState, setGameState] = useState(null);
  const [raiseAmount, setRaiseAmount] = useState(50);
  const [logs, setLogs] = useState(["ゲームを開始してください"]);
  
  // ★追加：プレイヤーの名前を管理するステート
  const [playerName, setPlayerName] = useState("あなた");
  
  const logEndRef = useRef(null);

  const playSound = (fileName) => {
    const audio = new Audio(`/${fileName}`);
    audio.play().catch(e => console.log("音声再生ブロック:", e));
  };

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

  useEffect(() => {
    if (gameState && gameState.phase === "SHOWDOWN") {
      const p2 = gameState.players.find(p => p.id === "p2");
      if (p2 && p2.stack === 0) {
        playSound("win.mp3");
      }
    }
  }, [gameState]);

  const startGame = async () => {
    playSound("deal.mp3");
    try {
      // ★修正：プレイヤー名をAPIに送信する
      const response = await fetch(`${API_URL}/start`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_name: playerName || "あなた" })
      });
      const data = await response.json();
      setGameState(data.game_state);
      appendLog(data.game_state.message, true);
      setCurrentScreen('GAME');
    } catch (error) {
      alert("サーバーに接続できません。");
    }
  };

  const backToTitle = () => {
    setGameState(null);
    setLogs(["ゲームを開始してください"]);
    setCurrentScreen('TITLE');
  };

  const takeAction = async (actionType, amount = 0) => {
    if (actionType !== 'fold') {
      playSound("chip.mp3");
    }
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
      // ★修正：リセット時にもプレイヤー名を送信する
      const response = await fetch(`${API_URL}/reset`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_name: playerName || "あなた" })
      });
      const data = await response.json();
      setGameState(data.game_state);
      appendLog("【リセット】チップが初期化されました", true);
    } catch (error) {
      alert("通信エラーが発生しました。");
    }
  };

  if (currentScreen === 'TITLE') {
    return (
      <div className="title-screen">
        <h1 className="game-title">♠ TEXAS HOLD'EM ♠</h1>
        <div className="game-subtitle">Webブラウザ版 ポーカー</div>
        
        {/* ★追加：名前入力用のボックス */}
        <div className="name-input-box">
          <input 
            type="text" 
            value={playerName} 
            onChange={e => setPlayerName(e.target.value)} 
            placeholder="プレイヤー名を入力" 
            maxLength="10"
          />
        </div>

        <div className="menu-buttons">
          <button className="btn-menu" onClick={startGame}>2人対戦 (vs CPU)</button>
          <button className="btn-menu" disabled>複数人対戦 (準備中...)</button>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

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

      <div className="game-header">
        <button className="btn-back-title" onClick={backToTitle}>◀ タイトルに戻る</button>
        <button className="btn-start" onClick={startGame} style={{ marginBottom: 0 }}>♠ 新しいハンドを配る ♠</button>
        <div style={{ width: "130px" }}></div>
      </div>

      <div id="game-message">{gameState.message}</div>

      <div className="game-container">
        <div className="table">
          <div className="area">
            <div className="info-tag">
              {/* CPUにディーラーボタンがある場合に「Ⓓ」を表示 */}
              {gameState.dealer_button === "p2" && <span style={{color: "#ffeb3b", marginRight: "8px", fontWeight: "bold"}}>Ⓓ</span>}
              CPU | チップ: {p2.stack} | ベット: {p2.current_bet}
            </div>
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
            
            {gameState.p1_current_hand && (
              <div className="hand-indicator">
                現在の役：{gameState.p1_current_hand}
              </div>
            )}
            
            <div className="info-tag">
              {/* あなたにディーラーボタンがある場合に「Ⓓ」を表示 */}
              {gameState.dealer_button === "p1" && <span style={{color: "#ffeb3b", marginRight: "8px", fontWeight: "bold"}}>Ⓓ</span>}
              {p1.name} | チップ: {p1.stack} | ベット: {p1.current_bet}
            </div>         
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