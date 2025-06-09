const express = require('express');
const morgan = require('morgan');
const { Sequelize, Op } = require('sequelize');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Load .env variables
const dotenvPath = path.resolve(__dirname, '../../.env');
try {
  const envContent = fs.readFileSync(dotenvPath, 'utf8');
  const parsed = require('dotenv').parse(envContent);
  Object.assign(process.env, parsed);
} catch (error) {
  console.error(`Failed to load .env: ${error.message}`);
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(morgan('combined'));
app.use(cors({
  origin: [process.env.VITE_FRONTEND_DOMAIN, process.env.VITE_BACKEND_DOMAIN],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
}));

// Database setup
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    dialect: 'postgres',
    logging: (msg) => console.log(`[SQL] ${msg}`), // Enable SQL logging for debugging
  }
);

const User = require('./models/user')(sequelize, Sequelize.DataTypes);
const Lobby = require('./models/lobby')(sequelize, Sequelize.DataTypes);
const Settings = sequelize.define('Settings', {
  max_players: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  start_delay: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 60,
  },
}, {
  timestamps: true,
});

// Utility function to send standardized API responses
const sendResponse = (res, statusCode, ok, message, result = null) => {
  const response = { ok, message };
  if (result !== null && result !== undefined) response.result = result;
  res.status(statusCode).json(response);
};

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    // Ensure default settings exist
    const existingSettings = await Settings.findOne();
    if (!existingSettings) {
      await Settings.create({ max_players: 100, start_delay: 60 });
      console.log('Default settings created');
    }
    console.log('Database connection established successfully');
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

// Sync admin role from environment variable
const syncAdminsFromEnv = async () => {
  const adminId = process.env.ADMIN_ID?.trim() || '12345';
  if (!adminId) throw new Error('ADMIN_ID not found in .env');
  if (isNaN(adminId)) throw new Error(`Invalid admin ID: ${adminId}`);
  await sequelize.transaction(async (t) => {
    await User.update({ role: 'admin' }, { where: { id: adminId }, transaction: t });
    await User.update(
      { role: 'player' },
      { where: { id: { [Op.ne]: adminId }, role: 'admin' }, transaction: t }
    );
  });
};

// Get default lobby settings from database
const getDefaultSettings = async () => {
  const settings = await Settings.findOne() || { max_players: 100, start_delay: 60 };
  return {
    max_players: settings.max_players,
    start_delay: settings.start_delay,
  };
};

// In-memory storage for lobby results
const lobbyResults = {};

/**
 * Create a new user
 * @route POST /users
 */
app.post('/users', async (req, res) => {
  const { id, username, role = 'player' } = req.body;
  if (!id || !username) return sendResponse(res, 400, false, 'id and username are required');
  try {
    const userExists = await User.findByPk(id.toString());
    if (userExists) return sendResponse(res, 409, false, 'user already exists');
    const newUser = await User.create({
      id: id.toString(),
      username: username.toString(),
      role,
      lobby_id: null,
    });
    return sendResponse(res, 200, true, 'user created', {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return sendResponse(res, 500, false, `Failed to create user: ${error.message}`);
  }
});

/**
 * Get all users
 * @route GET /users
 */
app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'role', 'lobby_id']
    });
    return sendResponse(res, 200, true, 'users retrieved', {
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        lobby_id: u.lobby_id,
      })),
    });
  } catch (error) {
    console.error('Error retrieving users:', error);
    return sendResponse(res, 500, false, `Failed to retrieve users: ${error.message}`);
  }
});

/**
 * Get a specific user
 * @route GET /users/:id
 */
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'role', 'lobby_id']
    });
    if (!user) return sendResponse(res, 404, false, 'user not found');
    return sendResponse(res, 200, true, 'user retrieved', {
      id: user.id,
      username: user.username,
      role: user.role,
      lobby_id: user.lobby_id,
    });
  } catch (error) {
    console.error('Error retrieving user:', error);
    return sendResponse(res, 500, false, `Failed to retrieve user: ${error.message}`);
  }
});

/**
 * Update user role
 * @route POST /users/:id/role
 */
app.post('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!role || !['player', 'admin'].includes(role)) {
    return sendResponse(res, 400, false, 'valid role is required');
  }
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return sendResponse(res, 404, false, 'user not found');
    await user.update({ role });
    return sendResponse(res, 200, true, 'role updated', {
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return sendResponse(res, 500, false, `Failed to update role: ${error.message}`);
  }
});

