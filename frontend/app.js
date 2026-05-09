// TEST VERSION - For local browser testing only
const API_URL = 'https://telegram-earning-app.onrender.com/api';

let tg = { initDataUnsafe: {} }; // Mock Telegram for browser
let userData = null;

// Tasks configuration
const TASKS = [
    { id: 'join_channel', name: 'Join Our Channel', reward: 500, url: 'https://t.me/your_channel' },
    { id: 'follow_twitter', name: 'Follow on Twitter', reward: 300, url: 'https://twitter.com/your_account' },
    { id: 'invite_friend', name: 'Invite 1 Friend', reward: 1000, url: null, special: 'referral' }
];

// Initialize with test user
async function init() {
    const telegramId = 'test_user_123';
    const username = 'test_user';
    
    await loadUserData(telegramId, username);
    loadTasks();
    loadReferralStats();
    
    document.getElementById('farmButton').addEventListener('click', () => farm(telegramId));
    document.getElementById('copyLinkBtn').addEventListener('click', copyReferralLink);
    document.getElementById('withdrawBtn').addEventListener('click', () => withdraw(telegramId));
}

async function loadUserData(telegramId, username) {
    try {
        const response = await fetch(`${API_URL}/user/${telegramId}?username=${username}`);
        userData = await response.json();
        
        document.getElementById('balance').textContent = userData.balance || 0;
        document.getElementById('totalEarned').textContent = userData.total_earned || 0;
    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Failed to connect to backend. Is it running?');
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
        showToast('Network error - is backend running on port 3000?');
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
            const telegramId = 'test_user_123';
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
    const telegramId = 'test_user_123';
    
    try {
        const response = await fetch(`${API_URL}/referrals/${telegramId}`);
        const data = await response.json();
        document.getElementById('referralCount').textContent = data.count || 0;
    } catch (error) {
        console.error('Referral error:', error);
    }
}

function copyReferralLink() {
    const link = `https://t.me/YourBotUsername/app?ref=test_user_123`;
    
    navigator.clipboard.writeText(link);
    showToast('Referral link copied!');
    
    const linkInput = document.getElementById('referralLink');
    linkInput.value = link;
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
            showToast('Withdrawal request submitted!');
            document.getElementById('withdrawAmount').value = '';
            await loadUserData(telegramId, null);
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