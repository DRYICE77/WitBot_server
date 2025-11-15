import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// -----------------------------
// TELEGRAM BOT (WEBHOOK MODE)
// -----------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

// Set the webhook to your Railway URL
bot.setWebHook(`https://${process.env.RAILWAY_STATIC_URL || process.env.WEBHOOK_URL}/webhook`);

// Helper to send messages safely
async function sendTelegramMessage(text) {
  try {
    if (!process.env.TARGET_CHAT) {
      console.error("❌ TARGET_CHAT missing");
      return;
    }

    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown",
    });

  } catch (err) {
    console.error("Telegram send error:", err.message);
  }
}

// -----------------------------
// /start COMMAND
// -----------------------------
bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*  
Send WIT to the bar wallet and I'll send you a drink ticket!  
\n*Bar Wallet:* \`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// -----------------------------
// HELIUS WEBHOOK
// -----------------------------
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
          `🍹 *WIT Payment Detected!*  
*Amount:* ${tokenAmount}  
*TX:* \`${signature}\`  
Enjoy your drink! 🥂`
        );
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("err");
  }
});

// -----------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot Server live on port ${PORT}`);
});



