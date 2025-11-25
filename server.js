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
    "🍹 *WIT Bar Menu*\n\n" +
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
const TICKETS_FILE = path.join(__dirname, "tickets.json");

function loadJSON(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let balances = loadJSON(BAL_FILE);
let walletToTelegram = loadJSON(MAP_FILE);
let tickets = loadJSON(TICKETS_FILE);

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

bot.setMyCommands([
  { command: "start", description: "Start WitPay" },
  { command: "connect", description: "Connect your Solana wallet" },
  { command: "balance", description: "Check your WIT balance" },
  { command: "tickets", description: "See your drink tickets" },
  { command: "menu", description: "Show drink menu" }
]);

async function setWebhook() {
  await bot.setWebHook(TELEGRAM_WEBHOOK);
  console.log("✅ Telegram webhook set:", TELEGRAM_WEBHOOK);
}

app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// =======================
// HELPERS
// =======================

function getUserWallet(chatId) {
  return Object.keys(walletToTelegram).find(
    (wallet) => walletToTelegram[wallet] === chatId
  );
}

function getUserTickets(wallet) {
  return tickets[wallet] || [];
}

// =======================
// /start
// =======================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const wallet = getUserWallet(chatId);

  if (!wallet) {
    bot.sendMessage(
      chatId,
      `🍻 *Welcome to the WitPay Bot!*\n\nUse this bot to buy drinks at the *Holiday Cocktail Lounge* with *WIT coin*.\n\nNo wallet connected.\nPress 👉 /connect to link your wallet.`,
      { parse_mode: "Markdown" }
    );
  } else {
    const balance = balances[wallet] || 0;

    bot.sendMessage(
      chatId,
      `✅ *Wallet connected*\n\nWallet:\n\`${wallet}\`\n\nBalance: *${balance} WIT*\n\nUse /menu to buy a drink 🍹`,
      { parse_mode: "Markdown" }
    );
  }
});

// =======================
// /connect
// =======================

bot.onText(/\/connect/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🔗 Reply with your *Solana wallet address* to connect it:",
    { parse_mode: "Markdown" }
  );
});

// Wallet linking
bot.on("message", (msg) => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.length > 30 && text.length < 60 && !text.startsWith("/")) {
    walletToTelegram[text] = chatId;
    saveJSON(MAP_FILE, walletToTelegram);

    bot.sendMessage(chatId, "✅ Wallet linked successfully!");
    bot.sendMessage(chatId, getMenuText(), { parse_mode: "Markdown" });
  }
});

// =======================
// /menu
// =======================

bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, getMenuText(), { parse_mode: "Markdown" });
});

// =======================
// /balance
// =======================

bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  const wallet = getUserWallet(chatId);

  if (!wallet) {
    return bot.sendMessage(chatId, "❌ No wallet connected. Use /connect");
  }

  const balance = balances[wallet] || 0;

  bot.sendMessage(
    chatId,
    `💳 *Your WIT Balance*\n\nWallet: \`${wallet}\`\nBalance: *${balance} WIT*`,
    { parse_mode: "Markdown" }
  );
});

// =======================
// /tickets
// =======================

bot.onText(/\/tickets/, (msg) => {
  const chatId = msg.chat.id;
  const wallet = getUserWallet(chatId);

  if (!wallet) {
    return bot.sendMessage(chatId, "❌ No wallet connected. Use /connect");
  }

  const userTickets = getUserTickets(wallet);

  if (userTickets.length === 0) {
    return bot.sendMessage(chatId, "🎫 You have no tickets yet");
  }

  const list = userTickets.map(t =>
    `${t.name}\nID: ${t.id}\nPrice: ${t.price} WIT`
  ).join("\n\n");

  bot.sendMessage(
    chatId,
    `🎟️ *Your Tickets*\n\n${list}`,
    { parse_mode: "Markdown" }
  );
});

// =======================
// BUY HANDLER
// =======================

function handleBuy(drinkKey, chatId, wallet) {
  const item = MENU[drinkKey];
  const balance = balances[wallet] || 0;

  if (balance < item.price) {
    return bot.sendMessage(
      chatId,
      `❌ Not enough WIT\n${item.price} WIT required`
    );
  }

  balances[wallet] = balance - item.price;
  saveJSON(BAL_FILE, balances);

  const ticketId = Math.random().toString(36).substring(2, 8).toUpperCase();

  if (!tickets[wallet]) tickets[wallet] = [];

  tickets[wallet].push({
    id: ticketId,
    name: item.name,
    price: item.price,
    time: new Date().toISOString()
  });

  saveJSON(TICKETS_FILE, tickets);

  bot.sendMessage(
    chatId,
    `🎫 *Drink Ticket Created!*\n\n${item.name}\nPrice: ${item.price} WIT\nTicket ID: \`${ticketId}\`\n\nRemaining Balance: *${balances[wallet]} WIT*`,
    { parse_mode: "Markdown" }
  );
}

// Buy routes
["beer", "cocktail", "bucket"].forEach((drinkKey) => {
  bot.onText(new RegExp(`/buy_${drinkKey}`), (msg) => {
    const chatId = msg.chat.id;
    const wallet = getUserWallet(chatId);

    if (!wallet) {
      return bot.sendMessage(chatId, "❌ Use /connect first");
    }

    handleBuy(drinkKey, chatId, wallet);
  });
});

// =======================
// HELIUS WEBHOOK
// =======================

app.post("/helius", (req, res) => {
  try {
    const tx = req.body?.[0];
    if (!tx?.tokenTransfers) return res.sendStatus(200);

    tx.tokenTransfers.forEach((t) => {
      if (t.mint === WIT_MINT && t.toUserAccount === BAR_WALLET) {

        const amount = Number(t.tokenAmount);
        const senderWallet = t.fromUserAccount;

        balances[senderWallet] = (balances[senderWallet] || 0) + amount;
        saveJSON(BAL_FILE, balances);

        const telegramId = walletToTelegram[senderWallet];

        if (telegramId) {
          bot.sendMessage(
            telegramId,
            `🍻 *WIT RECEIVED*\n+${amount} WIT\nBalance: *${balances[senderWallet]} WIT*`,
            { parse_mode: "Markdown" }
          );

          bot.sendMessage(telegramId, getMenuText(), { parse_mode: "Markdown" });
        }
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

// =======================
// ROOT
// =======================

app.get("/", (req, res) => {
  res.send("🚀 WitPay Server Running");
});

// =======================
// START SERVER
// =======================

app.listen(PORT, () => {
  console.log(`🚀 WitPay running on ${PORT}`);
  setWebhook();
});














