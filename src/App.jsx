import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = "https://poker-backend-ijjj.onrender.com/api"; // ★ご自身のURLを確認してください！

function App() {
  const [currentScreen, setCurrentScreen] = useState('TITLE');
  const [gameState, setGameState] = useState(null);
  const [raiseAmount, setRaiseAmount] = useState(50);
  const [logs, setLogs] = useState(["ゲームを開始してください"]);
  const [playerName, setPlayerName] = useState("あなた");
  
  const [isWaiting, setIsWaiting] = useState(false);
  
  // ★追加：ログの表示/非表示を管理するスイッチ
  const [showLogs, setShowLogs] = useState(false);
  
  const logEndRef = useRef(null);

  const playSound = (fileName) => {
    const audio = new Audio(`/${fileName}`);
    audio.play().catch(e => console.log("音声再生ブロック:", e));
  };

  const appendLog = (message, isNewHand = false) => {
    if (!message) return;
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

  useEffect(() => {
    if (gameState && gameState.current_turn === "p2" && gameState.phase !== "SHOWDOWN") {
      const timer = setTimeout(async () => {
        try {
          const response = await fetch(`${API_URL}/cpu_action`, { method: "POST" });
          const data = await response.json();
          
          const p2 = data.game_state.players.find(p => p.id === "p2");
          if (p2 && p2.last_action !== "Fold") {
            playSound("chip.mp3");
          }
          
          setGameState(data.game_state);
          appendLog(data.game_state.message);
        } catch (error) {
          console.error("通信エラー", error);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const startGame = async () => {
    playSound("deal.mp3");
    try {
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

    setIsWaiting(true);

    const tempState = JSON.parse(JSON.stringify(gameState));
    const tempP1 = tempState.players.find(p => p.id === "p1");
    const tempP2 = tempState.players.find(p => p.id === "p2");
    
    if (actionType === 'fold') {
      tempP1.last_action = "Fold";
    } else if (actionType === 'call') {
      const callReq = tempP2.current_bet - tempP1.current_bet;
      if (callReq >= tempP1.stack) {
        tempP1.last_action = "All-In";
      } else if (callReq === 0) {
        tempP1.last_action = "Check";
      } else {
        tempP1.last_action = `Call ${tempP2.current_bet}`;
      }
    } else if (actionType === 'raise') {
      if (amount >= tempP1.stack + tempP1.current_bet) {
        tempP1.last_action = "All-In";
      } else {
        tempP1.last_action = `Raise to ${amount}`;
      }
    }
    setGameState(tempState);

    setTimeout(async () => {
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
      } finally {
        setIsWaiting(false);
      }
    }, 1000);
  };

  const resetGame = async () => {
    try {
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
  const isMyTurn = gameState.current_turn === "p1" && gameState.phase !== "SHOWDOWN" && !isWaiting;
  const isGameOver = gameState.phase === "SHOWDOWN" && (p1.stack <= 0 || p2.stack <= 0);

  const callRequired = p2.current_bet - p1.current_bet;
  const maxRaiseTo = p1.stack + p1.current_bet; 
  const minRaiseTo = Math.min(maxRaiseTo, p2.current_bet + 20);

  let callBtnText = "";
  if (callRequired > 0 && p1.stack <= callRequired) {
    callBtnText = "All-In";
  } else if (callRequired === 0) {
    callBtnText = "Check";
  } else {
    callBtnText = `Call ${p2.current_bet}`; 
  }

  const calculateShortcutAmounts = () => {
    if (!gameState) return [0, 0, 0];
    const phase = gameState.phase;
    const p2Bet = p2.current_bet;
    const pot = gameState.pot;

    let target1, target2, target3;
    if (phase === "PREFLOP") {
      target1 = p2Bet * 2;
      target2 = p2Bet * 3;
      target3 = p2Bet * 4;
    } else {
      if (p2Bet === 0) {
        target1 = p1.current_bet + Math.floor(pot / 3);
        target2 = p1.current_bet + Math.floor(pot / 2);
        target3 = p1.current_bet + pot;
      } else {
        target1 = p2Bet * 2;
        target2 = p2Bet * 3;
        target3 = p2Bet * 4;
      }
    }

    return [target1, target2, target3].map(val => {
      if (val < minRaiseTo) return minRaiseTo;
      if (val > maxRaiseTo) return maxRaiseTo;
      return val;
    });
  };

  const shortcutAmounts = calculateShortcutAmounts();
  let shortcutLabels = ["2x", "3x", "4x"];
  if (gameState && gameState.phase !== "PREFLOP" && p2.current_bet === 0) {
    shortcutLabels = ["1/3 Pot", "1/2 Pot", "Pot"];
  }

  const submitRaise = () => {
    if (raiseAmount < minRaiseTo) {
      alert(`最低レイズ額は ${minRaiseTo} チップです`);
      setRaiseAmount(minRaiseTo);
      return;
    }
    if (raiseAmount > maxRaiseTo) {
      alert(`所持金が足りません！(最大: ${maxRaiseTo})`);
      setRaiseAmount(maxRaiseTo);
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
        <button className="btn-start" onClick={startGame} style={{ marginBottom: 0 }} disabled={isWaiting}>♠ 新しいハンドを配る ♠</button>
        
        {/* ★変更：右上に「ログを見る」トグルボタンを追加 */}
        <div style={{ width: "130px", textAlign: "right" }}>
          <button className="btn-log-toggle" onClick={() => setShowLogs(true)}>📜 ログ</button>
        </div>
      </div>

      <div id="game-message">{gameState.message}</div>

      <div className="game-container">
        <div className="table">
          <div className="area">
            <div className="info-tag">
              {gameState.dealer_button === "p2" && <span style={{color: "#ffeb3b", marginRight: "8px", fontWeight: "bold"}}>Ⓓ</span>}
              CPU | チップ: {p2.stack} | ベット: {p2.current_bet}
            </div>
            
            <div style={{ minHeight: "40px" }}>
              {p2.last_action && (
                <div className="action-bubble">{p2.last_action}</div>
              )}
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
            
            <div style={{ minHeight: "40px" }}>
              {p1.last_action && (
                <div className="action-bubble">{p1.last_action}</div>
              )}
            </div>

            <div className="info-tag">
              {gameState.dealer_button === "p1" && <span style={{color: "#ffeb3b", marginRight: "8px", fontWeight: "bold"}}>Ⓓ</span>}
              {p1.name} | チップ: {p1.stack} | ベット: {p1.current_bet}
            </div>
            
            <div className="action-buttons">
              <button className="btn-call" onClick={() => takeAction('call')} disabled={!isMyTurn}>
                {callBtnText}
              </button>
              
              <div className="raise-box">
                <input 
                  type="range" 
                  min={minRaiseTo} 
                  max={maxRaiseTo} 
                  value={raiseAmount} 
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  disabled={!isMyTurn || maxRaiseTo <= p2.current_bet}
                  className="raise-slider"
                />
                
                <div className="raise-shortcuts">
                  <button onClick={() => setRaiseAmount(shortcutAmounts[0])} disabled={!isMyTurn || maxRaiseTo <= p2.current_bet}>{shortcutLabels[0]}</button>
                  <button onClick={() => setRaiseAmount(shortcutAmounts[1])} disabled={!isMyTurn || maxRaiseTo <= p2.current_bet}>{shortcutLabels[1]}</button>
                  <button onClick={() => setRaiseAmount(shortcutAmounts[2])} disabled={!isMyTurn || maxRaiseTo <= p2.current_bet}>{shortcutLabels[2]}</button>
                </div>

                <div className="raise-inputs">
                  <input 
                    type="number" 
                    value={raiseAmount} 
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    max={maxRaiseTo}
                    min={minRaiseTo}
                    disabled={!isMyTurn || maxRaiseTo <= p2.current_bet}
                  />
                  <button className="btn-raise" onClick={submitRaise} disabled={!isMyTurn || maxRaiseTo <= p2.current_bet}>Raise to</button>
                </div>
              </div>

              <button className="btn-fold" onClick={() => takeAction('fold')} disabled={!isMyTurn}>Fold</button>
            </div>
          </div>
        </div>

        {/* ★変更：アクションログをドロワー形式にする */}
        <div className={`log-panel-container ${showLogs ? "show" : ""}`}>
          <div className="log-header">
            <h3>📜 アクションログ</h3>
            <button className="btn-close-log" onClick={() => setShowLogs(false)}>✖</button>
          </div>
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