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

if (!TELEGRAM_TOKEN || !SERVER_URL || !BAR_WALLET || !WIT_MINT) {
  console.error("❌ Missing required env vars");
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

// =======================
// DATA STORAGE (JSON FILES)
// =======================

const BAL_FILE = path.join(__dirname, "balances.json");
const MAP_FILE = path.join(__dirname, "usermap.json");

// Load balances
function loadJSON(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let balances = loadJSON(BAL_FILE);
let walletToTelegram = loadJSON(MAP_FILE);

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
    console.error("❌ Failed to set webhook", e);
  }
}

app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// =======================
// /start COMMAND
// =======================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `🍻 *Welcome to the WIT Bar Bot!*\n\nYour bar wallet:\n\`${BAR_WALLET}\`\n\nSend WIT to buy drinks!\n\nReply with your *Solana wallet address* to link your account.`,
    { parse_mode: "Markdown" }
  );
});

// =======================
// WALLET LINKING
// =======================

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // Quick Solana address validation
  if (text && text.length > 30 && text.length < 60) {
    walletToTelegram[text] = chatId;
    saveJSON(MAP_FILE, walletToTelegram);

    bot.sendMessage(chatId, `🔗 Wallet linked!\nI will notify you when WIT arrives.`);
  }
});

// =======================
// /menu COMMAND
// =======================

bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;

  const menuString =
    `🍹 *WIT Bar Menu*\n\n` +
    Object.entries(MENU)
      .map(
        ([k, item]) => `${item.name} — *${item.price} WIT*\nBuy: /buy_${k}`
      )
      .join("\n\n");

  bot.sendMessage(chatId, menuString, { parse_mode: "Markdown" });
});

// =======================
// DRINK PURCHASE HANDLER
// =======================

function handleBuy(drinkKey, chatId, wallet) {
  const item = MENU[drinkKey];
  if (!item) return;

  const userBalance = balances[wallet] || 0;

  if (userBalance < item.price) {
    bot.sendMessage(
      chatId,
      `❌ Not enough WIT!\n${item.name} costs *${item.price} WIT* but you only have *${userBalance} WIT*.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Deduct cost
  balances[wallet] = userBalance - item.price;
  saveJSON(BAL_FILE, balances);

  const ticketId = Math.random().toString(36).slice(2, 8).toUpperCase();

  bot.sendMessage(
    chatId,
    `🎫 *Drink Ticket Created!*\n\n` +
      `${item.name}\nCost: *${item.price} WIT*\n\n` +
      `Ticket ID: \`${ticketId}\`\n\n` +
      `Show this ticket to the bartender to redeem.`,
    { parse_mode: "Markdown" }
  );
}

// =======================
// BUY COMMANDS
// =======================

["beer", "cocktail", "bucket"].forEach((drinkKey) => {
  bot.onText(new RegExp(`/buy_${drinkKey}`), (msg) => {
    const chatId = msg.chat.id;

    const wallet = Object.keys(walletToTelegram).find(
      (w) => walletToTelegram[w] === chatId
    );

    if (!wallet) {
      bot.sendMessage(chatId, "❌ Please link your wallet first by sending it.");
      return;
    }

    handleBuy(drinkKey, chatId, wallet);
  });
});

// =======================
// HELIUS WEBHOOK (WIT TRANSFERS)
// =======================

app.post("/helius", (req, res) => {
  try {
    const body = req.body;
    if (!body || !body[0]) return res.sendStatus(200);

    const tx = body[0];

    if (!tx.tokenTransfers) return res.sendStatus(200);

    tx.tokenTransfers.forEach((t) => {
      if (t.mint === WIT_MINT && t.toUserAccount === BAR_WALLET) {
        const amount = Number(t.tokenAmount);
        const sender = t.fromUserAccount;

        // Save balance
        balances[sender] = (balances[sender] || 0) + amount;
        saveJSON(BAL_FILE, balances);

        const telegramId = walletToTelegram[sender];

        if (telegramId) {
          bot.sendMessage(
            telegramId,
            `🍻 *WIT RECEIVED!*\nYou sent *${amount} WIT* to the bar.\nYour new balance: *${balances[sender]} WIT*`,
            { parse_mode: "Markdown" }
          );
        }
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Helius webhook error:", err);
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
  console.log("🚀 WitPay Server running on port", PORT);
  await setWebhook();
});









