import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT — WEBHOOK MODE
// ----------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

// Your Railway URL MUST match what you set with setWebhook
const WEBHOOK_URL = "https://witbotserver-production.up.railway.app/webhook";

bot.setWebHook(WEBHOOK_URL);

// Helper to send Telegram messages
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
// HANDLE /start COMMAND
// ----------------------------------

bot.on("message", (msg) => {
  if (!msg || !msg.text) return;

  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet below:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// ----------------------------------
// HELIUS WEBHOOK HANDLER
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    console.log("➡️ Incoming Helius event:", JSON.stringify(req.body, null, 2));

    const events = req.body?.events || [];
    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const {
          mint,
          tokenAmount,
          toUserAccount,
          signature
        } = t;

        // Must match the WIT token mint
        if (mint !== MINT) continue;

        // Must be sent TO your bar wallet
        if (toUserAccount !== BAR) continue;

        console.log(`🔥 WIT RECEIVED: ${tokenAmount}`);

        await sendTelegramMessage(
          `🍹 *WIT Payment Detected!*\n` +
          `*Amount:* ${tokenAmount}\n` +
          `*TX:* \`${signature}\`\n\nEnjoy your drink! 🥂`
        );
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    res.status(500).send("err");
  }
});

// ----------------------------------
// HTTP SERVER
// ----------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot Server running on port ${PORT}`);
});