/**
 * Create a new lobby
 * @route POST /lobbies
 */
app.post('/lobbies', async (req, res) => {
  const { admin_id, start_delay, max_players } = req.body;
  console.log('Received lobby creation request:', { admin_id, start_delay, max_players });
  if (!admin_id) return sendResponse(res, 400, false, 'admin_id is required');
  try {
    const admin = await User.findByPk(admin_id.toString());
    if (!admin) return sendResponse(res, 404, false, 'admin not found');
    const defaults = await getDefaultSettings();
    const lobby = await Lobby.create({
      admin_id: admin_id.toString(),
      status: 'waiting',
      players_count: 0,
      start_delay: start_delay || defaults.start_delay,
      max_players: max_players || defaults.max_players,
    });
    console.log('Lobby created successfully:', lobby.toJSON());
    return sendResponse(res, 201, true, 'lobby created', {
      id: lobby.id,
      admin_id: lobby.admin_id,
      status: lobby.status,
      players_count: lobby.players_count,
      start_delay: lobby.start_delay,
      max_players: lobby.max_players,
    });
  } catch (error) {
    console.error('Error creating lobby:', error.stack);
    return sendResponse(res, 500, false, `Failed to create lobby: ${error.message}`);
  }
});

/**
 * Get all lobbies
 * @route GET /lobbies
 */
app.get('/lobbies', async (req, res) => {
  const { admin_id } = req.query;
  try {
    const user = await User.findByPk(admin_id?.toString());
    const where = {};
    if (user && user.role !== 'admin') {
      where.admin_id = admin_id?.toString();
    }
    const lobbies = await Lobby.findAll({ where });
    const lobbiesWithPlayers = await Promise.all(
      lobbies.map(async (lobby) => {
        const players = await User.findAll({
          where: { lobby_id: lobby.id },
          attributes: ['id', 'username', 'role']
        });
        return {
          id: lobby.id,
          admin_id: lobby.admin_id,
          status: lobby.status,
          players_count: players.length,
          start_delay: lobby.start_delay,
          max_players: lobby.max_players,
          players: players.map(p => ({
            id: p.id,
            username: p.username,
            role: p.role,
          })),
        };
      })
    );
    return sendResponse(res, 200, true, 'lobbies retrieved', lobbiesWithPlayers);
  } catch (error) {
    console.error('Error retrieving lobbies:', error);
    return sendResponse(res, 500, false, `Failed to retrieve lobbies: ${error.message}`);
  }
});

/**
 * Get a specific lobby
 * @route GET /lobbies/:id
 */
app.get('/lobbies/:id', async (req, res) => {
  try {
    const lobby = await Lobby.findByPk(req.params.id);
    if (!lobby) return sendResponse(res, 404, false, 'lobby not found');
    const players = await User.findAll({
      where: { lobby_id: lobby.id },
      attributes: ['id', 'username', 'role']
    });
    const result = {
      id: lobby.id,
      admin_id: lobby.admin_id,
      status: lobby.status,
      players_count: players.length,
      start_delay: lobby.start_delay,
      max_players: lobby.max_players,
      players: players.map(p => ({
        id: p.id,
        username: p.username,
        role: p.role,
      })),
    };
    if (lobby.status === 'finished' && lobbyResults[lobby.id]) {
      result.leaderboard = lobbyResults[lobby.id].leaderboard;
      result.winner = lobbyResults[lobby.id].winner;
    }
    return sendResponse(res, 200, true, 'lobby retrieved', result);
  } catch (error) {
    console.error('Error retrieving lobby:', error);
    return sendResponse(res, 500, false, `Failed to retrieve lobby: ${error.message}`);
  }
});

/**
 * Get players in a specific lobby
 * @route GET /lobbies/:id/players
 */
app.get('/lobbies/:id/players', async (req, res) => {
  try {
    const lobby = await Lobby.findByPk(req.params.id);
    if (!lobby) return sendResponse(res, 404, false, 'lobby not found');
    const players = await User.findAll({
      where: { lobby_id: lobby.id },
      attributes: ['id', 'username', 'role', 'lobby_id']
    });
    return sendResponse(res, 200, true, 'players retrieved', {
      players: players.map(p => ({
        id: p.id,
        username: p.username,
        role: p.role,
        lobby_id: p.lobby_id,
      })),
    });
  } catch (error) {
    console.error('Error retrieving players:', error);
    return sendResponse(res, 500, false, `Failed to retrieve players: ${error.message}`);
  }
});

