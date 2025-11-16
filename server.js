import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------------
// TELEGRAM BOT (webhook mode)
// ----------------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

bot.setWebHook(`https://witbotserver-production.up.railway.app/webhook`);

// ----------------------------------
// /start reply (handled from webhook)
// ----------------------------------

function handleTelegramUpdate(update) {
  if (!update.message) return;

  const msg = update.message;

  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
}

// ----------------------------------
// HELIUS WEBHOOK + Telegram webhook
// Same endpoint: /webhook
// ----------------------------------

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // 🔹 If it's a Telegram update → handle it
    if (body.update_id) {
      console.log("📩 Telegram update:", body);
      handleTelegramUpdate(body);
      return res.sendStatus(200);
    }

    // 🔹 Otherwise treat as Helius enhanced webhook
    const events = body?.events || [];
    const BAR = process.env.BAR_WALLET;
    const MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const { mint, tokenAmount, userAccount, signature } = t;

        if (mint !== MINT) continue;
        if (userAccount !== BAR) continue;

        await bot.sendMessage(
          process.env.TARGET_CHAT,
          `🍹 *WIT Received!*\nAmount: ${tokenAmount}\nTX: \`${signature}\``,
          { parse_mode: "Markdown" }
        );
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Error in /webhook:", err);
    res.sendStatus(500);
  }
});

// ----------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot Server live on port ${PORT}`);
});




