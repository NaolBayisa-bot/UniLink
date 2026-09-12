"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
async function checkTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
        process.exit(1);
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        if (!response.ok) {
            console.error(`❌ Telegram API request failed — HTTP ${response.status}`);
            process.exit(1);
        }
        const data = await response.json();
        if (!data.ok || !data.result) {
            console.error(`❌ Telegram API error: ${data.description ?? 'unknown'}`);
            process.exit(1);
        }
        const bot = data.result;
        console.log(`✅ Telegram bot connected — @${bot.username ?? '(no username)'} (id: ${bot.id}, name: ${bot.first_name})`);
    }
    catch (error) {
        console.error('❌ Telegram bot connection failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
checkTelegramBot();
//# sourceMappingURL=check-telegram-bot.js.map