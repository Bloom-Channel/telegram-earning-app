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

// Request withdrawal
app.post('/api/withdraw/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const { amount } = req.body;
    const MIN_WITHDRAWAL = 5000;
    
    if (amount < MIN_WITHDRAWAL) {
        return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} coins` });
    }
    
    const user = db.getUser(telegramId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const newBalance = user.balance - amount;
    db.updateUser(telegramId, { balance: newBalance });
    db.addWithdrawal(telegramId, amount);
    
    res.json({ success: true, message: 'Withdrawal request submitted' });
});

// Get referral stats
app.get('/api/referrals/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    const referrals = db.getReferrals(telegramId);
    res.json({ count: referrals.length, referrals });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));