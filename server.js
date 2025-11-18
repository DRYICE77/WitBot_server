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
  console.error("❌ Missing required environment variables!");
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
// EXPRESS SERVER
// =======================

const app = express();
app.use(express.json());

// =======================
// TELEGRAM BOT (WEBHOOK MODE)
// =======================

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  webHook: true,
  polling: false
});

const TELEGRAM_WEBHOOK = `${SERVER_URL}/telegram`;

async function initWebhook() {
  try {
    await bot.setWebHook(TELEGRAM_WEBHOOK);
    console.log("✅ Telegram webhook set:", TELEGRAM_WEBHOOK);
  } catch (err) {
    console.error("❌ Telegram webhook error:", err);
  }
}

// Telegram → Express → Bot
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});


// Commands shown in Telegram UI
bot.setMyCommands([
  { command: "menu", description: "Show drink menu 🍹" },
  { command: "buy_beer", description: "Buy a Beer (5 WIT)" },
  { command: "buy_cocktail", description: "Buy a Cocktail (10 WIT)" },
  { command: "buy_bucket", description: "Buy a Party Bucket (15 WIT)" },
]);

async function initWebhook() {
  try {
    await bot.setWebHook(TELEGRAM_WEBHOOK);
    console.log("✅ Telegram webhook set:", TELEGRAM_WEBHOOK);
  } catch (err) {
    console.error("❌ Telegram webhook error:", err);
  }
}

// Telegram → Express → Bot
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// =======================
// START COMMAND
// =======================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `🍻 *Welcome to the WIT Bar Bot!*\n\nSend WIT to the bar wallet:\n\`${BAR_WALLET}\`\n\nReply with your *Solana wallet address* to link your account.`,
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
// PURCHASE HANDLER
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

// Register buy commands
["beer", "cocktail", "bucket"].forEach((drinkKey) => {
  bot.onText(new RegExp(`/buy_${drinkKey}`), (msg) => {
    const chatId = msg.chat.id;

    const wallet = Object.keys(walletToTelegram).find(
      (w) => walletToTelegram[w] === chatId
    );

    if (!wallet) {
      bot.sendMessage(chatId, "❌ Please link your wallet first.");
      return;
    }

    handleBuy(drinkKey, chatId, wallet);
  });
});

// =======================
// HELIUS WEBHOOK
// =======================

// Prevent double crediting
let processed = new Set();

app.post("/helius", (req, res) => {
  try {
    const events = req.body;
    if (!Array.isArray(events)) return res.sendStatus(200);

    events.forEach((event) => {
      if (!event.tokenTransfers) return;

      event.tokenTransfers.forEach((t) => {
        if (t.mint !== WIT_MINT) return;
        if (t.toUserAccount !== BAR_WALLET) return;

        const sig = t.signature || event.signature;
        if (!sig) return;

        if (processed.has(sig)) return;
        processed.add(sig);

        if (processed.size > 5000) processed = new Set();

        const amount = Number(t.tokenAmount);
        const senderWallet = t.fromUserAccount;

        balances[senderWallet] = (balances[senderWallet] || 0) + amount;
        saveJSON(BAL_FILE, balances);

        const chatId = walletToTelegram[senderWallet];
        if (chatId) {
          bot.sendMessage(
            chatId,
            `🍻 *WIT RECEIVED!*\nYou sent *${amount} WIT*.\nNew balance: *${balances[senderWallet]} WIT*`,
            { parse_mode: "Markdown" }
          );

          bot.sendMessage(chatId, getMenuText());
        }
      });
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error in Helius webhook:", err);
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
  await initWebhook();
});














