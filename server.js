import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const WEBHOOK_URL = "https://witbotserver-production.up.railway.app/webhook";

// ------------------------------
// TELEGRAM BOT (Webhook mode)
// ------------------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: { port: process.env.PORT || 8080 }
});

bot.setWebHook(WEBHOOK_URL);

// REQUIRED — This gives Telegram messages to the bot
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ------------------------------
// /start COMMAND
// ------------------------------
bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet below:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// ------------------------------
// HELIUS WIT PAYMENT WEBHOOK
// ------------------------------
app.post("/helius", async (req, res) => {
  try {
    console.log("➡️ Incoming event:", JSON.stringify(req.body, null, 2));

    const events = req.body?.events || [];
    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    for (const event of events) {
      for (const t of event.tokenTransfers || []) {
        if (t.mint !== MINT) continue;
        if (t.userAccount !== BAR) continue;

        const msg =
          `🍹 *WIT Payment Detected!*\n` +
          `*Amount:* ${t.tokenAmount}\n` +
          `*TX:* \`${t.signature}\`\n\nEnjoy your drink! 🥂`;

        await bot.sendMessage(process.env.TARGET_CHAT, msg, {
          parse_mode: "Markdown",
        });
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("err");
  }
});




