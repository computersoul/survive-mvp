module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'player' },
    lobby_id: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'users',
    timestamps: false,
  });
  return User;
};
