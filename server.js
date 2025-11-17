// server.js
import express from "express";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------
// ENVIRONMENT VARIABLES
// ----------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const TARGET_CHAT = process.env.TARGET_CHAT;
const SERVER_URL = process.env.SERVER_URL;   // MUST BE EXACT MATCH
const PORT = process.env.PORT || 8080;

// Debug print
console.log("🔧 Loaded SERVER_URL:", SERVER_URL);
console.log("🔧 Loaded BOT_TOKEN:", BOT_TOKEN ? "OK" : "MISSING");
console.log("🔧 Loaded TARGET_CHAT:", TARGET_CHAT ? "OK" : "MISSING");

// ----------------------------
// TELEGRAM SETUP
// ----------------------------
const bot = new TelegramBot(BOT_TOKEN, {
  polling: false,
});

// Attempt to set webhook
(async () => {
  try {
    const hookUrl = `${SERVER_URL}/telegram`;
    console.log("📡 Setting Telegram webhook to:", hookUrl);

    await bot.setWebHook(hookUrl);
    console.log("✅ Telegram webhook set successfully!");
  } catch (err) {
    console.error("❌ Failed to set webhook:", err.toString());
  }
})();

// Telegram webhook endpoint
app.post("/telegram", async (req, res) => {
  console.log("📥 Telegram update received:", req.body);

  try {
    await bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Telegram update error:", err);
    res.sendStatus(500);
  }
});

// ----------------------------
// HELIUS ENHANCED WEBHOOK
// ----------------------------
app.post("/webhook", async (req, res) => {
  console.log("🔥 RAW HELIUS WEBHOOK RECEIVED:");
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const events = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      console.log("⚠️ No events array present in webhook");
      return res.sendStatus(200);
    }

    for (const event of events) {
      const description = event.description || "";
      const tokenTransfers = event.tokenTransfers || [];

      // Debug what tokenTransfers contains
      console.log("🔍 tokenTransfers:", tokenTransfers);

      // Detect any WIT token transfer involving BAR WALLET
      tokenTransfers.forEach(async (tx) => {
        try {
          const from = tx.fromUserAccount;
          const to = tx.toUserAccount;
          const mint = tx.mint;
          const amount = tx.tokenAmount;

          // Debug each movement
          console.log(
            `🔎 Transfer — mint: ${mint}, amount: ${amount}, from: ${from}, to: ${to}`
          );

          // --------------------------
          // Insert your token + wallet filters here
          // --------------------------
          if (mint === process.env.WIT_MINT && to === process.env.BAR_WALLET) {
            const msg = `🐷 Someone just deposited *${amount} WIT* into the Bar Wallet!`;
            console.log("📢 Sending Telegram message:", msg);

            await bot.sendMessage(TARGET_CHAT, msg, { parse_mode: "Markdown" });
          }
        } catch (err) {
          console.error("❌ Error parsing transfer:", err);
        }
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error handling webhook:", err);
    res.sendStatus(500);
  }
});

// ----------------------------
// START SERVER
// ----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});








