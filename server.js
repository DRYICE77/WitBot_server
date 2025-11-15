import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// -----------------------------
// TELEGRAM BOT
// -----------------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("Telegram Error:", err);
  }
}

// -----------------------------
// /start command
// -----------------------------
bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍸 *Welcome to the WIT Bar Bot!*\n\n` +
        `Send WIT to the bar wallet below and I'll auto-issue your drink ticket.\n\n` +
        `*Bar Wallet:* \`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// -----------------------------
// HELIUS ENHANCED WEBHOOK
// -----------------------------
app.post("/webhook", async (req, res) => {
  try {
    const events = req.body?.events || [];

    const BAR_WALLET = process.env.BAR_WALLET;
    const WIT_MINT = process.env.WIT_MINT;

    for (const event of events) {
      const transfers = event.tokenTransfers || [];

      for (const t of transfers) {
        const { mint, tokenAmount, toUserAccount, signature } = t;

        // Only care about WIT
        if (mint !== WIT_MINT) continue;

        // Only care about transfers to the bar wallet OWNER
        if (toUserAccount !== BAR_WALLET) continue;

        console.log("🔥 WIT RECEIVED", tokenAmount);

        await sendTelegramMessage(
          `🍹 *WIT Received!*\n\n` +
            `*Amount:* ${tokenAmount} WIT\n` +
            `*Tx:* \`${signature}\`\n\n` +
            `Enjoy your drink ticket! 🎉`
        );
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("error");
  }
});

// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 WIT Bot Server live on ${PORT}`));

