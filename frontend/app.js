// PRODUCTION CONFIGURATION - CoinFarm
const API_URL = 'https://telegram-earning-app.onrender.com/api';

// Your actual Telegram bot username (without @)
const BOT_USERNAME = 'TGDock2026_bot';

// Your community links
const COMMUNITY_LINKS = {
    group: 'https://t.me/Coinfarm_chat',
    channel: 'https://t.me/coinfarm_updates'
};

let tg = window.Telegram.WebApp;
tg.expand(); // Expand to full screen

let userData = null;

// Tasks configuration
const TASKS = [
    { id: 'join_channel', name: 'Join Our Channel', reward: 500, url: COMMUNITY_LINKS.channel },
    { id: 'join_group', name: 'Join Community Group', reward: 300, url: COMMUNITY_LINKS.group },
    { id: 'invite_friend', name: 'Invite 1 Friend', reward: 1000, url: null, special: 'referral' }
];

// Initialize
async function init() {
    const telegramId = tg.initDataUnsafe?.user?.id;
    const username = tg.initDataUnsafe?.user?.username;
    
    if (!telegramId) {
        showToast('Please open this app from Telegram');
        return;
    }
    
    // Check for referral in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const referrerId = urlParams.get('ref');
    
    // Load user data
    await loadUserData(telegramId, username, referrerId);
    loadTasks();
    loadReferralStats();
    updateReferralLinkDisplay(telegramId);
    
    // Setup event listeners
    document.getElementById('farmButton').addEventListener('click', () => farm(telegramId));
    document.getElementById('copyLinkBtn').addEventListener('click', () => copyReferralLink(telegramId));
    document.getElementById('withdrawBtn').addEventListener('click', () => withdraw(telegramId));
}

async function loadUserData(telegramId, username, referrerId) {
    try {
        let url = `${API_URL}/user/${telegramId}?username=${username}`;
        if (referrerId) url += `&ref=${referrerId}`;
        
        const response = await fetch(url);
        userData = await response.json();
        
        document.getElementById('balance').textContent = userData.balance || 0;
        document.getElementById('totalEarned').textContent = userData.total_earned || 0;
    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Failed to load data');
    }
}

async function farm(telegramId) {
    const farmBtn = document.getElementById('farmButton');
    farmBtn.style.pointerEvents = 'none';
    
    try {
        const response = await fetch(`${API_URL}/farm/${telegramId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const error = await response.json();
            showToast(error.error);
            if (error.nextAvailable) {
                startCooldown(error.nextAvailable);
            }
            return;
        }
        
        const result = await response.json();
        document.getElementById('balance').textContent = result.newBalance;
        showToast(`+${result.earned} coins!`);
        
        // Add animation
        const farmCircle = document.querySelector('.farm-circle');
        farmCircle.style.transform = 'scale(0.95)';
        setTimeout(() => {
            farmCircle.style.transform = '';
        }, 200);
        
        if (result.nextAvailable) {
            startCooldown(result.nextAvailable);
        }
    } catch (error) {
        console.error('Farm error:', error);
        showToast('Network error');
    } finally {
        farmBtn.style.pointerEvents = 'auto';
    }
}

function startCooldown(nextAvailableTimestamp) {
    const timerElement = document.getElementById('cooldownTimer');
    
    function updateTimer() {
        const now = Math.floor(Date.now() / 1000);
        const remaining = nextAvailableTimestamp - now;
        
        if (remaining <= 0) {
            timerElement.textContent = '✨ Ready to farm! ✨';
            clearInterval(timerInterval);
            return;
        }
        
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        timerElement.textContent = `Next farm in: ${hours}h ${minutes}m ${seconds}s`;
    }
    
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
}

function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    tasksList.innerHTML = '';
    
    TASKS.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.innerHTML = `
            <div class="task-info">
                <h4>${task.name}</h4>
                <p>Reward: ${task.reward} coins</p>
            </div>
            <button class="task-button" data-task-id="${task.id}" data-reward="${task.reward}" data-url="${task.url || ''}">
                Complete
            </button>
        `;
        
        tasksList.appendChild(taskElement);
    });
    
    document.querySelectorAll('.task-button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const telegramId = tg.initDataUnsafe?.user?.id;
            const taskId = btn.dataset.taskId;
            const reward = parseInt(btn.dataset.reward);
            const url = btn.dataset.url;
            
            if (url) {
                window.open(url, '_blank');
            }
            
            await completeTask(telegramId, taskId, reward);
            btn.textContent = '✓ Completed';
            btn.classList.add('completed');
            btn.disabled = true;
        });
    });
}

async function completeTask(telegramId, taskId, reward) {
    try {
        const response = await fetch(`${API_URL}/complete-task/${telegramId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, reward })
        });
        
        if (response.ok) {
            const result = await response.json();
            document.getElementById('balance').textContent = result.newBalance;
            showToast(`+${reward} coins earned!`);
        } else {
            const error = await response.json();
            showToast(error.error || 'Task already completed');
        }
    } catch (error) {
        console.error('Task error:', error);
    }
}

async function loadReferralStats() {
    const telegramId = tg.initDataUnsafe?.user?.id;
    
    try {
        const response = await fetch(`${API_URL}/referrals/${telegramId}`);
        const data = await response.json();
        document.getElementById('referralCount').textContent = data.count;
    } catch (error) {
        console.error('Referral error:', error);
    }
}

function updateReferralLinkDisplay(telegramId) {
    const referralLink = `https://t.me/${BOT_USERNAME}/app?ref=${telegramId}`;
    const linkInput = document.getElementById('referralLink');
    if (linkInput) {
        linkInput.value = referralLink;
    }
}

function copyReferralLink(telegramId) {
    const referralLink = `https://t.me/${BOT_USERNAME}/app?ref=${telegramId}`;
    
    navigator.clipboard.writeText(referralLink).then(() => {
        showToast('✅ Referral link copied! Share with friends!');
    }).catch(() => {
        showToast('❌ Failed to copy. Copy manually below.');
    });
    
    const linkInput = document.getElementById('referralLink');
    if (linkInput) {
        linkInput.value = referralLink;
    }
}

async function withdraw(telegramId) {
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    
    if (!amount || amount < 5000) {
        showToast('Minimum withdrawal is 5000 coins');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/withdraw/${telegramId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(result.message || 'Withdrawal request submitted!');
            document.getElementById('withdrawAmount').value = '';
            await loadUserData(telegramId, null, null);
        } else {
            const error = await response.json();
            showToast(error.error);
        }
    } catch (error) {
        console.error('Withdraw error:', error);
        showToast('Network error');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// Start the app
init();