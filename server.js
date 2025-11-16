import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ---------------------------------------------
// TELEGRAM WEBHOOK MODE (works!)
// ---------------------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN);

// Your Telegram webhook URL
const TG_WEBHOOK = "https://witbotserver-production.up.railway.app/tg";

// Tell Telegram where to send your bot messages
bot.setWebHook(TG_WEBHOOK);

// Telegram webhook route
app.post("/tg", (req, res) => {
    bot.processUpdate(req.body); // REQUIRED
    res.sendStatus(200);
});

// /start handler
bot.on("message", (msg) => {
    if (msg.text === "/start") {
        bot.sendMessage(
            msg.chat.id,
            `🍹 *Welcome to the WIT Bar Bot!*  
Send WIT to:  
\`${process.env.BAR_WALLET}\`  
and enjoy your drink! 🥂`,
            { parse_mode: "Markdown" }
        );
    }
});

// ---------------------------------------------
// HELIUS WEBHOOK HANDLER
// ---------------------------------------------

app.post("/webhook", async (req, res) => {
    try {
        const events = req.body.events || [];

        const BAR = process.env.BAR_WALLET;
        const ATA = process.env.BAR_WALLET_ATA;
        const MINT = process.env.WIT_MINT;

        for (const event of events) {
            const transfers = event.tokenTransfers || [];

            for (const t of transfers) {
                if (t.mint !== MINT) continue;
                if (t.toUserAccount !== BAR && t.toUserAccount !== ATA) continue;

                await bot.sendMessage(
                    process.env.TARGET_CHAT,
                    `🍹 *WIT Received!*  
*Amount:* ${t.tokenAmount}  
*TX:* \`${t.signature}\`  
Enjoy your drink 🎉`,
                    { parse_mode: "Markdown" }
                );
            }
        }

        res.status(200).send("ok");
    } catch (err) {
        console.error("❌ Webhook error:", err);
        res.status(500).send("err");
    }
});

// ---------------------------------------------
// START SERVER
// ---------------------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 WIT Bot Server running on port ${PORT}`);
});




