# Survive-MVP Documentation

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

## Quickstart
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/computersoul/survive-mvp.git
   cd survive-mvp
   ```
2. **Configure Environment**:
   Copy .env.example to .env and set variables (e.g., DB_USER, DB_PASSWORD, TELEGRAM_BOT_TOKEN).
3. **Build and run containers**:
   ```
   docker compose build
   docker compose up -d
   ```
4. **Apply Migrations**:
   ```
   docker-compose up migrate
   ```
5. **Open in browser**
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:3000](http://localhost:3000)

