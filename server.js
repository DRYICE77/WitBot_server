import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT (NO webhook setting here)
// ----------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

// Telegram will POST messages to your webhook:
// https://witbotserver-production.up.railway.app/webhook
bot.setWebHook(`https://witbotserver-production.up.railway.app/webhook`);

// Helper to send messages
async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}

// ----------------------------------
// /start COMMAND
// ----------------------------------

bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet below:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// ----------------------------------
// HELIUS WEBHOOK (SPL token detection)
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    console.log("➡️ Incoming event:", JSON.stringify(req.body, null, 2));

    const events = req.body?.events || [];
    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const { mint, tokenAmount, userAccount, signature } = t;

        if (mint !== MINT) continue;
        if (userAccount !== BAR) continue;

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

// ----------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot Server live on port ${PORT}`);
});




