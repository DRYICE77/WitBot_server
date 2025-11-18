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
const WIT_MINT = process.env.WIT_MINT;     // <--- ADD THIS
const SERVER_URL = process.env.SERVER_URL;

const PORT = process.env.PORT || 8080;

if (!TELEGRAM_TOKEN || !SERVER_URL || !BAR_WALLET || !WIT_MINT) {
  console.error("❌ Missing one of: BOT_TOKEN, SERVER_URL, BAR_WALLET, WIT_MINT");
  process.exit(1);
}

// =======================
// LOAD USER BALANCES
// =======================

const DATA_FILE = path.join(__dirname, "balances.json");

function loadBalances() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveBalances(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let balances = loadBalances();

// Track wallet → Telegram ID bindings
const USER_MAP_FILE = path.join(__dirname, "usermap.json");

function loadMap() {
  if (!fs.existsSync(USER_MAP_FILE)) return {};
  return JSON.parse(fs.readFileSync(USER_MAP_FILE));
}

function saveMap(data) {
  fs.writeFileSync(USER_MAP_FILE, JSON.stringify(data, null, 2));
}

let walletToTelegram = loadMap();

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

app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// =======================
// /start command
// =======================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `🍻 *Welcome to the WIT Bar Bot!*\n\nYour bar wallet:\n\`${BAR_WALLET}\`\n\nSend WIT to buy drinks!`,
    { parse_mode: "Markdown" }
  );

  // Ask user to link their wallet
  bot.sendMessage(
    chatId,
    "Reply with your *Solana wallet address* so I know where to credit your WIT!",
    { parse_mode: "Markdown" }
  );
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // simple solana wallet detector
  if (text && text.length > 30) {
    walletToTelegram[text] = chatId;
    saveMap(walletToTelegram);
    bot.sendMessage(chatId, `🔗 Wallet linked!\nI will notify you when WIT arrives.`);
  }
});

// =======================
// HELIUS WEBHOOK
// =======================

app.post("/helius", (req, res) => {
  try {
    const body = req.body;
    console.log("📩 Helius webhook received");

    if (!body || !body[0]) {
      console.log("❌ No transaction data");
      return res.sendStatus(200);
    }

    const tx = body[0];

    // Look for SPL token transfers
    if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
      console.log("ℹ️ No token transfers found");
      return res.sendStatus(200);
    }

    tx.tokenTransfers.forEach((t) => {
      if (
        t.mint === WIT_MINT &&
        t.toUserAccount === BAR_WALLET
      ) {
        const amount = Number(t.tokenAmount);

        console.log("🎉 WIT RECEIVED!", amount);

        // Find who sent it
        const sender = t.fromUserAccount;
        const telegramId = walletToTelegram[sender];

        // Credit balance
        balances[sender] = (balances[sender] || 0) + amount;
        saveBalances(balances);

        if (telegramId) {
          bot.sendMessage(
            telegramId,
            `🍻 *WIT RECEIVED!*\nYou sent *${amount} WIT* to the bar.\nYour new balance: *${balances[sender]} WIT*`,
            { parse_mode: "Markdown" }
          );
        } else {
          console.log("⚠️ No Telegram user linked for wallet", sender);
        }
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error in Helius webhook:", err);
    res.sendStatus(200);
  }
});

// =======================
// ROOT
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









