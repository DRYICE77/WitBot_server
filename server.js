import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json()); // Helius sends JSON payloads

// -----------------------------
//  TELEGRAM BOT
// -----------------------------
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const TARGET_CHAT = process.env.TELEGRAM_CHAT_ID;
const BAR_WALLET = "4KHyVVoW4ejvaQmHjpREFbtRMSB9GLLXx8hD4UiYbZ5C";
const WIT_MINT = "Adq3wnAvtaXBNfy63xGV1YNkDiPKadDT469xF9uZPrqE";

// Welcome message
bot.on("message", (msg) => {
  if (msg.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      "🐷 Welcome to the WIT Wednesday Drink Ticket Bot!\n\n" +
        "Send WIT to the bar’s address and I'll auto-send your drink ticket.\n\n" +
        "Address:\n" + BAR_WALLET + "\n\n" +
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

    // Helius sends an array of events
    const events = data.events || [];

    for (const ev of events) {
      // We ONLY care about token transfers
      if (ev.type !== "TOKEN_TRANSFER") continue;

      const transfer = ev.tokenTransfer;
      if (!transfer) continue;

      // Only process WIT transfers to the bar wallet
      if (
        transfer.mint === WIT_MINT &&
        transfer.toUserAccount === BAR_WALLET
      ) {
        const txSig = ev.signature;
        const sender = transfer.fromUserAccount;
        const amount = Number(transfer.tokenAmount);

        // Require at least 15 WIT
        if (amount < 15) continue;

        console.log("🔥 WIT PAYMENT DETECTED!", transfer);

        // Send Telegram notification
        await bot.sendMessage(
          TARGET_CHAT,
          "🍹 *Drink Ticket Payment Detected!*\n\n" +
            `*TX:* \`${txSig}\`\n` +
            `*Sender:* ${sender}\n` +
            `*Amount:* ${amount} WIT`
          , { parse_mode: "Markdown" }
        );
      }
    }

    res.status(200).send("ok");
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