/**
 * Join a lobby
 * @route POST /lobbies/:id/join
 */
app.post('/lobbies/:id/join', async (req, res) => {
  const { user_id } = req.body;
  const lobbyId = req.params.id;
  const t = await sequelize.transaction();
  try {
    const [lobby, user] = await Promise.all([
      Lobby.findByPk(lobbyId, { transaction: t }),
      User.findByPk(user_id.toString(), { transaction: t }),
    ]);
    if (!lobby) {
      await t.rollback();
      return sendResponse(res, 400, false, 'lobby not found');
    }
    if (!user) {
      await t.rollback();
      return sendResponse(res, 400, false, 'user not found');
    }
    await user.update({ lobby_id: lobbyId }, { transaction: t });
    await t.commit();
    return sendResponse(res, 200, true, 'joined lobby', {
      lobby: { id: lobby.id, admin_id: lobby.admin_id, status: lobby.status },
    });
  } catch (error) {
    await t.rollback();
    console.error('Error joining lobby:', error);
    return sendResponse(res, 500, false, `Failed to join lobby: ${error.message}`);
  }
});

/**
 * Delete a lobby
 * @route DELETE /lobbies/:id
 */
app.delete('/lobbies/:id', async (req, res) => {
  const { admin_id } = req.body;
  try {
    const lobby = await Lobby.findByPk(req.params.id);
    if (!lobby) return sendResponse(res, 404, false, 'lobby not found');
    const user = await User.findByPk(admin_id.toString());
    if (!user || (user.role !== 'admin' && admin_id.toString() !== lobby.admin_id)) {
      return sendResponse(res, 403, false, 'only admin can delete lobby');
    }
    await sequelize.transaction(async (t) => {
      await User.update({ lobby_id: null }, { where: { lobby_id: lobby.id }, transaction: t });
      await lobby.destroy({ transaction: t });
    });
    return sendResponse(res, 200, true, 'lobby deleted');
  } catch (error) {
    console.error('Error deleting lobby:', error);
    return sendResponse(res, 500, false, `Failed to delete lobby: ${error.message}`);
  }
});

/**
 * Shuffle array for random elimination
 */
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Complete a game and retrieve leaderboard
 * @route GET /lobbies/:id/complete
 */
app.get('/lobbies/:id/complete', async (req, res) => {
  const id = req.params.id;

  console.log('[BACKEND COMPLETE] Retrieving leaderboard for lobby:', id);

  try {
    const lobby = await Lobby.findByPk(id);
    if (!lobby) return sendResponse(res, 404, false, 'lobby not found');

    if (lobby.status === 'finished' && lobbyResults[id]) {
      return sendResponse(res, 200, true, 'leaderboard retrieved', lobbyResults[id]);
    }

    let players = await User.findAll({
      where: { lobby_id: id },
      attributes: ['id', 'username', 'lobby_id']
    });
    console.log('[BACKEND COMPLETE] Players:', players.map(u => ({ id: u.id, username: u.username, lobby_id: u.lobby_id })));

    const leaderboard = [];
    let winner = null;

    if (players.length === 0) {
      await lobby.update({ status: 'finished' });
      lobbyResults[id] = { leaderboard: [], winner: null };
      return sendResponse(res, 200, true, 'leaderboard retrieved with no players', lobbyResults[id]);
    } else if (players.length === 1) {
      leaderboard.push({
        user_id: players[0].id,
        username: players[0].username,
        eliminated_round: null,
      });
      winner = {
        user_id: players[0].id,
        username: players[0].username,
      };
    } else {
      let round = 1;
      let activePlayers = shuffle(players.slice());

      while (activePlayers.length > 1) {
        const toEliminateCount = Math.ceil(activePlayers.length / 2);
        const eliminated = activePlayers.slice(0, toEliminateCount);

        eliminated.forEach(p =>
          leaderboard.push({
            user_id: p.id,
            username: p.username,
            eliminated_round: round,
          })
        );
        activePlayers = activePlayers.slice(toEliminateCount);
        round++;
      }

      if (activePlayers.length === 1) {
        leaderboard.push({
          user_id: activePlayers[0].id,
          username: activePlayers[0].username,
          eliminated_round: null,
        });
        winner = {
          user_id: activePlayers[0].id,
          username: activePlayers[0].username,
        };
      }
    }

    lobbyResults[id] = { leaderboard, winner };
    await lobby.update({ status: 'finished' });
    console.log('[BACKEND COMPLETE] Leaderboard:', leaderboard, 'Winner:', winner);
    return sendResponse(res, 200, true, 'leaderboard retrieved', lobbyResults[id]);
  } catch (error) {
    console.error('[BACKEND COMPLETE] Error:', error.message, error.stack);
    return sendResponse(res, 500, false, `Failed to retrieve leaderboard: ${error.message}`);
  }
});

