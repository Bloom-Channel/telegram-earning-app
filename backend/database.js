const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'earnings.db'));

// Initialize database tables (synchronous API)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    balance INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    last_farm_time INTEGER DEFAULT 0,
    referrer_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS completed_tasks (
    telegram_id TEXT,
    task_id TEXT,
    completed_at INTEGER,
    PRIMARY KEY (telegram_id, task_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    amount INTEGER,
    status TEXT DEFAULT 'pending',
    requested_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

module.exports = db;