const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://legendary-pothos-c78b50.netlify.app';
const API_URL = process.env.API_URL;

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is missing! Check your .env file');
    process.exit(1);
}

if (!APP_URL) {
    console.error('❌ APP_URL is missing! Check your .env file');
    process.exit(1);
}

console.log('✅ Bot starting with:');
console.log(`   APP_URL: ${APP_URL}`);

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
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
                    [{ text: "🚀 Open CoinFarm", web_app: { url: APP_URL } }],
                    [{ text: "💬 Join Community Chat", url: "https://t.me/Coinfarm_chat" }],
                    [{ text: "📢 Updates Channel", url: "https://t.me/coinfarm_updates" }]
                ]
            }
        }
    );
});

bot.launch()
    .then(() => console.log('✅ Bot is running and ready!'))
    .catch(err => console.error('❌ Failed to launch bot:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));