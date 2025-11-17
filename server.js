import express from "express";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const app = express();
app.use(express.json());

// 🔥 DEBUG: Print all env keys (NOT VALUES)
console.log("===== ENV KEYS LOADED =====");
Object.keys(process.env).forEach(k => {
  if (["BOT_TOKEN","SERVER_URL","TARGET_CHAT","PORT","BAR_WALLET","WIT_MINT","BAR_WALLET_ATA"].includes(k)) {
    console.log(`Loaded ${k}: OK`);
  }
});
console.log("================================");

// 🔧 Load environment variables
const BOT_TOKEN     = process.env.BOT_TOKEN;
const SERVER_URL    = process.env.SERVER_URL;
const TARGET_CHAT   = process.env.TARGET_CHAT;
const PORT          = process.env.PORT || 8080;

if (!BOT_TOKEN) console.error("❌ BOT_TOKEN MISSING");
if (!SERVER_URL) console.error("❌ SERVER_URL MISSING");
if (!TARGET_CHAT) console.error("❌ TARGET_CHAT MISSING");

// 🚀 Create Telegram Bot (webhook mode)
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

// 🔥 Set Telegram webhook
const webhookURL = `${SERVER_URL}/telegram`;
console.log(`📡 Setting Telegram webhook to: ${webhookURL}`);

bot.setWebHook(webhookURL)
  .then(() => console.log("✅ Telegram webhook set successfully"))
  .catch(err => console.error("❌ Failed to set webhook:", err));

// 🟣 Telegram Webhook Route
app.post("/telegram", (req, res) => {
  console.log("🔥 Telegram Update Received:", JSON.stringify(req.body, null, 2));
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 🟧 Helius Webhook Route
app.post("/webhook", (req, res) => {
  console.log("🔥 RAW HELIUS WEBHOOK RECEIVED:");
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const events = req.body[0]?.events;

    if (!events || Object.keys(events).length === 0) {
      console.log("⚠️ No events array found in webhook");
      return res.sendStatus(200);
    }

    const tokenTransfer = events?.tokenTransfers?.[0];
    if (!tokenTransfer) {
      console.log("⚠️ No token transfer found");
      return res.sendStatus(200);
    }

    const amount = tokenTransfer.tokenAmount;
    const from   = tokenTransfer.fromUserAccount;
    const to     = tokenTransfer.toUserAccount;

    // 🔥 SEND TELEGRAM MSG
    const msg = `💸 *WIT Received!*\n\n` +
                `Amount: *${amount}*\n` +
                `From: \`${from}\`\n` +
                `To: \`${to}\``;

    bot.sendMessage(TARGET_CHAT, msg, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error while processing webhook:", err);
  }

  res.sendStatus(200);
});

// 🚀 Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});








