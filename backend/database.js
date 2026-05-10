const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
    const initialData = {
        users: {},
        completedTasks: [],
        withdrawals: [],
        nextId: 1
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
}

// Helper to read database
function readDB() {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

// Helper to write database
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// User functions
function getUser(telegramId) {
    const db = readDB();
    return db.users[telegramId] || null;
}

function createUser(telegramId, username, referrerId = null) {
    const db = readDB();
    
    if (db.users[telegramId]) {
        return db.users[telegramId];
    }
    
    const newUser = {
        telegram_id: telegramId,
        username: username || 'anonymous',
        balance: 0,
        total_earned: 0,
        last_farm_time: 0,
        referrer_id: referrerId,
        created_at: Math.floor(Date.now() / 1000)
    };
    
    db.users[telegramId] = newUser;
    writeDB(db);
    return newUser;
}

function updateUser(telegramId, updates) {
    const db = readDB();
    if (db.users[telegramId]) {
        db.users[telegramId] = { ...db.users[telegramId], ...updates };
        writeDB(db);
        return db.users[telegramId];
    }
    return null;
}

// Task functions
function isTaskCompleted(telegramId, taskId) {
    const db = readDB();
    return db.completedTasks.some(t => t.telegram_id === telegramId && t.task_id === taskId);
}

function completeTask(telegramId, taskId, completedAt) {
    const db = readDB();
    db.completedTasks.push({
        telegram_id: telegramId,
        task_id: taskId,
        completed_at: completedAt
    });
    writeDB(db);
}

// wWithdrawal function
function addWithdrawal(telegramId, amount, fee = 0) {
    const db = readDB();
    const withdrawal = {
        id: db.nextId++,
        telegram_id: telegramId,
        amount: amount,
        fee: fee,
        status: 'pending',
        requested_at: Math.floor(Date.now() / 1000)
    };
    db.withdrawals.push(withdrawal);
    writeDB(db);
    return withdrawal;
}

// Referral functions
function getReferrals(telegramId) {
    const db = readDB();
    const referrals = [];
    for (const [id, user] of Object.entries(db.users)) {
        if (user.referrer_id === telegramId) {
            referrals.push({
                telegram_id: id,
                username: user.username,
                total_earned: user.total_earned
            });
        }
    }
    return referrals;
}

module.exports = {
    getUser,
    createUser,
    updateUser,
    isTaskCompleted,
    completeTask,
    addWithdrawal,
    getReferrals
};