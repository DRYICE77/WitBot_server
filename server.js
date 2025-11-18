import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";

// =======================
// ENV + PATH
// =======================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const BAR_WALLET = process.env.BAR_WALLET;        // Main SOL wallet
const WIT_MINT = process.env.WIT_MINT;
const SERVER_URL = process.env.SERVER_URL;
const PORT = process.env.PORT || 8080;

if (!TELEGRAM_TOKEN || !BAR_WALLET || !WIT_MINT || !SERVER_URL) {
  console.error("❌ Missing env vars");
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
      .map(([k, i]) => `${i.name} — ${i.price} WIT\nBuy: /buy_${k}`)
      .join("\n\n")
  );
}

// =======================
// STORAGE
// =======================

const BAL_FILE = path.join(__dirname, "balances.json");
const MAP_FILE = path.join(__dirname, "usermap.json");
const PROCESSED_FILE = path.join(__dirname, "processed.json");

function load(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let balances = load(BAL_FILE);
let walletToTelegram = load(MAP_FILE);
let processedTxs = load(PROCESSED_FILE);

// =======================
// EXPRESS
// =======================

const app = express();
app.use(express.json());

// =======================
// TELEGRAM
// =======================

const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
const TELEGRAM_WEBHOOK = `${SERVER_URL}/telegram`;

async function initWebhook() {
  try {
    await bot.setWebHook(TELEGRAM_WEBHOOK);
    console.log("✅ Telegram webhook set:", TELEGRAM_WEBHOOK);
  } catch (e) {
    console.error("❌ Failed to set webhook", e);
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
    `🍻 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet:\n\`${BAR_WALLET}\`\n\nReply with your *Solana wallet address* to link.`,
    { parse_mode: "Markdown" }
  );
});

// =======================
// WALLET LINKING
// =======================

bot.on("message", (msg) => {
  const text = msg.text?.trim();
  if (!text || text.startsWith("/")) return;

  // Wallet pattern
  if (text.length > 30 && text.length < 60) {
    walletToTelegram[text] = msg.chat.id;
    save(MAP_FILE, walletToTelegram);

    bot.sendMessage(msg.chat.id, "🔗 Wallet linked!");
    bot.sendMessage(msg.chat.id, getMenuText());
  }
});

// =======================
// MENU COMMAND
// =======================

bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, getMenuText());
});

// =======================
// DRINK PURCHASE
// =======================

function buyDrink(drink, chatId, wallet) {
  const item = MENU[drink];
  const bal = balances[wallet] || 0;

  if (bal < item.price) {
    bot.sendMessage(
      chatId,
      `❌ Not enough WIT!\n${item.name} costs *${item.price} WIT* but you have *${bal} WIT*.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  balances[wallet] = bal - item.price;
  save(BAL_FILE, balances);

  const ticketId = Math.random().toString(36).substring(2, 8).toUpperCase();

  bot.sendMessage(
    chatId,
    `🎫 *Drink Ticket Created!*\n\n${item.name}\nCost: *${item.price} WIT*\nTicket ID: \`${ticketId}\``,
    { parse_mode: "Markdown" }
  );
}

["beer", "cocktail", "bucket"].forEach((name) => {
  bot.onText(new RegExp(`/buy_${name}`), (msg) => {
    const chatId = msg.chat.id;

    const wallet = Object.keys(walletToTelegram).find(
      (w) => walletToTelegram[w] === chatId
    );

    if (!wallet) return bot.sendMessage(chatId, "❌ Please link your wallet first.");

    buyDrink(name, chatId, wallet);
  });
});

// =======================
// HELIUS WEBHOOK — FULLY FIXED
// =======================

app.post("/helius", (req, res) => {
  try {
    console.log("📩 Incoming Helius Webhook:", JSON.stringify(req.body, null, 2));

    const body = Array.isArray(req.body) ? req.body[0] : req.body;
    if (!body) return res.sendStatus(200);

    const signature = body.signature;
    if (!signature) return res.sendStatus(200);

    // Enhanced webhook token transfers:
    const transfers = body.tokenTransfers || [];

    if (!transfers.length) {
      console.log("ℹ️ No tokenTransfers section found.");
      return res.sendStatus(200);
    }

    transfers.forEach((t) => {
      // Check WIT transfer TO bar wallet
      const isWit =
        t.mint === WIT_MINT &&
        t.toUserAccount === BAR_WALLET;

      if (!isWit) return;

      // Idempotency
      if (processedTxs[signature]) {
        console.log("⚠️ Duplicate ignored:", signature);
        return;
      }
      processedTxs[signature] = true;
      save(PROCESSED_FILE, processedTxs);

      // THE FIX:
      // Use t.userAccount (REAL WALLET) instead of ATA addresses.
      const senderWallet = t.userAccount;

      const amount = Number(t.tokenAmount);
      balances[senderWallet] = (balances[senderWallet] || 0) + amount;
      save(BAL_FILE, balances);

      const telegramId = walletToTelegram[senderWallet];
      if (telegramId) {
        bot.sendMessage(
          telegramId,
          `🍻 *WIT RECEIVED!*\nYou sent *${amount} WIT*.\nYour new balance: *${balances[senderWallet]} WIT*`,
          { parse_mode: "Markdown" }
        );
        bot.sendMessage(telegramId, getMenuText());
      }
    });

    res.sendStatus(200);
  } catch (e) {
    console.error("❌ Webhook error:", e);
    res.sendStatus(200);
  }
});

// =======================
// SERVER
// =======================

app.get("/", (req, res) => res.send("WitPay Server Running 🚀"));

app.listen(PORT, async () => {
  console.log(`🚀 Server running on ${PORT}`);
  await initWebhook();
});












