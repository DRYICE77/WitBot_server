import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT (Webhook Mode)
// ----------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

// Telegram webhook endpoint
const TELEGRAM_WEBHOOK = "https://witbotserver-production.up.railway.app/telegram";
bot.setWebHook(TELEGRAM_WEBHOOK);

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

// Helper
async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Telegram error:", err);
  }
}

// ----------------------------------
// HELIUS WEBHOOK — token transfers
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    console.log("➡️ Helius event:", JSON.stringify(req.body, null, 2));

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
    console.error("Webhook error:", err);
    res.status(500).send("error");
  }
});

// ----------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});




