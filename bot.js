const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://calm-douhua-3616ca.netlify.app';

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is missing! Check your .env file');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Fixed /start command with correct button structure
bot.start((ctx) => {
    console.log('✅ /start received from:', ctx.from.username || ctx.from.id);
    
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
                    [{ text: "🚀 Open CoinFarm", web_app: { url: APP_URL } }],  // Fixed: web_app object with url
                    [{ text: "📢 Join Community", url: "https://t.me/your_channel" }]
                ]
            }
        }
    );
});

// Simple echo to test if bot is receiving messages
bot.on('text', (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
        ctx.reply(`Send /start to open the app!`);
    }
});

// Error handler
bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    ctx.reply('Something went wrong. Please try again later.');
});

// Launch the bot
bot.launch()
    .then(() => {
        console.log('✅ Bot is running and ready!');
        console.log(`📱 App URL: ${APP_URL}`);
        console.log('💬 Test by messaging your bot on Telegram: /start');
    })
    .catch(err => {
        console.error('❌ Failed to launch bot:', err);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));