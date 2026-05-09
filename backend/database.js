const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'earnings.db'));

// Initialize database tables
db.serialize(() => {
  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS completed_tasks (
      telegram_id TEXT,
      task_id TEXT,
      completed_at INTEGER,
      PRIMARY KEY (telegram_id, task_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      amount INTEGER,
      status TEXT DEFAULT 'pending',
      requested_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
});

module.exports = db;