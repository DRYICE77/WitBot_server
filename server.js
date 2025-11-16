import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT — Webhook mode
// ----------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

const WEBHOOK_URL = "https://witbotserver-production.up.railway.app/webhook";
bot.setWebHook(WEBHOOK_URL);

// Send TG message helper
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
// HELIUS WEBHOOK — detects WIT sent TO BAR wallet
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
        const {
          mint,
          tokenAmount,
          toUserAccount,
          signature
        } = t;

        // ✔ Correct fields based on YOUR logs
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot running on port ${PORT}`);
});




