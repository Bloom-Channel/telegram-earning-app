const express = require('express');
const cors = require('cors');
const db = require('./database');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const FARM_AMOUNT = 100;
const COOLDOWN_SECONDS = 300; // 5 minutes
const WITHDRAWAL_FEE_PERCENT = 10; // 10% platform fee
const REFERRAL_BONUS = 500; // Coins earned by referrer when friend joins

// Get user data (with automatic referral bonus)
app.get('/api/user/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const username = req.query.username || 'anonymous';
    const referrerId = req.query.ref || null; // Get referrer from URL parameter
    
    // First, check if user exists
    db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            // NEW USER - Check if they came from a referral link
            if (referrerId && referrerId !== telegramId) {
                // Verify referrer exists
                db.get('SELECT telegram_id FROM users WHERE telegram_id = ?', [referrerId], (err, referrer) => {
                    if (referrer) {
                        // Award bonus to the referrer
                        db.run('UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE telegram_id = ?', 
                            [REFERRAL_BONUS, REFERRAL_BONUS, referrerId], (err) => {
                            if (!err) {
                                console.log(`✅ Referrer ${referrerId} earned ${REFERRAL_BONUS} coins for referring ${telegramId}`);
                            }
                        });
                    }
                    
                    // Create new user with referrer
                    db.run('INSERT INTO users (telegram_id, username, referrer_id) VALUES (?, ?, ?)',
                        [telegramId, username, referrerId], function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        return res.json({ balance: 0, total_earned: 0, last_farm_time: 0 });
                    });
                });
            } else {
                // Create user without referrer
                db.run('INSERT INTO users (telegram_id, username) VALUES (?, ?)',
                    [telegramId, username], function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    return res.json({ balance: 0, total_earned: 0, last_farm_time: 0 });
                });
            }
        } else {
            // Existing user - return their data
            res.json({
                balance: user.balance,
                total_earned: user.total_earned,
                last_farm_time: user.last_farm_time,
                referrer_id: user.referrer_id
            });
        }
    });
});

// Farm action - earn coins
app.post('/api/farm/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    
    db.get('SELECT last_farm_time, balance FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const now = Math.floor(Date.now() / 1000);
        const timeSinceLastFarm = now - (user.last_farm_time || 0);
        
        if (timeSinceLastFarm < COOLDOWN_SECONDS) {
            const waitTime = COOLDOWN_SECONDS - timeSinceLastFarm;
            return res.status(400).json({ 
                error: `Wait ${Math.ceil(waitTime / 60)} minutes`,
                nextAvailable: user.last_farm_time + COOLDOWN_SECONDS
            });
        }
        
        const newBalance = user.balance + FARM_AMOUNT;
        
        db.run('UPDATE users SET balance = ?, total_earned = total_earned + ?, last_farm_time = ? WHERE telegram_id = ?',
            [newBalance, FARM_AMOUNT, now, telegramId], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json({ 
                success: true, 
                earned: FARM_AMOUNT, 
                newBalance: newBalance,
                nextAvailable: now + COOLDOWN_SECONDS
            });
        });
    });
});

// Complete a task
app.post('/api/complete-task/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const { taskId, reward } = req.body;
    
    // Check if task already completed
    db.get('SELECT * FROM completed_tasks WHERE telegram_id = ? AND task_id = ?', 
        [telegramId, taskId], (err, existing) => {
        
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (existing) {
            return res.status(400).json({ error: 'Task already completed' });
        }
        
        // Get current user balance
        db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
            if (err || !user) {
                return res.status(500).json({ error: 'User not found' });
            }
            
            const newBalance = user.balance + reward;
            
            // Record completion and add reward
            db.run('BEGIN TRANSACTION');
            db.run('INSERT INTO completed_tasks (telegram_id, task_id, completed_at) VALUES (?, ?, ?)',
                [telegramId, taskId, Math.floor(Date.now() / 1000)]);
            db.run('UPDATE users SET balance = ?, total_earned = total_earned + ? WHERE telegram_id = ?',
                [newBalance, reward, telegramId]);
            db.run('COMMIT');
            
            res.json({ success: true, reward, newBalance: newBalance });
        });
    });
});

// Request withdrawal with fee
app.post('/api/withdraw/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const { amount } = req.body;
    const MIN_WITHDRAWAL = 5000;
    
    if (amount < MIN_WITHDRAWAL) {
        return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} coins` });
    }
    
    db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Calculate fee
        const fee = Math.floor(amount * WITHDRAWAL_FEE_PERCENT / 100);
        const userAmount = amount - fee;
        
        db.run('BEGIN TRANSACTION');
        db.run('UPDATE users SET balance = balance - ? WHERE telegram_id = ?', [amount, telegramId]);
        db.run('INSERT INTO withdrawals (telegram_id, amount, fee, status) VALUES (?, ?, ?, ?)',
            [telegramId, userAmount, fee, 'pending']);
        db.run('COMMIT');
        
        res.json({ 
            success: true, 
            message: `Withdrawal request submitted! Fee: ${fee} coins (${WITHDRAWAL_FEE_PERCENT}%)`,
            requestedAmount: userAmount,
            fee: fee
        });
    });
});

// Get referral stats
app.get('/api/referrals/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    
    db.all('SELECT telegram_id, username, total_earned FROM users WHERE referrer_id = ? ORDER BY created_at DESC',
        [telegramId], (err, referrals) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ count: referrals.length, referrals });
    });
});

// Check if task is completed (for invite task verification)
app.get('/api/check-task/:telegramId/:taskId', (req, res) => {
    const { telegramId, taskId } = req.params;
    
    db.get('SELECT * FROM completed_tasks WHERE telegram_id = ? AND task_id = ?',
        [telegramId, taskId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ completed: !!result });
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`💰 Withdrawal fee: ${WITHDRAWAL_FEE_PERCENT}%`);
    console.log(`🎁 Referral bonus: ${REFERRAL_BONUS} coins`);
});