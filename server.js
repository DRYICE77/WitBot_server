import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";

// =======================
// ENV + PATH SETUP
// =======================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const BAR_WALLET = process.env.BAR_WALLET;
const PORT = process.env.PORT || 8080;
const SERVER_URL = process.env.SERVER_URL; // https://witbotserver-production.up.railway.app

if (!TELEGRAM_TOKEN) {
  console.error("❌ Missing BOT_TOKEN");
  process.exit(1);
}

if (!SERVER_URL) {
  console.error("❌ Missing SERVER_URL");
  process.exit(1);
}

// =======================
// EXPRESS APP
// =======================

const app = express();
app.use(express.json());

// =======================
// TELEGRAM BOT (WEBHOOK MODE)
// =======================

const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
const TELEGRAM_WEBHOOK = `${SERVER_URL}/telegram`;

async function setWebhook() {
  try {
    await bot.setWebHook(TELEGRAM_WEBHOOK);
    console.log("✅ Telegram webhook set:", TELEGRAM_WEBHOOK);
  } catch (e) {
    console.error("❌ Failed to set Telegram webhook", e);
  }
}

// Telegram webhook route — **must return 200**
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// =======================
// BASIC BOT RESPONSE
// =======================

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🍻 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet:\n\`${BAR_WALLET}\`\n\n(Drink menu coming soon!)`,
    { parse_mode: "Markdown" }
  );
});

// =======================
// HELIUS WEBHOOK (WE MUST RETURN 200 ALWAYS)
// =======================

app.post("/helius", (req, res) => {
  console.log("📩 Helius webhook received:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// =======================
// HEALTH CHECK (GET /)
// =======================

app.get("/", (req, res) => {
  res.send("WIT Bot server running 🚀");
});

// =======================
// START SERVER
// =======================

app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);
  await setWebhook();
});









