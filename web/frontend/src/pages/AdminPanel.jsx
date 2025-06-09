import React, { useState, useEffect, useCallback } from 'react';
import {
  getLobbies,
  createLobby,
  completeGame,
  deleteLobby,
  updateSettings,
  getSettings,
} from '../api';

/**
 * AdminPanel component for managing game lobbies.
 * Displays all lobbies, allows creating, starting, deleting lobbies,
 * and managing settings. Restricted to 'admin' role users.
 *
 * @param {Object} user - Current user object with id and role
 * @returns {JSX.Element} Admin panel UI
 */
const AdminPanel = ({ user }) => {
  const [lobbies, setLobbies] = useState([]);
  const [error, setError] = useState(null);
  const [selectedLobbyId, setSelectedLobbyId] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({ max_players: 100, start_delay: 60 });
  const [notification, setNotification] = useState({ message: '', type: 'success', visible: false });

  const isMobile = window.innerWidth <= 768; // Объявление isMobile на уровне компонента
  const isAdmin = user?.role === 'admin';

  /**
   * Fetches all lobbies from the API.
   */
  const fetchLobbies = useCallback(async () => {
    if (!user?.id) {
      setError('Admin not initialized');
      return;
    }
    try {
      const response = await getLobbies(isAdmin ? null : user.id);
      if (!response.ok || !Array.isArray(response.result)) {
        throw new Error(response.message || 'Invalid API response');
      }
      setLobbies(response.result);
      setError(null);
    } catch (err) {
      setError(`Failed to load lobbies: ${err.message}`);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 5000);
    return () => clearInterval(interval);
  }, [fetchLobbies]);

  /**
   * Fetches global settings from the API.
   */
  const fetchSettings = useCallback(async () => {
    try {
      const response = await getSettings();
      if (response.ok) {
        setSettings(response.result);
      } else {
        throw new Error(response.message || 'Failed to fetch settings');
      }
    } catch (err) {
      setError(`Error fetching settings: ${err.message}`);
    }
  }, []);

  /**
   * Starts a game for the selected lobby.
   */
  const handleStartGame = async () => {
    if (!selectedLobbyId) {
      setNotification({ message: 'Please select a lobby first', type: 'error', visible: true });
      return;
    }
    const lobby = lobbies.find(l => l.id === selectedLobbyId);
    if (!lobby || lobby.status !== 'waiting') {
      setNotification({ message: 'Lobby must be in waiting status to start', type: 'error', visible: true });
      return;
    }
    try {
      const response = await completeGame(selectedLobbyId);
      if (!response.ok) {
        throw new Error(response.message || 'Failed to complete game');
      }
      setLobbies(lobbies.map(l => l.id === selectedLobbyId ? { ...l, status: 'finished' } : l));
      setNotification({ message: 'Game started successfully', type: 'success', visible: true });
    } catch (err) {
      setNotification({ message: `Error starting game: ${err.message}`, type: 'error', visible: true });
    }
  };

  /**
   * Opens the settings modal and fetches current settings.
   */
  const handleSettingsOpen = async () => {
    if (!isAdmin) {
      setNotification({ message: 'Only admins can modify settings', type: 'error', visible: true });
      return;
    }
    await fetchSettings();
    setShowSettingsModal(true);
  };

  /**
   * Submits updated settings to the API.
   */
  const handleSettingsSubmit = async () => {
    if (settings.max_players < 1) {
      setNotification({ message: 'Max players must be at least 1', type: 'error', visible: true });
      return;
    }
    if (settings.start_delay < 5) {
      setNotification({ message: 'Start delay must be at least 5 seconds', type: 'error', visible: true });
      return;
    }
    try {
      const response = await updateSettings(settings);
      if (!response.ok) {
        throw new Error(response.message || 'Failed to update settings');
      }
      await fetchLobbies();
      setShowSettingsModal(false);
      setNotification({ message: 'Settings updated successfully', type: 'success', visible: true });
    } catch (err) {
      setNotification({ message: `Error updating settings: ${err.message}`, type: 'error', visible: true });
    }
  };

  /**
   * Deletes the selected lobby using the API.
   */
  const handleDeleteLobby = async () => {
    if (!selectedLobbyId) {
      setNotification({ message: 'Please select a lobby first', type: 'error', visible: true });
      return;
    }
    const lobby = lobbies.find(l => l.id === selectedLobbyId);
    if (!lobby) {
      setNotification({ message: 'Selected lobby does not exist', type: 'error', visible: true });
      return;
    }
    try {
      const response = await deleteLobby(selectedLobbyId, user.id);
      if (!response.ok) {
        throw new Error(response.message || 'Failed to delete lobby');
      }
      setLobbies(lobbies.filter(l => l.id !== selectedLobbyId));
      setSelectedLobbyId(null);
      setNotification({ message: 'Lobby deleted successfully', type: 'success', visible: true });
    } catch (err) {
      setNotification({ message: `Error deleting lobby: ${err.message}`, type: 'error', visible: true });
    }
  };

  /**
   * Creates a new lobby using the API with current settings.
   */
  const handleCreateLobby = async () => {
    try {
      const adminId = Number(user.id); // Explicitly convert to number
      if (isNaN(adminId)) {
        throw new Error('Invalid admin ID');
      }
      const response = await createLobby(adminId, { max_players: settings.max_players, start_delay: settings.start_delay });
      if (!response.ok || !response.result) {
        throw new Error(response.message || 'Failed to create lobby');
      }
      setLobbies([...lobbies, response.result]);
      setNotification({ message: 'Lobby created successfully', type: 'success', visible: true });
      await fetchLobbies();
    } catch (err) {
      console.error('Create lobby error details:', err);
      setNotification({ message: `Error creating lobby: ${err.message}`, type: 'error', visible: true });
    }
  };

  useEffect(() => {
    let timer;
    if (notification.visible) {
      timer = setTimeout(() => {
        setNotification({ ...notification, visible: false });
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [notification]);

  if (!user?.id) {
    return <div style={styles.errorContainer}>Admin not initialized</div>;
  }
  if (!isAdmin) {
    return <div style={styles.errorContainer}>Access denied: Admin role required</div>;
  }

  return (
    <div style={styles.container}>
      {notification.visible && (
        <div style={{ ...styles.notification, background: notification.type === 'success' ? '#43E97B' : '#FF6B6B' }}>
          {notification.message}
        </div>
      )}
      {error && (
        <div style={styles.errorMessage}>
          {error}
          <button style={styles.errorButton} onClick={() => setError(null)}>×</button>
        </div>
      )}
      <div style={styles.panelContainer}>
        <h2 style={styles.panelTitle}>Admin Panel</h2>
        <div style={styles.buttonGroup}>
          <button
            style={{ ...styles.button, background: '#6C63FF' }}
            onClick={handleStartGame}
            disabled={!selectedLobbyId}
          >
            Start Game
          </button>
          <button
            style={{ ...styles.button, background: '#FFD86E' }}
            onClick={handleSettingsOpen}
          >
            Settings
          </button>
          <button
            style={{ ...styles.button, background: '#FF6B6B' }}
            onClick={handleDeleteLobby}
            disabled={!selectedLobbyId}
          >
            Delete Lobby
          </button>
          <button
            style={{ ...styles.button, background: '#43E97B' }}
            onClick={handleCreateLobby}
          >
            Create Lobby
          </button>
        </div>
      </div>

      <div style={styles.lobbiesContainer}>
        <h3 style={styles.lobbiesTitle}>All Lobbies</h3>
        {lobbies.length > 0 ? (
          lobbies.map((lobby, idx) => (
            <div key={lobby.id}>
              <div
                style={{
                  ...styles.lobbyItem,
                  ...(selectedLobbyId === lobby.id ? styles.lobbyItemSelected : {}),
                }}
                onClick={() => setSelectedLobbyId(lobby.id)}
              >
                <div style={styles.lobbyInfo}>
                  <span>Lobby #{lobby.id}</span>
                  <span style={styles.lobbyDetails}>
                    Players: {lobby.players_count}/{lobby.max_players || 'Unlimited'} | Status: {lobby.status}
                  </span>
                </div>
              </div>
              {idx < lobbies.length - 1 && <hr style={styles.divider} />}
            </div>
          ))
        ) : (
          <div style={styles.noLobbies}>No lobbies available</div>
        )}
      </div>

      {showSettingsModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Global Settings</h3>
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Max Players:</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={settings.max_players === 0 ? '' : String(settings.max_players)}
                onChange={e => {
                  let v = e.target.value.replace(/^0+/, '');
                  if (v === '') {
                    setSettings(s => ({ ...s, max_players: 0 }));
                    return;
                  }
                  if (!/^\d+$/.test(v)) return;
                  setSettings(s => ({ ...s, max_players: Number(v) }));
                }}
                style={{
                  ...styles.modalInput,
                  MozAppearance: 'textfield',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                autoComplete="off"
                onKeyDown={e => {
                  if (
                    !/[0-9]/.test(e.key) &&
                    !["Backspace", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)
                  ) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Start Delay (seconds):</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={settings.start_delay === 0 ? '' : String(settings.start_delay)}
                onChange={e => {
                  let v = e.target.value.replace(/^0+/, '');
                  if (v === '') {
                    setSettings(s => ({ ...s, start_delay: 0 }));
                    return;
                  }
                  if (!/^\d+$/.test(v)) return;
                  setSettings(s => ({ ...s, start_delay: Number(v) }));
                }}
                style={{
                  ...styles.modalInput,
                  MozAppearance: 'textfield',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                autoComplete="off"
                onKeyDown={e => {
                  if (
                    !/[0-9]/.test(e.key) &&
                    !["Backspace", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)
                  ) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div style={styles.modalButtons}>
              <button
                style={{ ...styles.modalButton, background: '#6C63FF' }}
                onClick={() => {
                  if (settings.max_players < 1) {
                    setNotification({ message: 'Max players must be at least 1', type: 'error', visible: true });
                    return;
                  }
                  if (settings.start_delay < 5) {
                    setNotification({ message: 'Start delay must be at least 5 seconds', type: 'error', visible: true });
                    return;
                  }
                  handleSettingsSubmit();
                }}
              >
                Save
              </button>
              <button
                style={{ ...styles.modalButton, background: '#FF6584' }}
                onClick={() => setShowSettingsModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// Обновленные стили с использованием window.innerWidth вместо isMobile
const styles = {
  container: {
    minHeight: '100vh',
    width: '100%',
    maxWidth: '90vw',
    margin: '0 auto',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '2rem',
    color: 'white',
    padding: window.innerWidth <= 768 ? '1rem' : '2rem',
  },
  notification: {
    position: 'fixed',
    top: '2rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#43E97B',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    zIndex: 3000,
    textAlign: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    opacity: 1,
    transition: 'opacity 0.3s ease-in-out',
  },
  errorContainer: {
    minHeight: '100vh',
    width: '100%',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    padding: window.innerWidth <= 768 ? '1rem' : '2rem',
  },
  errorMessage: {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#FF6B6B',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    zIndex: 3000,
    display: 'flex',
    alignItems: 'center',
    maxWidth: '90%',
    boxSizing: 'border-box',
  },
  errorButton: {
    marginLeft: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '1.25rem',
  },
  panelContainer: {
    width: '100%',
    maxWidth: window.innerWidth <= 768 ? '100%' : '400px',
    background: '#222',
    border: '3px solid #aaa',
    borderRadius: '1rem',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.7)',
    padding: window.innerWidth <= 768 ? '0.75rem' : '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    margin: '0 5vw',
    boxSizing: 'border-box',
  },
  panelTitle: {
    fontSize: window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
    fontWeight: 700,
    textAlign: 'center',
  },
  buttonGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    justifyContent: 'center',
  },
  button: {
    padding: window.innerWidth <= 768 ? '0.5rem 0.75rem' : '0.625rem 1rem',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'black',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem',
    transition: 'opacity 0.1s',
  },
  lobbiesContainer: {
    width: '100%',
    maxWidth: window.innerWidth <= 768 ? '100%' : '400px',
    background: '#222',
    border: '3px solid #aaa',
    borderRadius: '1rem',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.7)',
    padding: window.innerWidth <= 768 ? '0.75rem' : '1rem',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '600px',
    overflowY: 'auto',
    margin: '0 5vw',
    boxSizing: 'border-box',
  },
  lobbiesTitle: {
    fontSize: window.innerWidth <= 768 ? '1.1rem' : '1.3rem',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '0.75rem',
  },
  lobbyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.625rem',
    background: '#222',
    cursor: 'pointer',
    borderRadius: '0.5rem',
  },
  lobbyItemSelected: {
    background: '#333',
  },
  lobbyInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    fontWeight: 500,
    fontSize: window.innerWidth <= 768 ? '0.9rem' : '1.1rem',
  },
  lobbyDetails: {
    fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.9rem',
    color: '#ccc',
  },
  divider: {
    height: '1px',
    background: '#181818',
    margin: '0 1rem',
    border: 'none',
  },
  noLobbies: {
    color: '#ccc',
    textAlign: 'center',
    padding: '1rem',
    fontSize: window.innerWidth <= 768 ? '0.9rem' : '1.1rem',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modalContent: {
    background: '#222',
    border: '3px solid #aaa',
    borderRadius: '1rem',
    padding: window.innerWidth <= 768 ? '0.75rem' : '1rem',
    color: 'white',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.7)',
    width: window.innerWidth <= 768 ? '90%' : 'auto',
    boxSizing: 'border-box',
  },
  modalTitle: {
    fontSize: window.innerWidth <= 768 ? '1.1rem' : '1.3rem',
    fontWeight: 700,
    marginBottom: '0.75rem',
  },
  modalField: {
    marginBottom: '1rem',
  },
  modalLabel: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem',
  },
  modalInput: {
    width: '100%',
    padding: '0.5rem',
    background: '#333',
    border: '1px solid #aaa',
    borderRadius: '0.5rem',
    color: 'white',
    fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem',
  },
  modalButtons: {
    display: 'flex',
    gap: '0.5rem',
  },
  modalButton: {
    padding: '0.625rem',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'black',
    cursor: 'pointer',
    fontWeight: 500,
    flex: 1,
    fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem',
  },
};

export default AdminPanel;