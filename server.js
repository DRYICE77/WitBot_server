import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM SETUP
// ----------------------------------

const BOT_TOKEN = process.env.BOT_TOKEN;

// Telegram will post messages to this path:
const TG_WEBHOOK_PATH = `/bot${BOT_TOKEN}`;

// Full URL that TG calls:
const TG_WEBHOOK_URL = `https://witbotserver-production.up.railway.app${TG_WEBHOOK_PATH}`;

// Create bot in webhook mode
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

// Set Telegram webhook
bot.setWebHook(TG_WEBHOOK_URL);
console.log("📡 Telegram webhook set:", TG_WEBHOOK_URL);

// EXPRESS endpoint that Telegram POSTS into
app.post(TG_WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ----------------------------------
// /start command
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

// ----------------------------------
// SEND TELEGRAM MESSAGE
// ----------------------------------

async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("❌ Telegram send error:", err);
  }
}

// ----------------------------------
// HELIUS WEBHOOK — WIT PAYMENTS
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    console.log("➡️ Helius event received:");
    console.log(JSON.stringify(req.body, null, 2));

    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    const events = req.body.events || [];

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const { mint, tokenAmount, toUserAccount, signature } = t;

        if (mint !== MINT) continue;
        if (toUserAccount !== BAR) continue;

        await sendTelegramMessage(
          `🍹 *WIT Payment Received!*\n\n` +
            `*Amount:* ${tokenAmount}\n` +
            `*TX:* \`${signature}\`\n\nCheers! 🥂`
        );
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(500);
  }
});

// ----------------------------------
// START SERVER
// ----------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));



