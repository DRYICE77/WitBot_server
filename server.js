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
bot.setWebHook(`${process.env.SERVER_URL}/telegram`);

async function sendTelegram(text) {
  try {
    await bot.sendMessage(process.env.TARGET_CHAT, text, {
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("❌ Telegram error:", err);
  }
}

// ----------------------------------
// TELEGRAM HANDLER (optional)
// ----------------------------------
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on("message", (msg) => {
  if (msg?.text === "/start") {
    bot.sendMessage(
      msg.chat.id,
      `🍹 *Welcome to the WIT Bar Bot!*\nSend WIT to:\n\`${process.env.BAR_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// ----------------------------------
// HELIUS ENHANCED WEBHOOK
// ----------------------------------
app.post("/webhook", async (req, res) => {
  try {
    console.log("🔥 RAW HELIUS WEBHOOK RECEIVED:");
    console.log(JSON.stringify(req.body, null, 2));

    const dataArray = req.body;

    for (const entry of dataArray) {
      const transfers = entry.tokenTransfers || [];

      for (const t of transfers) {
        const mint = t.mint;
        const toUser = t.toUserAccount;
        const amountRaw = t.tokenAmount;
        const signature = entry.signature || "(no sig)";

        if (mint === process.env.WIT_MINT &&
            toUser === process.env.BAR_WALLET) {

          const amount = Number(amountRaw) / 1_000_000;  // WIT decimals = 6

          console.log("🎉 MATCH FOUND! Sending Telegram alert.");

          await sendTelegram(
            `🍹 *WIT Payment Received!*\n\n` +
            `*Amount:* ${amount}\n` +
            `*From:* \`${t.fromUserAccount}\`\n` +
            `*TX:* \`${signature}\`\n\n` +
            `Your drink is served! 🥂`
          );
        }
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Error in webhook:", err);
    res.status(500).send("error");
  }
});

// ----------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});






