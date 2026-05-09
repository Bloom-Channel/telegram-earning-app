const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL; // Your frontend URL (Netlify, Vercel, etc.)

const bot = new Telegraf(BOT_TOKEN);

// Start command
bot.start((ctx) => {
    const referrerId = ctx.payload; // Get referral ID from start param
    const appUrl = referrerId ? `${APP_URL}?ref=${referrerId}` : APP_URL;
    
    ctx.replyWithHTML(
        `🎉 <b>Welcome to CoinFarm!</b> 🎉\n\n` +
        `Earn coins by farming every hour, completing tasks, and referring friends!\n\n` +
        `💰 <b>How to earn:</b>\n` +
        `• Tap the farm button every hour for 100 coins\n` +
        `• Complete tasks for bonus coins\n` +
        `• Invite friends and get 500 coins each\n\n` +
        `👇 <b>Open the app to start earning!</b>`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 Open CoinFarm', web_app: { url: appUrl } }],
                    [{ text: '📢 Join Community', url: 'https://t.me/your_channel' }]
                ]
            }
        }
    );
});

// Help command
bot.help((ctx) => {
    ctx.reply(
        `📖 <b>Help Guide</b>\n\n` +
        `1. Click "Open CoinFarm" to launch the mini-app\n` +
        `2. Tap the big farm button every hour\n` +
        `3. Complete tasks for extra coins\n` +
        `4. Share your referral link with friends\n` +
        `5. Withdraw when you reach 5000 coins\n\n` +
        `Minimum withdrawal: 5000 coins`,
        { parse_mode: 'HTML' }
    );
});

// Launch bot
bot.launch()
    .then(() => console.log('Bot is running'))
    .catch(err => console.error('Bot error:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));