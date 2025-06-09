module.exports = (sequelize, DataTypes) => {
  const Settings = sequelize.define('settings', {
    max_players: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    start_delay: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
    },
  }, {
    timestamps: true,
    tableName: 'settings',
  });
  return Settings;
};