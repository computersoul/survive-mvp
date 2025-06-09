import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import RoundScreen from './pages/RoundScreen';
import LobbyScreen from './pages/LobbyScreen';
import GameOverScreen from './pages/GameOverScreen';
import AdminPanel from './pages/AdminPanel';
import WaitingScreen from './pages/WaitingScreen';
import { joinLobby, getLobby, createUser, getUser, getLobbies } from './api';

/**
 * Redirects to the round screen
 * @returns {null}
 */
const RedirectToRound = () => {
  const navigate = useNavigate();
  useEffect(() => navigate('/round'), [navigate]);
  return null;
};

/**
 * Redirects to the admin panel
 * @returns {null}
 */
const RedirectToPanel = () => {
  const navigate = useNavigate();
  useEffect(() => navigate('/panel'), [navigate]);
  return null;
};

/**
 * Main application component
 * @returns {JSX.Element}
 */
const App = () => {
  const [user, setUser] = useState(/** @type {{ id: string, username: string, role?: string, lobby_id?: string|null }} */ (null));
  const [lobbyId, setLobbyId] = useState(/** @type {string|null} */ (null));
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [screen, setScreen] = useState(/** @type {'lobby'|'round'|'gameover'} */ ('lobby'));
  const [waitingForLobby, setWaitingForLobby] = useState(false);
  const [loading, setLoading] = useState(true);

  const waitingInterval = useRef(/** @type {NodeJS.Timeout|null} */ (null));

  /**
   * Initializes the application state
   */
  const initializeApp = useCallback(async () => {
    setLoading(true);
    try {
      const tg = window.Telegram.WebApp;
      tg.ready();
      const tgUser = tg.initDataUnsafe?.user;
      if (!tgUser) throw new Error('Failed to initialize Telegram user');

      const userData = {
        id: tgUser.id.toString(),
        username: tgUser.username || tgUser.first_name || `User${tgUser.id}`,
        lobby_id: null,
      };

      let existingUser;
      try {
        existingUser = await getUser(userData.id);
      } catch (e) {
        await createUser(userData.id, userData.username);
        userData.role = 'player';
      }
      if (existingUser?.ok) {
        userData.role = existingUser.result.role || 'player';
        userData.lobby_id = existingUser.result.lobby_id;
      }

      setUser(userData);

      if (userData.role === 'admin') {
        setLoading(false);
        return;
      }

      const lobbiesData = await getLobbies();
      if (!lobbiesData.ok || !lobbiesData.result) throw new Error('Failed to load lobbies');

      const waitingLobbies = lobbiesData.result.filter(
        lobby => lobby.status === 'waiting' &&
          (!lobby.max_players || (lobby.players?.length || 0) < lobby.max_players)
      );

      let selectedLobbyId = userData.lobby_id;
      if (!selectedLobbyId && waitingLobbies.length > 0) {
        selectedLobbyId = waitingLobbies.sort(() => Math.random() - 0.5)[0]?.id;
      }

      if (!selectedLobbyId) {
        setWaitingForLobby(true);
        setLoading(false);
        return;
      }

      const joinResult = await joinLobby(selectedLobbyId, userData.id);
      if (!joinResult.ok) throw new Error(`Failed to join lobby: ${joinResult.message}`);

      setUser(prev => ({ ...prev, lobby_id: selectedLobbyId }));

      const lobbyData = await getLobby(selectedLobbyId);
      if (!lobbyData.ok || !lobbyData.result) throw new Error(`Lobby ${selectedLobbyId} not found`);

      setLobbyId(selectedLobbyId);
      setScreen(lobbyData.result.status === 'playing' ? 'round' : 'lobby');
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  /**
   * Polls for new lobbies while waiting
   */
  const pollForNewLobby = useCallback(async () => {
    if (!waitingForLobby || !user?.id) return;

    waitingInterval.current = setInterval(async () => {
      try {
        const lobbiesData = await getLobbies();
        if (lobbiesData.ok && lobbiesData.result) {
          const waitingLobbies = lobbiesData.result.filter(
            lobby => lobby.status === 'waiting' &&
              (!lobby.max_players || (lobby.players?.length || 0) < lobby.max_players)
          );
          if (waitingLobbies.length > 0) {
            const selectedLobbyId = waitingLobbies[0].id;
            const joinResult = await joinLobby(selectedLobbyId, user.id);
            if (joinResult.ok) {
              setUser(prev => ({ ...prev, lobby_id: selectedLobbyId }));
              setLobbyId(selectedLobbyId);
              setScreen('lobby');
              setWaitingForLobby(false);
              if (waitingInterval.current) clearInterval(waitingInterval.current);
            }
          }
        }
      } catch (e) {
        console.warn('Polling error:', e.message);
      }
    }, 2000);
  }, [waitingForLobby, user]);

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
    return () => { if (waitingInterval.current) clearInterval(waitingInterval.current); };
  }, [initializeApp]);

  // Start polling when waiting for lobby
  useEffect(() => {
    pollForNewLobby();
    return () => { if (waitingInterval.current) clearInterval(waitingInterval.current); };
  }, [pollForNewLobby]);

  /**
   * Resets the lobby state and returns to waiting
   */
  const handleResetLobby = useCallback(() => {
    setUser(prev => ({ ...prev, lobby_id: null }));
    setLobbyId(null);
    setScreen('lobby');
    setWaitingForLobby(true);
  }, []);

  /**
   * Transitions to round screen when timer ends
   */
  const handleTimerEnd = useCallback(() => setScreen('round'), []);

  /**
   * Transitions to game over screen when round ends
   */
  const handleGameEnd = useCallback(() => setScreen('gameover'), []);

  if (loading) {
    return (
      <div className="min-h-screen min-w-full bg-black flex items-center justify-center text-white text-xl">
        {error || 'Loading...'}
      </div>
    );
  }

  if (waitingForLobby) {
    return <WaitingScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={user?.role === 'admin' ? <RedirectToPanel /> : <RedirectToRound />}
        />
        <Route
          path="/round"
          element={
            user?.role === 'admin' ? (
              <RedirectToPanel />
            ) : user && lobbyId ? (
              screen === 'lobby' ? (
                <LobbyScreen
                  user={user}
                  lobbyId={lobbyId}
                  onTimerEnd={handleTimerEnd}
                />
              ) : screen === 'round' ? (
                <RoundScreen
                  user={user}
                  lobbyId={lobbyId}
                  onGameEnd={handleGameEnd}
                />
              ) : (
                <GameOverScreen
                  user={user}
                  lobbyId={lobbyId}
                  lobbyData={{ admin_id: user?.id }}
                  onPlayAgain={handleResetLobby}
                />
              )
            ) : (
              <div className="min-h-screen min-w-full bg-black flex items-center justify-center text-white text-xl">
                {error || 'Loading...'}
              </div>
            )
          }
        />
        <Route
          path="/panel"
          element={user?.role === 'admin' ? <AdminPanel user={user} /> : <RedirectToRound />}
        />
      </Routes>
    </Router>
  );
};

export default App;