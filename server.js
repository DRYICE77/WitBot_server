// ========================================
// Load environment variables FIRST
// ========================================
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import { Telegraf } from 'telegraf';

const app = express();
app.use(bodyParser.json());

// ========================================
// Validate ENV keys
// ========================================
console.log("===== ENV KEYS LOADED =====");
const REQUIRED_KEYS = [
  "PORT",
  "BOT_TOKEN",
  "SERVER_URL",
  "TARGET_CHAT",
  "WIT_MINT",
  "BAR_WALLET"
];

REQUIRED_KEYS.forEach(key => {
  if (!process.env[key]) {
    console.log(`❌ ${key} MISSING`);
  } else {
    console.log(`Loaded ${key}: OK`);
  }
});

console.log("========================================");

// -------------------------------------------------
// Setup Telegram Bot
// -------------------------------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const SERVER_URL = process.env.SERVER_URL;
const webhookUrl = `${SERVER_URL}/telegram`;

async function setupWebhook() {
  try {
    console.log(`📡 Setting Telegram webhook to: ${webhookUrl}`);
    await bot.telegram.setWebhook(webhookUrl);
    console.log("✅ Telegram webhook set successfully");
  } catch (err) {
    console.error("❌ Failed to set webhook:", err);
  }
}

app.use(bot.webhookCallback('/telegram'));

// -------------------------------------------------
// Start server THEN set webhook
// -------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await setupWebhook();
});

// -------------------------------------------------
// Helius Webhook Receiver
// -------------------------------------------------
app.post("/webhook", async (req, res) => {
  console.log("🔥 RAW HELIUS WEBHOOK RECEIVED:");
  console.log(JSON.stringify(req.body, null, 2));

  return res.status(200).send("ok");
});










