import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json()); // Helius sends JSON

// -----------------------------
//  TELEGRAM BOT SETUP
// -----------------------------

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Helper function to send messages
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
//  /start COMMAND HANDLER
// -----------------------------

bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🐷 *Welcome to the WIT Wednesday Bot!*\n\n` +
        `Send WIT to the bar wallet and I’ll auto-send a drink ticket.\n\n` +
        `*Bar Wallet:* \`${process.env.BAR_WALLET}\`\n` +
        `Once WIT is received, you’ll instantly get your ticket 🍹`,
      { parse_mode: "Markdown" }
    );
  }
});

// -----------------------------
//  HELIUS ENHANCED WEBHOOK
// -----------------------------

app.post("/webhook", async (req, res) => {
  try {
    const events = req.body?.events || [];

    const BAR_WALLET = process.env.BAR_WALLET;
    const WIT_MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const {
          mint,
          tokenAmount,
          userAccount, // <-- Wallet owner receiving the SPL token
          signature
        } = t;

        // Only care about WIT
        if (mint !== WIT_MINT) continue;

        // Only care about transfers TO the bar wallet (not just ATAs)
        if (userAccount !== BAR_WALLET) continue;

        console.log(`🔥 WIT RECEIVED: ${tokenAmount}`);

        // Notify telegram
        await sendTelegramMessage(
          `🍹 *WIT Payment Detected!*\n\n` +
            `*Amount:* ${tokenAmount} WIT\n` +
            `*TX:* \`${signature}\`\n\n` +
            `Enjoy your drink ticket! 🎉`
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
//  START SERVER
// -----------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot Server running on port ${PORT}`);
});

