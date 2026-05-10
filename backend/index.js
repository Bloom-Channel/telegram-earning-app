const express = require('express');
const cors = require('cors');
const db = require('./fileDatabase');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const FARM_AMOUNT = 100;
const COOLDOWN_SECONDS = 300; // 5 minutes

// Get user data
app.get('/api/user/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const username = req.query.username || 'anonymous';
    const referrerId = req.query.ref || null;
    
    let user = db.getUser(telegramId);
    
    if (!user) {
        user = db.createUser(telegramId, username, referrerId);
    }
    
    res.json({
        balance: user.balance,
        total_earned: user.total_earned,
        last_farm_time: user.last_farm_time
    });
});

// Farm action
app.post('/api/farm/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    
    let user = db.getUser(telegramId);
    
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
    const newTotalEarned = user.total_earned + FARM_AMOUNT;
    
    db.updateUser(telegramId, {
        balance: newBalance,
        total_earned: newTotalEarned,
        last_farm_time: now
    });
    
    res.json({
        success: true,
        earned: FARM_AMOUNT,
        newBalance: newBalance,
        nextAvailable: now + COOLDOWN_SECONDS
    });
});

// Complete a task
app.post('/api/complete-task/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const { taskId, reward } = req.body;
    
    if (db.isTaskCompleted(telegramId, taskId)) {
        return res.status(400).json({ error: 'Task already completed' });
    }
    
    const user = db.getUser(telegramId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const newBalance = user.balance + reward;
    const newTotalEarned = user.total_earned + reward;
    
    db.updateUser(telegramId, {
        balance: newBalance,
        total_earned: newTotalEarned
    });
    
    db.completeTask(telegramId, taskId, Math.floor(Date.now() / 1000));
    
    res.json({
        success: true,
        reward: reward,
        newBalance: newBalance
    });
});


// Request withdrawal with fee
app.post('/api/withdraw/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const { amount } = req.body;
    const MIN_WITHDRAWAL = 5000;
    const WITHDRAWAL_FEE_PERCENT = 10; // 10% platform fee
    
    if (amount < MIN_WITHDRAWAL) {
        return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} coins` });
    }
    
    db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
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
        db.run(
            'INSERT INTO withdrawals (telegram_id, amount, fee, status) VALUES (?, ?, ?, ?)',
            [telegramId, userAmount, fee, 'pending']
        );
        db.run('COMMIT');
        
        res.json({ 
            success: true, 
            message: `Withdrawal request submitted. Fee: ${fee} coins (${WITHDRAWAL_FEE_PERCENT}%)`, 
            requestedAmount: userAmount 
        });
    });
});

// Get referral stats
app.get('/api/referrals/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const referrals = db.getReferrals(telegramId);
    res.json({ count: referrals.length, referrals });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// Create Stars purchase order
app.post('/api/create-star-order', (req, res) => {
    const { telegramId, packId } = req.body;
    
    // Define packs
    const packs = {
        small: { stars: 5, coins: 500 },
        medium: { stars: 20, coins: 2500 },
        large: { stars: 50, coins: 7500 },
        premium: { stars: 100, coins: 0, premium: true }
    };
    
    const pack = packs[packId];
    if (!pack) {
        return res.status(400).json({ error: 'Invalid pack' });
    }
    
    // Create order in database
    const orderId = Math.random().toString(36).substring(7);
    db.run(
        'INSERT INTO orders (order_id, telegram_id, pack_id, stars, coins, status) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, telegramId, packId, pack.stars, pack.coins, 'pending']
    );
    
    // Return invoice link (you'll need to generate this via Telegram API)
    res.json({ 
        orderId: orderId,
        stars: pack.stars,
        coins: pack.coins,
        invoice_link: `https://t.me/$YOUR_BOT_USERNAME/invoice?start=${orderId}`
    });
});

// Verify purchase and grant coins
app.post('/api/verify-star-purchase', (req, res) => {
    const { orderId, telegramId } = req.body;
    
    db.get('SELECT * FROM orders WHERE order_id = ? AND telegram_id = ?', [orderId, telegramId], (err, order) => {
        if (!order || order.status !== 'pending') {
            return res.status(400).json({ error: 'Invalid order' });
        }
        
        // Grant coins to user
        db.run('UPDATE users SET balance = balance + ? WHERE telegram_id = ?', [order.coins, telegramId]);
        db.run('UPDATE orders SET status = ? WHERE order_id = ?', ['completed', orderId]);
        
        res.json({ success: true, coins: order.coins });
    });
});