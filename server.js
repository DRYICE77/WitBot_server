import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT — Webhook Mode
// ----------------------------------

if (!process.env.BOT_TOKEN) {
  console.error("❌ ERROR: BOT_TOKEN missing in environment variables");
  process.exit(1);
}

if (!process.env.SERVER_URL) {
  console.error("❌ ERROR: SERVER_URL missing in environment variables");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });
const WEBHOOK_URL = `${process.env.SERVER_URL}/telegram`;

// Set webhook safely
(async () => {
  try {
    console.log(`📡 Setting Telegram webhook → ${WEBHOOK_URL}`);
    await bot.setWebHook(WEBHOOK_URL);
    console.log("✅ Telegram webhook set successfully");
  } catch (err) {
    console.error("❌ Failed to set Telegram webhook:", err.message);
  }
})();

// Telegram receives updates here
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ----------------------------------
// /start command
// ----------------------------------

bot.on("message", (msg) => {
  if (msg?.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\n\nSend WIT to:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// Helper to send messages to your private channel
async function sendTelegramMessage(text) {
  if (!process.env.TARGET_CHAT) {
    console.error("❌ TARGET_CHAT missing — can't send Telegram messages");
    return;
  }

  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("❌ Telegram sendMessage error:", err.message);
  }
}

// ----------------------------------
// HELIUS WEBHOOK — token transfers
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    console.log("➡️ Helius event received:", JSON.stringify(req.body, null, 2));

    const events = req.body?.events || [];
    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    for (const event of events) {
      for (const t of event.tokenTransfers || []) {
        const { mint, tokenAmount, toUserAccount, signature } = t;

        if (mint !== MINT) continue;
        if (toUserAccount !== BAR) continue;

        console.log("🔥 WIT RECEIVED:", tokenAmount);

        await sendTelegramMessage(
          `🍹 *WIT Payment Received!*\n\n` +
            `*Amount:* ${tokenAmount}\n` +
            `*TX:* \`${signature}\`\n\n` +
            `Your drink is served! 🥂`
        );
      }
    }

    res.send("ok");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("error");
  }
});

// ----------------------------------
// Start Express server
// ----------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("===================================");
  console.log("ENV KEYS LOADED:");
  console.log("BOT_TOKEN:", process.env.BOT_TOKEN ? "OK" : "MISSING");
  console.log("SERVER_URL:", process.env.SERVER_URL || "MISSING");
  console.log("TARGET_CHAT:", process.env.TARGET_CHAT || "MISSING");
  console.log("BAR_WALLET:", process.env.BAR_WALLET || "MISSING");
  console.log("WIT_MINT:", process.env.WIT_MINT || "MISSING");
  console.log("===================================");
});










