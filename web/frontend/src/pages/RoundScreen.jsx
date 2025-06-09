import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getLobby, completeGame } from '../api';
import GameOverScreen from './GameOverScreen';

const avatarColors = [
  '#6C63FF', '#FF6584', '#43E97B', '#FFD86E', '#FF6B6B',
  '#36CFC9', '#FFB86C', '#A3A1FB', '#FEC163', '#43E97B'
];

const getPlayerColor = (playerId, assignedColors) => {
  if (assignedColors[playerId]) return assignedColors[playerId];
  const usedColors = Object.values(assignedColors);
  const available = avatarColors.find(c => !usedColors.includes(c))
    || avatarColors[Math.floor(Math.random() * avatarColors.length)];
  assignedColors[playerId] = available;
  return available;
};

const PlayerRow = React.memo(({ player, isLast, userId }) => (
  <>
    <div
      className={`flex items-center gap-4 p-3 text-white ${player.status === 'eliminated' ? 'opacity-50 grayscale' : ''}`}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl text-white"
        style={{ backgroundColor: player.color }}
      >
        {player.username.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 flex items-center justify-center font-medium text-lg relative">
        <span>{player.username}</span>
        {player.id === userId && <span className="ml-2 text-white">(You)</span>}
        {player.status === 'eliminated' && <span className="absolute right-0 text-xl text-[#888] font-bold">X</span>}
      </div>
    </div>
    {!isLast && <hr className="h-px bg-[#181818] my-0 mx-4 border-none" />}
  </>
));

const ROUND_TIME = 3;

const RoundScreen = ({ user, lobbyId = 4, onGameEnd }) => {
  const [lobbyData, setLobbyData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameFinished, setGameFinished] = useState(false);
  const [error, setError] = useState(null);

  const assignedColors = useRef({});
  const timerRef = useRef(null);
  const [isEliminationPending, setIsEliminationPending] = useState(false);

  const fetchLobbyData = useCallback(async () => {
    if (!lobbyId) {
      setError('Lobby ID is missing');
      return;
    }
    try {
      const data = await getLobby(lobbyId);
      if (!data?.result) throw new Error('Invalid lobby API response');
      setLobbyData(data.result);
    } catch (error) {
      setError(`Failed to load lobby: ${error.message}`);
    }
  }, [lobbyId]);

  const fetchPlayers = useCallback(async () => {
    try {
      const data = await completeGame(lobbyId);
      if (!data?.result || !Array.isArray(data.result.leaderboard)) {
        throw new Error('Invalid completeGame API response');
      }
      const initialPlayers = data.result.leaderboard.map(player => ({
        id: player.user_id,
        username: player.username,
        color: getPlayerColor(player.user_id, assignedColors.current),
        status: 'active',
        eliminatedRound: player.eliminated_round ?? null
      }));
      setPlayers(initialPlayers);
      setWinner(null);
      setRoundNumber(1);
      setTimeLeft(ROUND_TIME);
      setGameFinished(false);
      setIsEliminationPending(false);
    } catch (error) {
      setError(`Failed to load leaderboard: ${error.message}`);
    }
  }, [lobbyId]);

  useEffect(() => { fetchLobbyData(); }, [fetchLobbyData]);
  useEffect(() => { if (lobbyData) fetchPlayers(); }, [lobbyData, fetchPlayers]);

  // Watch for end of game
  useEffect(() => {
    if (!players.length || gameFinished) return;
    const activePlayers = players.filter(p => p.status === 'active');
    if (activePlayers.length <= 1) {
      setWinner(activePlayers[0] || null);
      setGameFinished(true);
      if (onGameEnd) onGameEnd();
    }
  }, [players, gameFinished, onGameEnd]);

  // Раунд: таймер -> элиминация -> след. раунд
  useEffect(() => {
    if (!players.length || gameFinished || isEliminationPending) return;

    setTimeLeft(ROUND_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsEliminationPending(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [players, gameFinished, roundNumber, isEliminationPending]);

  // Элиминация: после завершения таймера
  useEffect(() => {
    if (!isEliminationPending) return;
    setPlayers(prevPlayers => {
      const stillActive = prevPlayers.filter(p => p.status === 'active');
      const numToEliminate = Math.ceil(stillActive.length / 2);
      if (numToEliminate === 0) return prevPlayers;
      const shuffled = [...stillActive].sort(() => Math.random() - 0.5);
      const toEliminateIds = shuffled.slice(0, numToEliminate).map(p => p.id);
      return prevPlayers.map(p =>
        toEliminateIds.includes(p.id)
          ? { ...p, status: 'eliminated', eliminatedRound: roundNumber }
          : p
      );
    });
    setRoundNumber(r => r + 1);
    setIsEliminationPending(false);
  }, [isEliminationPending, roundNumber]);

  const visiblePlayers = useMemo(
    () => players.filter(p => p.id !== lobbyData?.admin_id),
    [players, lobbyData]
  );
  const activePlayersCount = useMemo(
    () => visiblePlayers.filter(p => p.status === 'active').length,
    [visiblePlayers]
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        {error}
      </div>
    );
  }

  if (gameFinished) {
    return (
      <GameOverScreen
        players={players}
        winner={winner}
        user={user}
        lobbyId={lobbyId}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-black p-5">
      <div className="flex flex-col gap-5 w-full max-w-md">
        <div className="bg-[#222] border-4 border-[#aaa] rounded-2xl shadow-xl p-6 text-white">
          <div className="text-3xl font-bold text-center mb-4">
            Round {roundNumber}
          </div>
          <div className="flex flex-col items-center text-xl text-[#ccc] gap-2">
            <div>Players left: {activePlayersCount}</div>
            <div>Next elimination in: {timeLeft} sec</div>
          </div>
        </div>
        <div className="bg-[#222] border-4 border-[#aaa] rounded-2xl shadow-xl p-4 h-[600px] overflow-y-auto">
          <div className="w-full">
            {visiblePlayers.length > 0 ? (
              visiblePlayers.map((player, idx) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  isLast={idx === visiblePlayers.length - 1}
                  userId={user.id}
                />
              ))
            ) : (
              <div className="text-[#ccc] text-center p-4 text-lg">
                No players yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundScreen;
