import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ------------------------------
// TELEGRAM BOT
// ------------------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

// Tell Telegram where to send messages
bot.setWebHook(`https://witbotserver-production.up.railway.app/tg`);

console.log("🤖 Telegram bot initialized.");

// Helper function
async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}

// ------------------------------
// HANDLE TELEGRAM MESSAGES
// ------------------------------
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

// Telegram webhook endpoint
app.post("/tg", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ------------------------------
// HELIUS WEBHOOK
// ------------------------------
app.post("/webhook", async (req, res) => {
  try {
    console.log("➡️ Incoming Helius event:", JSON.stringify(req.body, null, 2));

    const events = req.body?.events || [];

    const BAR = process.env.BAR_WALLET;
    const BAR_ATA = process.env.BAR_WALLET_ATA;
    const MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const { mint, tokenAmount, userAccount, signature } = t;

        // Must be WIT SPL token
        if (mint !== MINT) continue;

        // Must be sent to the bar's wallet or ATA
        if (userAccount !== BAR && userAccount !== BAR_ATA) continue;

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
    console.error("❌ Webhook error:", err);
    res.status(500).send("err");
  }
});

// ------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot Server running on port ${PORT}`);
});



