module.exports = (sequelize, DataTypes) => {
  const Lobby = sequelize.define('lobby', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    admin_id: { type: DataTypes.BIGINT, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'waiting' },
    players_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    start_delay: { type: DataTypes.INTEGER, allowNull: true },
    max_players: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 }, // Новая колонка
  }, {
    tableName: 'lobbies',
    timestamps: false,
  });
  return Lobby;
};