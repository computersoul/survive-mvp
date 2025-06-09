/**
 * API client for interacting with the game backend.
 * Provides functions for user and lobby management.
 */

const BASE_URL = import.meta.env.VITE_BACKEND_DOMAIN;

/**
 * Generic API call function
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object} [data] - Request body for POST/PATCH requests
 * @returns {Promise<Object>} API response
 */
const callApi = async (endpoint, method = 'GET', data = null) => {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  };
  if (data && method !== 'GET' && method !== 'HEAD') {
    options.body = JSON.stringify(data);
  }
  try {
    const response = await fetch(url, options);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${json.message || 'Unknown error'}`);
    }
    return json;
  } catch (error) {
    console.error(`API call failed for ${method} ${url}:`, error.message);
    throw error;
  }
};

// User API
export const createUser = (id, username, role = 'player') =>
  callApi('/users', 'POST', { id: id.toString(), username, role });
export const getUser = (id) => callApi(`/users/${id.toString()}`);
export const getUsers = () => callApi('/users');
export const setUserRole = (id, role) => callApi(`/users/${id.toString()}/role`, 'POST', { role });
export const updateUser = (userId, data) => callApi(`/users/${userId.toString()}`, 'PATCH', data);

// Lobby API
export const createLobby = async (admin_id, settings) => {
  // Ensure numeric values are sent as numbers
  const payload = {
    admin_id: Number(admin_id),
    start_delay: Number(settings.start_delay),
    max_players: Number(settings.max_players),
  };
  console.log('Sending create lobby payload:', payload); // Debug log
  return await callApi('/lobbies', 'POST', payload);
};
export const joinLobby = (lobbyId, userId) =>
  callApi(`/lobbies/${lobbyId}/join`, 'POST', { user_id: userId.toString() });
export const completeGame = (lobbyId) => callApi(`/lobbies/${lobbyId}/complete`, 'GET');
export const resetLobby = (lobbyId, userId) =>
  callApi(`/lobbies/${lobbyId}/reset`, 'POST', { user_id: userId.toString() });
export const exitLobby = (lobbyId, userId) =>
  callApi(`/lobbies/${lobbyId}/exit`, 'POST', { user_id: userId.toString() });
export const getLobby = (lobbyId) => callApi(`/lobbies/${lobbyId}`);
export const getLobbies = (userId) =>
  callApi(`/lobbies${userId ? `?admin_id=${userId.toString()}` : ''}`);
export const deleteLobby = (lobbyId, userId) =>
  callApi(`/lobbies/${lobbyId}`, 'DELETE', { admin_id: userId.toString() });
export const getLobbyPlayers = (lobbyId) => callApi(`/lobbies/${lobbyId}/players`);

// Settings/Health
export const updateSettings = (settings) => callApi('/settings', 'POST', settings);
export const getSettings = () => callApi('/settings');
export const getHealth = () => callApi('/health');

export { callApi };