import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function sendTelegramMessage(text) {
    try {
        await bot.sendMessage(process.env.TARGET_CHAT, text, { parse_mode: "Markdown" });
    } catch (err) {
        console.error("Telegram send error:", err);
    }
}

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

                // Only WIT coin
                if (mint !== WIT_MINT) continue;

                // Only transfers TO the bar wallet OR its ATA
                if (toUserAccount !== BAR_WALLET && toUserAccount !== BAR_WALLET_ATA) continue;

                console.log(`🔥 WIT RECEIVED: ${tokenAmount}`);

                await sendTelegramMessage(
                    `🍹 *WIT Received!*\n\n` +
                    `*Amount:* ${tokenAmount}\n` +
                    `*TX:* \`${signature}\`\n\n` +
                    `Enjoy your drink ticket! 🎉`
                );
            }
        }

        res.status(200).send("ok");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("error");
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 WIT Bot Server running on port ${PORT}`);
});



