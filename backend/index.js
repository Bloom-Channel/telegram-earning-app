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
  
  db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (!user) {
      db.run(
        'INSERT INTO users (telegram_id, username) VALUES (?, ?)',
        [telegramId, req.query.username || 'anonymous'],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          return res.json({ balance: 0, total_earned: 0, last_farm_time: 0 });
        }
      );
    } else {
      res.json(user);
    }
  });
});

// Farm action - earn coins
app.post('/api/farm/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  const FARM_AMOUNT = 100;
  const COOLDOWN_SECONDS = 300; // 5 minutes
  
  db.get('SELECT last_farm_time FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastFarm = now - (user?.last_farm_time || 0);
    
    if (timeSinceLastFarm < COOLDOWN_SECONDS) {
      const waitTime = COOLDOWN_SECONDS - timeSinceLastFarm;
      return res.status(400).json({ 
        error: `Wait ${Math.ceil(waitTime / 60)} minutes`,
        nextAvailable: user.last_farm_time + COOLDOWN_SECONDS
      });
    }
    
    db.run(
      'UPDATE users SET balance = balance + ?, total_earned = total_earned + ?, last_farm_time = ? WHERE telegram_id = ?',
      [FARM_AMOUNT, FARM_AMOUNT, now, telegramId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegramId], (err, updated) => {
          res.json({ 
            success: true, 
            earned: FARM_AMOUNT, 
            newBalance: updated.balance,
            nextAvailable: now + COOLDOWN_SECONDS
          });
        });
      }
    );
  });
});

// Complete a task
app.post('/api/complete-task/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  const { taskId, reward } = req.body;
  
  db.get(
    'SELECT * FROM completed_tasks WHERE telegram_id = ? AND task_id = ?',
    [telegramId, taskId],
    (err, existing) => {
      if (existing) {
        return res.status(400).json({ error: 'Task already completed' });
      }
      
      db.serialize(() => {
        db.run(
          'INSERT INTO completed_tasks (telegram_id, task_id, completed_at) VALUES (?, ?, ?)',
          [telegramId, taskId, Math.floor(Date.now() / 1000)]
        );
        
        db.run(
          'UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE telegram_id = ?',
          [reward, reward, telegramId]
        );
        
        db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
          res.json({ success: true, reward, newBalance: user.balance });
        });
      });
    }
  );
});

// Request withdrawal
app.post('/api/withdraw/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  const { amount } = req.body;
  const MIN_WITHDRAWAL = 5000;
  
  if (amount < MIN_WITHDRAWAL) {
    return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} coins` });
  }
  
  db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    db.run('BEGIN TRANSACTION');
    db.run('UPDATE users SET balance = balance - ? WHERE telegram_id = ?', [amount, telegramId]);
    db.run(
      'INSERT INTO withdrawals (telegram_id, amount) VALUES (?, ?)',
      [telegramId, amount]
    );
    db.run('COMMIT');
    
    res.json({ success: true, message: 'Withdrawal request submitted' });
  });
});

// Get referral stats
app.get('/api/referrals/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  
  db.all(
    'SELECT telegram_id, username, total_earned FROM users WHERE referrer_id = ? ORDER BY created_at DESC',
    [telegramId],
    (err, referrals) => {
      res.json({ count: referrals.length, referrals });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));