// ========================================
// Load ENV
// ========================================
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import { Telegraf } from 'telegraf';

const app = express();
app.use(bodyParser.json());

// ENV Vars
const BOT_TOKEN = process.env.BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const TARGET_CHAT = process.env.TARGET_CHAT;   // Your Telegram Chat ID
const BAR_WALLET = process.env.BAR_WALLET;

if (!BOT_TOKEN || !SERVER_URL || !TARGET_CHAT) {
  console.error("❌ Missing required ENV variables.");
}

const bot = new Telegraf(BOT_TOKEN);

// ========================================
// Telegram command: /start ONLY
// ========================================
bot.start((ctx) => {
  ctx.reply(
    "🍹 *Welcome to the WIT Drink Bot!* 🍹\n\n" +
    "Send WIT to the bar wallet:\n" +
    `\`${BAR_WALLET}\`\n`,
    { parse_mode: "Markdown" }
  );
});

// ❌ REMOVE all other message handlers — we don't want spam
// bot.on("message", ...)  ← removed entirely

// ========================================
// Telegram Webhook Endpoint
// ========================================
app.post("/telegram", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Set Telegram Webhook on startup
bot.telegram.setWebhook(`${SERVER_URL}/telegram`)
  .then(() => console.log("✅ Telegram webhook set"))
  .catch(err => console.error("❌ Failed to set Telegram webhook:", err));

// ========================================
// HELIUS WEBHOOK → Detect WIT Transfers
// ========================================
app.post("/webhook", async (req, res) => {
  try {
    const events = req.body;

    if (!Array.isArray(events)) {
      return res.sendStatus(400);
    }

    for (const event of events) {
      if (event.type === "TRANSFER" && event.tokenTransfers?.length > 0) {
        const witTransfers = event.tokenTransfers.filter(
          t => t.mint === process.env.WIT_MINT
        );

        for (const t of witTransfers) {
          const direction = t.toUserAccount === BAR_WALLET ? "Incoming" : "Outgoing";

          const msg =
            "🔥 *WIT Transfer Detected!* 🔥\n\n" +
            `• *Direction:* ${direction === "Incoming" ? "⬅️ Incoming" : "➡️ Outgoing"}\n` +
            `• *Amount:* ${t.amount}\n` +
            `• *From:* \`${t.fromUserAccount}\`\n` +
            `• *To:* \`${t.toUserAccount}\`\n\n` +
            "#WITTracker";

          await bot.telegram.sendMessage(TARGET_CHAT, msg, {
            parse_mode: "Markdown"
          });
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error processing webhook:", err);
    res.sendStatus(500);
  }
});

// ========================================
// Start Express Server
// ========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});








