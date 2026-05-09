const express = require('express');
const cors = require('cors');
const db = require('./database');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Get user data
app.get('/api/user/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  
  try {
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    
    if (!user) {
      // Create new user
      db.prepare('INSERT INTO users (telegram_id, username) VALUES (?, ?)').run(telegramId, req.query.username || 'anonymous');
      user = { balance: 0, total_earned: 0, last_farm_time: 0 };
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Farm action - earn coins
app.post('/api/farm/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  const FARM_AMOUNT = 100;
  const COOLDOWN_SECONDS = 300; // 5 minutes
  
  try {
    const user = db.prepare('SELECT last_farm_time FROM users WHERE telegram_id = ?').get(telegramId);
    
    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastFarm = now - (user?.last_farm_time || 0);
    
    if (timeSinceLastFarm < COOLDOWN_SECONDS) {
      const waitTime = COOLDOWN_SECONDS - timeSinceLastFarm;
      return res.status(400).json({ 
        error: `Wait ${Math.ceil(waitTime / 60)} minutes`,
        nextAvailable: user.last_farm_time + COOLDOWN_SECONDS
      });
    }
    
    db.prepare('UPDATE users SET balance = balance + ?, total_earned = total_earned + ?, last_farm_time = ? WHERE telegram_id = ?')
      .run(FARM_AMOUNT, FARM_AMOUNT, now, telegramId);
    
    const updated = db.prepare('SELECT balance FROM users WHERE telegram_id = ?').get(telegramId);
    
    res.json({ 
      success: true, 
      earned: FARM_AMOUNT, 
      newBalance: updated.balance,
      nextAvailable: now + COOLDOWN_SECONDS
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete a task
app.post('/api/complete-task/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  const { taskId, reward } = req.body;
  
  try {
    const existing = db.prepare('SELECT * FROM completed_tasks WHERE telegram_id = ? AND task_id = ?').get(telegramId, taskId);
    
    if (existing) {
      return res.status(400).json({ error: 'Task already completed' });
    }
    
    db.prepare('INSERT INTO completed_tasks (telegram_id, task_id, completed_at) VALUES (?, ?, ?)')
      .run(telegramId, taskId, Math.floor(Date.now() / 1000));
    
    db.prepare('UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE telegram_id = ?')
      .run(reward, reward, telegramId);
    
    const user = db.prepare('SELECT balance FROM users WHERE telegram_id = ?').get(telegramId);
    res.json({ success: true, reward, newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request withdrawal
app.post('/api/withdraw/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  const { amount } = req.body;
  const MIN_WITHDRAWAL = 5000;
  
  if (amount < MIN_WITHDRAWAL) {
    return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} coins` });
  }
  
  try {
    const user = db.prepare('SELECT balance FROM users WHERE telegram_id = ?').get(telegramId);
    
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    db.prepare('UPDATE users SET balance = balance - ? WHERE telegram_id = ?').run(amount, telegramId);
    db.prepare('INSERT INTO withdrawals (telegram_id, amount) VALUES (?, ?)').run(telegramId, amount);
    
    res.json({ success: true, message: 'Withdrawal request submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get referral stats
app.get('/api/referrals/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  
  try {
    const referrals = db.prepare('SELECT telegram_id, username, total_earned FROM users WHERE referrer_id = ? ORDER BY created_at DESC').all(telegramId);
    res.json({ count: referrals.length, referrals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));