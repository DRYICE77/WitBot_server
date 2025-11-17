// ========================================
// Load environment variables
// ========================================
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import { Telegraf } from "telegraf";

const app = express();
app.use(bodyParser.json());

// ========================================
// Validate ENV keys
// ========================================
console.log("===== ENV KEYS LOADED =====");
const REQUIRED = [
  "PORT",
  "BOT_TOKEN",
  "SERVER_URL",
  "TARGET_CHAT",
  "WIT_MINT",
  "BAR_WALLET"
];

REQUIRED.forEach(key => {
  if (!process.env[key]) {
    console.log(`❌ ${key} MISSING`);
  } else {
    console.log(`Loaded ${key}: OK`);
  }
});

// ========================================
// Boot Telegram bot
// ========================================
const bot = new Telegraf(process.env.BOT_TOKEN);

// Example command
bot.start(ctx => ctx.reply("Bot online!"));

// ========================================
// Webhook setup
// ========================================
async function setupWebhook() {
  const webhookUrl = `${process.env.SERVER_URL}/telegram`;
  console.log("🔗 Setting Telegram webhook to:", webhookUrl);

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log("✅ Webhook set successfully");
  } catch (err) {
    console.error("❌ Failed to set webhook:", err.description || err);
  }
}

// Telegraf webhook handler
app.use(bot.webhookCallback("/telegram"));

// ========================================
// Start server
// ========================================
const PORT = process.env.PORT || 8080;

app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);
  await setupWebhook();
});









