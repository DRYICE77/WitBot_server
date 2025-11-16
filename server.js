import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT — Webhook mode
// ----------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: true,
});

// Telegram requires a unique webhook URL
const TELEGRAM_WEBHOOK = `https://witbotserver-production.up.railway.app/telegram`;
bot.setWebHook(TELEGRAM_WEBHOOK);

console.log("🐦 Telegram webhook set to:", TELEGRAM_WEBHOOK);

// Helper to send TG messages
async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("❌ Telegram send error:", err.message);
  }
}

// ----------------------------------
// /start COMMAND
// ----------------------------------

bot.on("message", (msg) => {
  if (!msg.text) return;

  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// Telegram webhook route (Telegram POSTS here)
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ----------------------------------
// HELIUS WEBHOOK — SAFE DEBUG VERSION
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    // 🚨 DO NOT LOG THE FULL PAYLOAD — CRASHES RAILWAY
    const events = req.body?.events || [];
    const firstEvent = events[0];

    // 🔥 SAFE DEBUG LOG (only small parts)
    console.log("🐙 Helius DEBUG:", {
      tokenTransfers: firstEvent?.tokenTransfers,
      nativeTransfers: firstEvent?.nativeTransfers,
    });

    // Respond OK so Helius doesn't throttle us
    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).send("err");
  }
});

// ----------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});




