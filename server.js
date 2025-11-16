import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

const BOT_TOKEN = process.env.BOT_TOKEN;
const TARGET_CHAT = process.env.TARGET_CHAT;
const SERVER_URL = process.env.SERVER_URL;  // MUST NOT end with "/"
const PORT = process.env.PORT || 8080;

// Create Telegram bot (no polling)
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

// --- Register webhook ONLY if URL exists ---
async function initWebhook() {
  try {
    const fullWebhookURL = `${SERVER_URL}/telegram`;
    console.log("🔗 Setting Telegram webhook to:", fullWebhookURL);

    const res = await bot.setWebHook(fullWebhookURL);
    console.log("✅ Telegram webhook set:", res);
  } catch (err) {
    console.error("❌ Failed to set webhook:", err.message);
  }
}

initWebhook();

// --- HEALTH CHECK (fixes Telegram 400 errors!) ---
app.get("/", (req, res) => {
  res.send("WitBot server alive");
});

// --- TELEGRAM WEBHOOK ENDPOINT ---
app.post("/telegram", (req, res) => {
  bot.processWebHook(req.body);
  res.sendStatus(200);
});

// --- HELIUS WEBHOOK ENDPOINT ---
app.post("/webhook", async (req, res) => {
  console.log("🔥 RAW HELIUS WEBHOOK RECEIVED:");
  console.dir(req.body, { depth: null });

  try {
    const tx = req.body[0];
    if (!tx) {
      console.log("⚠️ No tx object");
      return res.sendStatus(200);
    }

    // FILTER: does this contain the mint we want?
    const containsWIT = (tx.tokenTransfers || []).some(
      (t) => t.mint === process.env.WIT_MINT
    );

    if (!containsWIT) {
      console.log("⚠️ Transaction does not contain WIT mint");
      return res.sendStatus(200);
    }

    // Extract token transfers
    for (const transfer of tx.tokenTransfers || []) {
      if (transfer.mint !== process.env.WIT_MINT) continue;

      const amount = transfer.tokenAmount;
      const fromAcc = transfer.fromUserAccount;
      const toAcc = transfer.toUserAccount;

      const msg = `💸 *WIT Transfer Detected!*\n\n*Amount:* ${amount}\n*From:* \`${fromAcc}\`\n*To:* \`${toAcc}\``;

      await bot.sendMessage(TARGET_CHAT, msg, { parse_mode: "Markdown" });
      console.log("📤 Sent message to Telegram");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error handling webhook:", err);
    res.sendStatus(500);
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});







