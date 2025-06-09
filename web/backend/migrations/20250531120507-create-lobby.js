module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('lobbies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      admin_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'waiting',
      },
      players_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      start_delay: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      max_players: { 
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('lobbies');
  },
};