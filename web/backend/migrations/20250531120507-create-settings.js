module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('settings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
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
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('settings');
  },
};
