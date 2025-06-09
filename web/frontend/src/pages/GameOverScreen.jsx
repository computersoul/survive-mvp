import React, { useState, useEffect } from 'react';
import { completeGame, resetLobby } from '../api';

const AVATAR_COLORS = [
  '#6C63FF', '#FF6584', '#43E97B', '#FFD86E', '#FF6B6B',
  '#36CFC9', '#FFB86C', '#A3A1FB', '#FEC163', '#43E97B',
];

const getPlayerColor = (playerId) => {
  const hash = [...playerId.toString()].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

function uniqByUserId(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    const id = item.user_id || item.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const GameOverScreen = ({ user, lobbyId, lobbyData, players, winner }) => {
  const [showResults, setShowResults] = useState(false);
  const [remainingTime, setRemainingTime] = useState(15);
  const [leaderboard, setLeaderboard] = useState(players || []);
  const [gameWinner, setGameWinner] = useState(winner || null);
  const [loadingResults, setLoadingResults] = useState(false);

  const adminId = lobbyData?.admin_id?.toString();

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (remainingTime === 0 && window.Telegram?.WebApp) {
      window.Telegram.WebApp.close();
    }
  }, [remainingTime]);

  useEffect(() => {
    if (!lobbyId || leaderboard.length || players?.length) return;
    const fetchLeaderboard = async () => {
      setLoadingResults(true);
      try {
        const res = await completeGame(lobbyId, adminId);
        if (res.ok && res.result) {
          setLeaderboard(res.result.leaderboard || []);
          setGameWinner(res.result.winner || null);
          console.log('[GameOverScreen] leaderboard from API:', res.result.leaderboard);
        }
      } catch (error) {
      } finally {
        setLoadingResults(false);
      }
    };
    fetchLeaderboard();
  }, [lobbyId, adminId, leaderboard, players]);

  useEffect(() => {
    if (lobbyId && adminId) {
      const reset = async () => {
        try {
          await resetLobby(lobbyId, adminId);
          console.log('[GameOverScreen] Lobby reset successfully');
        } catch (error) {
          console.error('[GameOverScreen] Failed to reset lobby:', error);
        }
      };
      reset();
    }
  }, [lobbyId, adminId]);

  const uniqueLeaderboard = uniqByUserId(leaderboard || []);

  let winnerCount = 0;
  const sortedLeaderboard = uniqueLeaderboard
    .slice()
    .sort((a, b) => {
      const aRound = a.eliminated_round === null ? Infinity : a.eliminated_round;
      const bRound = b.eliminated_round === null ? Infinity : b.eliminated_round;
      if (aRound !== bRound) return bRound - aRound;
      return (a.user_id || a.id || '').localeCompare(b.user_id || b.id || '');
    })
    .filter((p) => {
      if (p.eliminated_round === null) {
        winnerCount++;
        return winnerCount === 1;
      }
      return true;
    });

  useEffect(() => {
    if (
      user &&
      sortedLeaderboard &&
      !sortedLeaderboard.some(p => (p.user_id || p.id) === user.id)
    ) {
      setLeaderboard(prev => [...prev, {
        user_id: user.id,
        username: user.username,
        eliminated_round: null,
      }]);
      console.warn('[GameOverScreen] You were missing from leaderboard, added manually!');
    }
  }, [sortedLeaderboard, user]);

  const handleShowResults = async () => {
    if (uniqueLeaderboard.length || players?.length) {
      setShowResults(!showResults);
      return;
    }
    setLoadingResults(true);
    try {
      const res = await completeGame(lobbyId, adminId);
      if (res.ok && res.result) {
        setLeaderboard(res.result.leaderboard || []);
        setGameWinner(res.result.winner || null);
        setShowResults(true);
        console.log('[GameOverScreen] leaderboard from ShowResults:', res.result.leaderboard);
      }
    } catch (error) {
    } finally {
      setLoadingResults(false);
    }
  };

  console.log('[GameOverScreen] user:', user);
  console.log('[GameOverScreen] leaderboard:', leaderboard);
  console.log('[GameOverScreen] sortedLeaderboard:', sortedLeaderboard);

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={styles.title}>Game Over!</div>
        <div style={styles.winner}>
          {gameWinner ? `Winner: ${gameWinner.username}` : 'No winner'}
        </div>
        <div style={styles.buttonContainer}>
          <button
            style={{
              ...styles.button,
              background: '#6C63FF',
              cursor: loadingResults ? 'wait' : 'pointer',
              opacity: loadingResults ? 0.6 : 1,
            }}
            onClick={handleShowResults}
            disabled={loadingResults}
          >
            {showResults ? 'Hide Results' : 'Show Results'}
          </button>
          <button
            style={{ ...styles.button, background: '#43E97B' }}
            onClick={() => window.location.reload()}
          >
            Play Again
          </button>
          <button
            style={{ ...styles.button, background: '#FF6B6B' }}
            onClick={() => window.Telegram?.WebApp?.close()}
          >
            Exit
          </button>
        </div>
        <div style={styles.timer}>Exiting in {remainingTime} seconds...</div>
      </div>
      {showResults && sortedLeaderboard.length > 0 && (
        <div style={styles.leaderboardPanel}>
          <div style={styles.leaderboardContainer}>
            <button
              style={styles.closeButton}
              onClick={() => setShowResults(false)}
            >
              ✕
            </button>
            <div style={styles.leaderboardContent}>
              {sortedLeaderboard.map((player, idx) => {
                const key = player.user_id || player.id || idx;
                const isWinner = player.eliminated_round === null;
                return (
                  <div key={key} style={{
                    ...styles.leaderboardRow,
                    color: isWinner ? '#FFD700' : 'white',
                    fontWeight: isWinner ? 700 : 500,
                    borderRadius: '12px',
                  }}>
                    <div style={{
                      ...styles.rank,
                      color: isWinner ? '#FFD700' : '#888',
                    }}>
                      #{idx + 1}
                    </div>
                    <div style={{ ...styles.avatar, background: getPlayerColor(key) }}>
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.playerName}>
                      <span>{player.username}</span>
                      {user && (user.id === (player.user_id || player.id)) && (
                        <span style={styles.youTag}>(You)</span>
                      )}
                      {isWinner && <span style={styles.winnerIcon}>🏆</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', minWidth: '100vw', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  panel: {
    position: 'relative', width: '300px', background: '#333', border: '2px solid #aaa',
    borderRadius: '12px', padding: '20px', color: 'white', display: 'flex',
    flexDirection: 'column', gap: '15px', boxShadow: '0 4px 24px 0 rgba(0,0,0,0.7)', zIndex: 1000,
  },
  title: { fontSize: '1.5rem', textAlign: 'center', fontWeight: 700 },
  winner: { fontSize: '1.2rem', textAlign: 'center', color: '#FFD700' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' },
  button: { padding: '10px', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 500 },
  timer: { textAlign: 'center', fontSize: '0.9rem', color: '#ccc' },
  leaderboardPanel: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '400px', maxHeight: '600px', background: '#222', border: '3px solid #aaa',
    borderRadius: '18px', boxShadow: '0 4px 24px 0 rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    overflowY: 'auto', padding: '16px 0', zIndex: 2000,
  },
  leaderboardContainer: { width: '100%', position: 'relative' },
  closeButton: {
    position: 'absolute', top: '10px', right: '10px', background: 'none',
    border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer',
  },
  leaderboardContent: { padding: '10px 24px', color: 'white', fontSize: '1.1rem' },
  leaderboardRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '10px' },
  rank: { width: '30px', textAlign: 'right', fontWeight: 700, flexShrink: 0 },
  avatar: {
    width: 38, height: 38, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontWeight: '700',
    fontSize: '1.2rem',
    color: 'white',
    flexShrink: 0,
  },
  playerName: { flex: 1, display: 'flex', alignItems: 'center' },
  items: { display: 'flex', gap: '8px' },
  youTag: { color: 'white', paddingLeft: '5px' },
  winnerIcon: { color: '#FFD700', paddingLeft: '8px', fontSize: '1.2rem' },
};

export default GameOverScreen;

