import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// -------------------------------
// TELEGRAM BOT (Webhook Mode)
// -------------------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: true
});

// Your Telegram webhook URL
const TG_WEBHOOK_URL = `https://witbotserver-production.up.railway.app/telegram`;
bot.setWebHook(TG_WEBHOOK_URL);

async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("❌ Telegram send error:", err);
  }
}

// Debug route for Telegram
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// -------------------------------
// HANDLE /start FROM TELEGRAM
// -------------------------------
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

// -------------------------------
// HELIUS WEBHOOK LISTENER (DEBUG MODE)
// -------------------------------
app.post("/webhook", async (req, res) => {
  console.log("🔥 RAW HELIUS WEBHOOK RECEIVED:");
  console.log(JSON.stringify(req.body, null, 2));

  const events = req.body?.events || [];

  if (!events.length) {
    console.log("⚠️ No events array present in webhook");
    return res.status(200).send("ok");
  }

  // Env vars
  const BAR = process.env.BAR_WALLET;
  const MINT = process.env.WIT_MINT;

  let matched = false;

  for (const event of events) {
    const transfers = event?.tokenTransfers || [];

    if (!transfers.length) {
      console.log("⚠️ Event contains NO tokenTransfers");
      continue;
    }

    console.log("🔍 tokenTransfers found:", transfers.length);

    for (const t of transfers) {
      console.log("🔎 Checking transfer:", t);

      const mint = t.mint;
      const amount = t.tokenAmount;
      const toUser = t.toUserAccount;
      const sig = t.signature;

      // Matching logic
      if (mint === MINT && toUser === BAR) {
        matched = true;

        console.log("🎉 MATCHED WIT PAYMENT!");

        await sendTelegramMessage(
          `🍹 *WIT Payment Received!*\n\n` +
          `*Amount:* ${amount}\n` +
          `*TX:* \`${sig}\`\n\n` +
          `Your drink is served! 🥂`
        );
      }
    }
  }

  if (!matched) {
    console.log("⚠️ No matching WIT transfers found in webhook");
  }

  res.status(200).send("ok");
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Telegram webhook set to: ${TG_WEBHOOK_URL}`);
});






