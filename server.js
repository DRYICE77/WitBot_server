import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT — Webhook mode
// ----------------------------------

const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_WEBHOOK_PATH = `/bot${BOT_TOKEN}`;
const TG_WEBHOOK_URL = `https://witbotserver-production.up.railway.app${TG_WEBHOOK_PATH}`;

const bot = new TelegramBot(BOT_TOKEN, {
  webHook: {
    port: process.env.PORT || 8080
  }
});

// Tell Telegram where to send updates
bot.setWebHook(TG_WEBHOOK_URL);

console.log("📡 Telegram Webhook set to:", TG_WEBHOOK_URL);

// ----------------------------------
// REQUIRED route for Telegram messages
// ----------------------------------
app.post(TG_WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ----------------------------------
// HANDLE /start
// ----------------------------------
bot.on("message", (msg) => {
  if (!msg?.text) return;

  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// ----------------------------------
// SEND TG MESSAGE HELPER
// ----------------------------------
async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("❌ Telegram send error:", err);
  }
}

// ----------------------------------
// HELIUS WEBHOOK — token transfers
// ----------------------------------
app.post("/webhook", async (req, res) => {
  try {
    console.log("➡️ Incoming Helius event:");
    console.log(JSON.stringify(req.body, null, 2));

    const events = req.body?.events || [];
    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const { mint, tokenAmount, toUserAccount, signature } = t;

        if (mint !== MINT) continue;
        if (toUserAccount !== BAR) continue;

        console.log(`🔥 WIT TRANSFER DETECTED: ${tokenAmount}`);

        await sendTelegramMessage(
          `🍹 *WIT Payment Received!*\n\n` +
            `*Amount:* ${tokenAmount}\n` +
            `*TX:* \`${signature}\`\n\n` +
            `Your drink is served! 🥂`
        );
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Error in webhook:", err);
    res.status(500).send("err");
  }
});

// ----------------------------------
// START EXPRESS SERVER
// ----------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot running on port ${PORT}`);
});





