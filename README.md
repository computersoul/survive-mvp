# Survive-MVP Documentation

> 🚧 **Work in Progress** 🚧
> 
> Survive-MVP is under active development, so you might encounter bugs or unfinished features.

## Project Overview

**Survive-MVP** is a multiplayer game implemented as a Telegram MiniApp. Players join lobbies, participate in elimination-based rounds, and compete until one winner remains. The application supports two roles:

- **Player**: Joins lobbies, waits for the game to start, and participates in rounds.
- **Admin**: Manages lobbies, starts games manually or via schedules, and oversees game progress.

## Game Rules

The rules are super simple. Each round starts a countdown timer, and when it hits zero, half the players are randomly knocked out—only the luckiest will survive to claim victory.

## Project Structure

```
survive-mvp/
├── bot/                # Telegram bot logic (bot.py)
├── web/
│   ├── backend/        # Node.js backend (server.js)
│   └── frontend/       # React frontend
├── .env.example        # Example environment variables
├── Dockerfile          # Build config for Python, Node.js, npm
├── docker-compose.yml  # Service orchestration
├── package.json        # Root and workspace configs
└── README.md           # Setup instructions
```

## Dependencies

- **Node.js**: >=18.0.0
- **npm**: >=8.0.0
- **Python**: 3.11
- **PostgreSQL**: 15
- **Docker**: Latest
- **Packages**:
  - `concurrently` (>=8.0.0)
  - **Frontend**: React dependencies (via `npm install`)
  - **Backend**: Express, ORM (via `npm install`)
  - **Bot**: Python libs (via `pip install -r requirements.txt`)

### Installation and Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/computersoul/survive-mvp.git
   cd survive-mvp
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.example .env
   ```
   Make sure you’ve correctly replaced all your variables in your environment.

3. **Build and run containers**:

   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Apply database migrations**:

   ```bash
   docker-compose run backend npx sequelize-cli db:migrate
   ```

5. **Access the application**:
   Fire up your Telegram app, send the /start command to your  bot, and enjoy the game.


## Database Schema

The application uses **PostgreSQL** with three tables: `users`, `lobbies`, and `settings`. The schemas below are derived from the provided Sequelize models and technical requirements.

### `users` Table

Stores user information, including Telegram ID, username, role, and associated lobby.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | BIGINT | PRIMARY KEY, NOT NULL | Unique Telegram user ID |
| username | VARCHAR | NOT NULL | User's Telegram username |
| role | VARCHAR | NOT NULL, DEFAULT 'player' | Role: 'player' or 'admin' |
| lobby_id | INTEGER | NULL | ID of the associated lobby |

### `lobbies` Table

Stores lobby data, including status, players, and round information.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique lobby ID |
| status | VARCHAR(20) | DEFAULT 'waiting' | Status: 'waiting', 'active', 'finished' |
| players | JSONB |  | Array of `{id, username, status}` |
| round_number | INTEGER | DEFAULT 0 | Current round number |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Lobby creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

### `settings` Table

Stores global game settings, such as maximum players and round start delay.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique setting ID |
| max_players | INTEGER | NOT NULL, DEFAULT 100 | Maximum players per lobby |
| start_delay | INTEGER | NOT NULL, DEFAULT 60 | Round start delay (seconds) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

