// -----------------------------
//      WIT BOT WEBHOOK SERVER
// -----------------------------

import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// -----------------------------
//  TELEGRAM BOT SETUP
// -----------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}

// -----------------------------
//  TELEGRAM /start COMMAND
// -----------------------------

bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🐷 *Welcome to the WIT Wednesday Bot!*\n\n` +
        `Send WIT to the bar wallet below and I’ll send you a drink ticket when payment is received:\n\n` +
        `*Bar Wallet:* \`${process.env.BAR_WALLET}\`\n\n` +
        `Cheers! 🍹`,
      { parse_mode: "Markdown" }
    );
  }
});

// -----------------------------
//   HELIUS ENHANCED WEBHOOK
// -----------------------------

app.post("/webhook", async (req, res) => {
  try {
    const events = req.body.events || [];

    const BAR_WALLET = process.env.BAR_WALLET;
    const WIT_MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      // Loop token transfers
      for (const t of transfers) {
        const {
          mint,
          tokenAmount,
          userAccount,   // <- destination wallet owner (IMPORTANT)
          signature
        } = t;

        // Not WIT → skip
        if (mint !== WIT_MINT) continue;

        // Not receiving wallet → skip
        if (userAccount !== BAR_WALLET) continue;

        console.log(`🔥 WIT RECEIVED: ${tokenAmount} from TX ${signature}`);

        await sendTelegramMessage(
          `🍹 *WIT Payment Received!*\n\n` +
            `*Amount:* ${tokenAmount} WIT\n` +
            `*TX:* \`${signature}\`\n\n` +
            `Your drink ticket is on the way! 🎉`
        );
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.status(500).send("error");
  }
});

// -----------------------------
//  START RAILWAY SERVER
// -----------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 WIT Bot Server running on port ${PORT}`)
);


