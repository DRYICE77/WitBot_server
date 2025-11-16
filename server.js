import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT (Webhook Mode)
// ----------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: true,
});

const TELEGRAM_WEBHOOK = `https://witbotserver-production.up.railway.app/telegram`;
bot.setWebHook(TELEGRAM_WEBHOOK);

console.log("🐦 Telegram webhook set to:", TELEGRAM_WEBHOOK);

// Send Telegram message
async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("❌ Telegram send error:", err.message);
  }
}

// Handle /start
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

// Telegram webhook route
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ----------------------------------
// HELIUS WEBHOOK — REAL PRODUCTION LOGIC
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    const events = req.body?.events || [];
    const evt = events[0];

    if (!evt) {
      console.log("⚠️ No events found in webhook");
      return res.status(200).send("ok");
    }

    // These are the correct fields based on your screenshot
    const transfers = evt.tokenTransfers || [];
    const native = evt.nativeTransfers || [];

    console.log("🐙 Helius DEBUG:", {
      tokenTransfersCount: transfers.length,
      nativeTransfersCount: native.length,
    });

    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    // Iterate token transfers
    for (const t of transfers) {
      if (t.mint === MINT && t.toUserAccount === BAR) {
        console.log("🔥 WIT Payment Detected!", t);

        await sendTelegramMessage(
          `🍹 *WIT Payment Received!*\n\n` +
          `*Amount:* ${t.tokenAmount}\n` +
          `*From:* \`${t.fromUserAccount}\`\n` +
          `*TX:* \`${t.signature}\`\n\n` +
          `Your drink is served! 🥂`
        );
      }
    }

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





