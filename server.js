import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// -----------------------------
// TELEGRAM BOT SETUP
// -----------------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function sendTelegramMessage(msg) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, msg, {
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}

// -----------------------------
// HANDLE /start
// -----------------------------
bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🐷 *Welcome to WIT Wednesday!*\n\n` +
        `Send WIT to:\n\`${process.env.BAR_WALLET}\`\n\n` +
        `I’ll send you a drink ticket automatically 🍹`,
      { parse_mode: "Markdown" }
    );
  }
});

// -----------------------------
// TOKEN WEBHOOK
// -----------------------------
app.post("/webhook", async (req, res) => {
  try {
    const events = req.body?.tokenTransfers ?? [];
    const BAR_WALLET = process.env.BAR_WALLET;
    const WIT_MINT = process.env.WIT_MINT;

    for (const t of events) {
      const {
        mint,
        tokenAmount,
        toUserAccount,
        userAccount,
        signature
      } = t;

      // Mint must be WIT
      if (mint !== WIT_MINT) continue;

      // Only transfers TO the bar wallet
      if (userAccount !== BAR_WALLET) continue;

      console.log(`🔥 WIT RECEIVED: ${tokenAmount} from TX ${signature}`);

      await sendTelegramMessage(
        `🍹 *WIT Drink Ticket Received!*\n\n` +
          `*Amount:* ${tokenAmount} WIT\n` +
          `*TX:* \`${signature}\`\n\n` +
          `Your drink ticket is ready 🎉`
      );
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("error");
  }
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 WIT Bot Server running on port ${PORT}`);
});
