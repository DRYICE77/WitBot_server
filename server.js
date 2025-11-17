import express from "express";
import TelegramBot from "node-telegram-bot-api";

const app = express();
app.use(express.json());

// ================================
// 🔧 Load ENV Variables
// ================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const PORT = process.env.PORT || 8080;
const TARGET_CHAT = process.env.TARGET_CHAT;

const BAR_WALLET = process.env.BAR_WALLET;
const BAR_WALLET_ATA = process.env.BAR_WALLET_ATA;
const WIT_MINT = process.env.WIT_MINT;

// ================================
// ⚠️ Validate ENV Keys
// ================================
console.log("===== ENV KEYS LOADED =====");

function checkEnv(name, value) {
    if (!value || value.length < 3) {
        console.log(`❌ ${name} MISSING`);
        return false;
    }
    console.log(`Loaded ${name}: OK`);
    return true;
}

checkEnv("PORT", PORT);
checkEnv("BOT_TOKEN", BOT_TOKEN);
checkEnv("SERVER_URL", SERVER_URL);
checkEnv("TARGET_CHAT", TARGET_CHAT);
checkEnv("WIT_MINT", WIT_MINT);
checkEnv("BAR_WALLET", BAR_WALLET);
checkEnv("BAR_WALLET_ATA", BAR_WALLET_ATA);

// ================================
// 🤖 Initialize Telegram Bot (Webhook Mode)
// ================================
console.log("\nStarting Telegram bot…");

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const TELEGRAM_WEBHOOK_URL = `${SERVER_URL}/telegram`;

try {
    await bot.setWebHook(TELEGRAM_WEBHOOK_URL);
    console.log(`✅ Telegram webhook set to: ${TELEGRAM_WEBHOOK_URL}`);
} catch (err) {
    console.error("❌ Failed to set Telegram webhook:", err.message);
}

// ================================
// 📩 Telegram Webhook Receiver
// ================================
app.post("/telegram", async (req, res) => {
    try {
        const update = req.body;

        if (update.message && update.message.text) {
            const msg = update.message.text;
            const user = update.message.from.username || update.message.from.first_name;

            console.log(`💬 Message from ${user}:`, msg);

            // Echo message for now (you can customize)
            await bot.sendMessage(TARGET_CHAT, `📩 *New Message from ${user}:*\n${msg}`, {
                parse_mode: "Markdown",
            });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Telegram /telegram handler error:", err);
        res.sendStatus(500);
    }
});

// ================================
// 🔥 Helius Webhook for Tracking WIT Transfers
// ================================
app.post("/helius", async (req, res) => {
    try {
        console.log("📡 Helius Webhook Received!");

        const data = req.body;

        if (!data || !data[0] || !data[0].tokenTransfers) {
            return res.sendStatus(200);
        }

        const transfers = data[0].tokenTransfers;

        for (const t of transfers) {
            const mint = t.mint;
            const from = t.fromUserAccount;
            const to = t.toUserAccount;
            const amount = t.tokenAmount;

            if (mint !== WIT_MINT) continue;

            const involvesWallet =
                from === BAR_WALLET ||
                to === BAR_WALLET ||
                from === BAR_WALLET_ATA ||
                to === BAR_WALLET_ATA;

            if (!involvesWallet) continue;

            console.log("🔥 WIT Transfer Detected:", { from, to, amount });

            const direction =
                to === BAR_WALLET || to === BAR_WALLET_ATA
                    ? "➡️ Incoming"
                    : "⬅️ Outgoing";

            const message = `
🔥 *WIT Transfer Detected!*

• *Direction:* ${direction}
• *Amount:* ${amount}
• *From:* \`${from}\`
• *To:* \`${to}\`

#WITTracker
            `;

            await bot.sendMessage(TARGET_CHAT, message, { parse_mode: "Markdown" });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error in /helius webhook:", err);
        res.sendStatus(500);
    }
});

// ================================
// 🌐 Default Route
// ================================
app.get("/", (req, res) => {
    res.send("WitBot server running.");
});

// ================================
// 🚀 Start Server
// ================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});








