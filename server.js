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
// /start COMMAND
// -----------------------------
bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🐷 *Welcome to WIT Wednesday!*\n\n` +
        `Send WIT to the bar wallet:\n\`${process.env.BAR_WALLET}\`\n\n` +
        `Your drink ticket arrives automatically 🍹`,
      { parse_mode: "Markdown" }
    );
  }
});

// -----------------------------
// HELIUS ENHANCED WEBHOOK HANDLER
// -----------------------------
app.post("/webhook", async (req, res) => {
  try {
    const barWallet = process.env.BAR_WALLET;
    const witMint = process.env.WIT_MINT;

    const events = req.body?.events ?? [];

    for (const ev of events) {
      const transfers = ev.tokenTransfers ?? [];

      for (const t of transfers) {
        const {
          mint,
          tokenAmount,
          userAccount,     // OWNER of the receiving ATA (THIS is what we check!)
          signature
        } = t;

        // Only WIT
        if (mint !== witMint) continue;

        // Only WIT sent TO the bar owner
        if (userAccount !== barWallet) continue;

        console.log(`🔥 WIT RECEIVED: ${tokenAmount} WIT — TX: ${signature}`);

        await sendTelegramMessage(
          `🍹 *WIT Drink Ticket Received!*\n\n` +
            `*Amount:* ${tokenAmount} WIT\n` +
            `*TX:* \`${signature}\`\n\n` +
            `Your drink ticket is ready 🎉`
        );
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook error:", err);
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

