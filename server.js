import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// -----------------------------
//  TELEGRAM BOT
// -----------------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const TARGET_CHAT = process.env.TELEGRAM_CHAT_ID;
const BAR_WALLET = process.env.BAR_WALLET;
const WIT_MINT = process.env.WIT_MINT;

// Welcome message
bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      "🐷 Welcome to the WIT Wednesday Drink Ticket Bot!\n\n" +
        "Send WIT to the bar’s address and I'll auto-send your drink ticket.\n\n" +
        `Address:\n${BAR_WALLET}\n\n` +
        "Once payment is detected, you'll get a QR ticket!"
    );
  }
});

// -----------------------------
//  HELIUS WEBHOOK ENDPOINT
// -----------------------------
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    const events = data.events || [];

    for (const ev of events) {
      if (ev.type !== "TOKEN_TRANSFER") continue;

      const transfer = ev.tokenTransfer;
      if (!transfer) continue;

      if (
        transfer.mint === WIT_MINT &&
        transfer.toUserAccount === BAR_WALLET
      ) {
        const txSig = ev.signature;
        const sender = transfer.fromUserAccount;
        const amount = Number(transfer.tokenAmount);

        if (amount < 15) continue;

        console.log("🔥 WIT payment detected:", transfer);

        await bot.sendMessage(
          TARGET_CHAT,
          `🍹 *Drink Ticket Payment Detected!*\n\n` +
            `*TX:* \`${txSig}\`\n` +
            `*Sender:* ${sender}\n` +
            `*Amount:* ${amount} WIT`,
          { parse_mode: "Markdown" }
        );
      }
    }

    res.send("ok");
  } catch (err) {
    console.error("❌ Error in webhook:", err);
    res.status(500).send("error");
  }
});

// -----------------------------
//  START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

