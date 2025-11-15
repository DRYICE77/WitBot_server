import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ---------------------------------------------
// TELEGRAM WEBHOOK MODE (not polling)
// ---------------------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN);

const WEBHOOK_URL = "https://witbotserver-production.up.railway.app/tg";

bot.setWebHook(WEBHOOK_URL);

// Telegram route
app.post("/tg", (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// /start handler
bot.on("message", (msg) => {
    if (msg.text === "/start") {
        bot.sendMessage(
            msg.chat.id,
            `🐷 *Welcome to the WIT Bar Bot!*\n\nSend WIT to:\n\`${process.env.BAR_WALLET}\`\nAnd you'll get a drink ticket 🍹`,
            { parse_mode: "Markdown" }
        );
    }
});

// ---------------------------------------------
// HELIUS WEBHOOK HANDLER
// ---------------------------------------------

app.post("/webhook", async (req, res) => {
    try {
        const events = Array.isArray(req.body) ? req.body : req.body.events || [];

        const BAR_WALLET = process.env.BAR_WALLET;
        const BAR_WALLET_ATA = process.env.BAR_WALLET_ATA;
        const WIT_MINT = process.env.WIT_MINT;

        for (const event of events) {
            const transfers = event.tokenTransfers || [];

            for (const t of transfers) {
                const {
                    mint,
                    tokenAmount,
                    fromUserAccount,
                    toUserAccount,
                    signature
                } = t;

                if (mint !== WIT_MINT) continue;

                if (toUserAccount !== BAR_WALLET && toUserAccount !== BAR_WALLET_ATA)
                    continue;

                await bot.sendMessage(
                    process.env.TARGET_CHAT,
                    `🍹 *WIT Received!*\n\n` +
                    `*Amount:* ${tokenAmount}\n` +
                    `*TX:* \`${signature}\`\n\n` +
                    `Enjoy your drink ticket! 🎉`,
                    { parse_mode: "Markdown" }
                );
            }
        }

        res.status(200).send("ok");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("error");
    }
});

// ---------------------------------------------
// START SERVER
// ---------------------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 WIT Bot Server running on port ${PORT}`);
});