/**
 * Exit a lobby
 * @route POST /lobbies/:id/exit
 */
app.post('/lobbies/:id/exit', async (req, res) => {
  const { user_id } = req.body;
  const lobbyId = req.params.id;
  const t = await sequelize.transaction();
  try {
    const [lobby, user] = await Promise.all([
      Lobby.findByPk(lobbyId, { transaction: t }),
      User.findByPk(user_id.toString(), { transaction: t }),
    ]);
    if (!lobby) {
      await t.rollback();
      return sendResponse(res, 404, false, 'lobby not found');
    }
    if (!user) {
      await t.rollback();
      return sendResponse(res, 400, false, 'user not found');
    }
    if (user.lobby_id !== lobbyId) {
      await t.rollback();
      return sendResponse(res, 400, false, 'user not in this lobby');
    }
    await user.update({ lobby_id: null }, { transaction: t });
    await t.commit();
    return sendResponse(res, 200, true, 'user exited lobby', {
      lobby: { id: lobby.id, admin_id: lobby.admin_id, status: lobby.status },
    });
  } catch (error) {
    await t.rollback();
    console.error('Error exiting lobby:', error);
    return sendResponse(res, 500, false, `Failed to exit lobby: ${error.message}`);
  }
});

/**
 * Reset lobby for all players (clear lobby_id)
 * @route POST /lobbies/:id/reset
 */
app.post('/lobbies/:id/reset', async (req, res) => {
  const { user_id } = req.body;
  const lobbyId = req.params.id;
  const t = await sequelize.transaction();
  try {
    const lobby = await Lobby.findByPk(lobbyId, { transaction: t });
    if (!lobby) {
      await t.rollback();
      return sendResponse(res, 404, false, 'lobby not found');
    }
    const user = await User.findByPk(user_id.toString(), { transaction: t });
    if (!user) {
      await t.rollback();
      return sendResponse(res, 404, false, 'user not found');
    }
    await User.update(
      { lobby_id: null },
      { where: { lobby_id: lobbyId }, transaction: t }
    );
    await t.commit();
    return sendResponse(res, 200, true, 'lobby reset for all players');
  } catch (error) {
    await t.rollback();
    console.error('Error resetting lobby:', error);
    return sendResponse(res, 500, false, `Failed to reset lobby: ${error.message}`);
  }
});

/**
 * Update lobby settings (save to database)
 * @route POST /settings
 */
app.post('/settings', async (req, res) => {
  const { max_players, start_delay } = req.body;
  if (!max_players || !start_delay || isNaN(max_players) || isNaN(start_delay) || max_players < 1 || start_delay < 5) {
    return sendResponse(res, 400, false, 'Invalid max_players or start_delay');
  }
  try {
    await Settings.update(
      { max_players, start_delay },
      { where: {} } // Update all settings records (only one expected)
    );
    return sendResponse(res, 200, true, 'Settings updated successfully');
  } catch (error) {
    console.error('Error updating settings:', error);
    return sendResponse(res, 500, false, `Failed to update settings: ${error.message}`);
  }
});

/**
 * Get lobby settings from database
 * @route GET /settings
 */
app.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne() || await Settings.create({ max_players: 100, start_delay: 60 });
    return sendResponse(res, 200, true, 'Settings retrieved successfully', {
      max_players: settings.max_players,
      start_delay: settings.start_delay,
    });
  } catch (error) {
    console.error('Error retrieving settings:', error);
    return sendResponse(res, 500, false, `Failed to retrieve settings: ${error.message}`);
  }
});

/**
 * Health check
 * @route GET /health
 */
app.get('/health', (req, res) => res.send('Server is healthy!'));

// Start the server
const startServer = async () => {
  await initializeDatabase();
  await syncAdminsFromEnv();
  const port = parseInt(process.env.PORT, 10) || 2000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer();