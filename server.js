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
const WIT_MINT = process.env.WIT_MINT;
const SERVER_URL = process.env.SERVER_URL;
const PORT = process.env.PORT || 8080;

if (!TELEGRAM_TOKEN || !BAR_WALLET || !WIT_MINT || !SERVER_URL) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

// =======================
// DRINK MENU
// =======================

const MENU = {
  beer: { name: "Beer 🍺", price: 5 },
  cocktail: { name: "Cocktail 🍸", price: 10 },
  bucket: { name: "Party Bucket 🎉", price: 15 },
};

function getMenuText() {
  return (
    "🍹 WIT Bar Menu\n\n" +
    Object.entries(MENU)
      .map(
        ([key, item]) =>
          `${item.name} — ${item.price} WIT\nBuy: /buy_${key}`
      )
      .join("\n\n")
  );
}

// =======================
// JSON STORAGE
// =======================

const BAL_FILE = path.join(__dirname, "balances.json");
const MAP_FILE = path.join(__dirname, "usermap.json");
const PROCESSED_FILE = path.join(__dirname, "processed.json");

function loadJSON(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let balances = loadJSON(BAL_FILE);
let walletToTelegram = loadJSON(MAP_FILE);
let processedTxs = loadJSON(PROCESSED_FILE);

// =======================
// EXPRESS
// =======================

const app = express();
app.use(express.json());

// =======================
// TELEGRAM BOT
// =======================

const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
const TELEGRAM_WEBHOOK = `${SERVER_URL}/telegram`;

async function setWebhook() {
  try {
    await bot.setWebHook(TELEGRAM_WEBHOOK);
    console.log("✅ Telegram webhook set:", TELEGRAM_WEBHOOK);
  } catch (err) {
    console.error("❌ Webhook error:", err);
  }
}

app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// =======================
// /start
// =======================

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🍻 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet:\n\`${BAR_WALLET}\`\n\nReply with your *Solana wallet address* to link your WIT balance.`,
    { parse_mode: "Markdown" }
  );
});

// =======================
// WALLET LINKING
// =======================

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text) return;

  if (text.length > 30 && text.length < 60 && !text.startsWith("/")) {
    walletToTelegram[text] = chatId;
    saveJSON(MAP_FILE, walletToTelegram);

    bot.sendMessage(chatId, "🔗 Wallet linked!");
    bot.sendMessage(chatId, getMenuText());
  }
});

// =======================
// MENU COMMAND
// =======================

bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, getMenuText());
});

// =======================
// BUY DRINK HANDLER
// =======================

function handleBuy(drinkKey, chatId, wallet) {
  const item = MENU[drinkKey];
  const balance = balances[wallet] || 0;

  if (balance < item.price) {
    bot.sendMessage(
      chatId,
      `❌ Not enough WIT!\n${item.name} costs *${item.price} WIT* but you only have *${balance} WIT*.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  balances[wallet] = balance - item.price;
  saveJSON(BAL_FILE, balances);

  const ticketId = Math.random().toString(36).substring(2, 8).toUpperCase();

  bot.sendMessage(
    chatId,
    `🎫 *Drink Ticket Created!*\n\n${item.name}\nPrice: *${item.price} WIT*\nTicket ID: \`${ticketId}\``,
    { parse_mode: "Markdown" }
  );
}

["beer", "cocktail", "bucket"].forEach((key) => {
  bot.onText(new RegExp(`/buy_${key}`), (msg) => {
    const chatId = msg.chat.id;
    const wallet = Object.keys(walletToTelegram).find(
      (w) => walletToTelegram[w] === chatId
    );

    if (!wallet) {
      bot.sendMessage(chatId, "❌ Please link your wallet first.");
      return;
    }

    handleBuy(key, chatId, wallet);
  });
});

// =======================
// HELIUS WEBHOOK (WITH LOGGING ADDED)
// =======================

app.post("/helius", (req, res) => {
  try {
    // 🔥 PRINT THE RAW WEBHOOK BODY
    console.log("📩 Incoming Helius Webhook:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    // Helius sometimes sends raw object, sometimes array
    const tx = Array.isArray(body) ? body[0] : body;
    if (!tx) return res.sendStatus(200);

    const signature = tx.signature || tx.transaction?.signature;

    if (!tx.tokenTransfers && !tx.events && !tx.transaction) {
      console.log("ℹ️ No transaction content found.");
    }

    // SUPPORT MULTIPLE POTENTIAL LOCATIONS FOR tokenTransfers
    const possibleTransfers =
      tx.tokenTransfers ||
      tx.events?.tokenTransfers ||
      tx.transaction?.tokenTransfers ||
      tx.transaction?.events?.tokenTransfers ||
      [];

    if (!possibleTransfers || possibleTransfers.length === 0) {
      console.log("ℹ️ No SPL transfers found.");
      return res.sendStatus(200);
    }

    possibleTransfers.forEach((t) => {
      const isWit =
        t.mint === WIT_MINT && t.toUserAccount === BAR_WALLET;

      if (!isWit) return;

      if (processedTxs[signature]) {
        console.log("⚠️ Duplicate processed:", signature);
        return;
      }

      processedTxs[signature] = true;
      saveJSON(PROCESSED_FILE, processedTxs);

      const amount = Number(t.tokenAmount);
      const sender = t.fromUserAccount;

      balances[sender] = (balances[sender] || 0) + amount;
      saveJSON(BAL_FILE, balances);

      const telegramId = walletToTelegram[sender];
      if (telegramId) {
        bot.sendMessage(
          telegramId,
          `🍻 *WIT RECEIVED!*\nYou sent *${amount} WIT*.\nNew balance: *${balances[sender]} WIT*`,
          { parse_mode: "Markdown" }
        );

        bot.sendMessage(telegramId, getMenuText());
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(200);
  }
});

// =======================
// ROOT ENDPOINT
// =======================

app.get("/", (req, res) => {
  res.send("WitPay Server Running 🚀");
});

// =======================
// START SERVER
// =======================

app.listen(PORT, async () => {
  console.log(`🚀 WitPay server running on port ${PORT}`);
  await setWebhook();
});












