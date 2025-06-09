import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLobby, completeGame } from '../api';

const AVATAR_COLORS = [
  '#6C63FF', '#FF6584', '#43E97B', '#FFD86E', '#FF6B6B',
  '#36CFC9', '#FFB86C', '#A3A1FB', '#FEC163', '#43E97B'
];

const getPlayerColor = (playerId) => {
  const hash = [...playerId.toString()].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const PlayerRow = ({ player, isLast, userId }) => (
  <>
    <div className="flex items-center gap-4 p-3 text-white">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl text-white"
        style={{ backgroundColor: player.color }}
      >
        {player.username.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 text-center font-medium text-lg">
        {player.username}
        {player.id === userId && (
          <span className="ml-2 text-white">(You)</span>
        )}
      </div>
    </div>
    {!isLast && <hr className="h-px bg-[#181818] my-0 mx-4 border-none" />}
  </>
);

const LobbyScreen = ({ user, lobbyId, onTimerEnd }) => {
  const [lobbyData, setLobbyData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [error, setError] = useState(null);
  const [shouldEndTimer, setShouldEndTimer] = useState(false);

  const fetchLobbyData = useCallback(async () => {
    try {
      const data = await getLobby(lobbyId);
      if (!data?.ok || !data?.result) throw new Error('Failed to load lobby');
      setLobbyData(prev => JSON.stringify(prev) !== JSON.stringify(data.result) ? data.result : prev);

      if (data.result.status !== 'waiting') {
        setShouldEndTimer(true);
        return;
      }

      const updatedPlayers = data.result.players.map(player => ({
        ...player,
        color: getPlayerColor(player.id)
      }));
      setPlayers(prev => JSON.stringify(prev) !== JSON.stringify(updatedPlayers) ? updatedPlayers : prev);

      // Устанавливаем начальное время из start_delay, если оно изменилось
      if (timeLeft === null || data.result.start_delay !== lobbyData?.start_delay) {
        setTimeLeft(data.result.start_delay);
      }
    } catch (err) {
      setError('Failed to load lobby data.');
    }
  }, [lobbyId, timeLeft, lobbyData?.start_delay]);

  useEffect(() => {
    fetchLobbyData();
    const interval = setInterval(fetchLobbyData, 2000);
    return () => clearInterval(interval);
  }, [fetchLobbyData]);

  useEffect(() => {
    if (!shouldEndTimer) return;
    const complete = async () => {
      try {
        await completeGame(lobbyId, user.id);
        onTimerEnd();
      } catch (err) {
        setError('Failed to finish the game.');
      }
    };
    complete();
  }, [shouldEndTimer, lobbyId, user.id, onTimerEnd]);

  useEffect(() => {
    if (!lobbyData || lobbyData.status !== 'waiting' || timeLeft === null) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1 || players.length >= (lobbyData.max_players || 100)) {
          setShouldEndTimer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lobbyData, timeLeft, players.length]);

  const maxPlayers = useMemo(() => lobbyData?.max_players || 100, [lobbyData]);
  const totalPlayers = useMemo(() => players.length, [players]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white text-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-black p-5">
      <div className="flex flex-col gap-5 w-full max-w-md">
        <div className="bg-[#222] border-4 border-[#aaa] rounded-2xl shadow-xl p-6 text-white">
          <h2 className="text-3xl font-bold text-center mb-4">Waiting for players...</h2>
          <div className="flex flex-col items-center text-xl text-[#ccc] gap-2">
            <p>Players: {totalPlayers}/{maxPlayers}</p>
            {lobbyData?.status === 'waiting' && (
              <p>Time left: {timeLeft} sec</p>
            )}
          </div>
        </div>
        <div className="bg-[#222] border-4 border-[#aaa] rounded-2xl shadow-xl p-4 h-[600px] overflow-y-auto">
          <div className="w-full">
            {players.length > 0 ? (
              players.map((player, idx) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  isLast={idx === players.length - 1}
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

export default LobbyScreen;