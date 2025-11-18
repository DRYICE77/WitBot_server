require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const app = express();
app.use(express.json({ limit: "5mb" }));

// ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_WEBHOOK = process.env.TELEGRAM_WEBHOOK;
const PORT = process.env.PORT || 8080;

const BAR_WALLET = "4KHyVVoW4ejvaQmHjpREFbtRMSB9GLLXx8hD4UiYbZ5C";
const WIT_MINT = "Adq3wnAvtaXBNfy63xGV1YNKdIPKadDT469xF9uZPrqE";

// balances JSON
const DB_FILE = "./data/balances.json";
if (!fs.existsSync("./data")) fs.mkdirSync("./data");
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");

function load() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// BOT
const bot = new TelegramBot(BOT_TOKEN, { polling: false });
bot.setWebHook(TELEGRAM_WEBHOOK);

// Track processed signatures
let processed = new Set();

app.post("/helius", async (req, res) => {
  console.log("📬 Incoming Helius Webhook:", JSON.stringify(req.body, null, 2));

  const txs = req.body;
  let balances = load();

  for (const tx of txs) {

    const sig = tx.signature;
    if (processed.has(sig)) {
      console.log("⚠️ Already processed, skipping:", sig);
      continue;
    }

    // TOKEN TRANSFERS APPEAR HERE
    const transfers =
      tx.events?.tokenTransfers ||
      tx.tokenTransfers ||
      [];

    if (!transfers.length) continue;

    for (const t of transfers) {
      if (
        t.mint === WIT_MINT &&
        t.toUserAccount === BAR_WALLET
      ) {
        const amt = Number(t.tokenAmount);
        const fromWallet = t.fromUserAccount;
        const tgId = balances[fromWallet]?.telegramId;

        console.log("🔥 VALID WIT TRANSFER DETECTED:", amt);

        if (!tgId) {
          console.log("No telegram linked for:", fromWallet);
          continue;
        }

        // Update user balance
        balances[fromWallet].balance =
          (balances[fromWallet].balance || 0) + amt;
        save(balances);

        processed.add(sig);

        await bot.sendMessage(
          tgId,
          `🍺 *WIT RECEIVED!*\nYou sent *${amt} WIT* to the bar.\nNew balance: *${balances[fromWallet].balance} WIT*`,
          { parse_mode: "Markdown" }
        );

        console.log("✅ Notified Telegram user", tgId);
      }
    }
  }

  res.sendStatus(200);
});

// Telegram webhook
app.post("/telegram", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Commands
bot.onText(/\/start/, (msg) => {
  const id = msg.chat.id;
  const balances = load();
  const existing = Object.values(balances).find((x) => x.telegramId === id);

  if (existing) {
    bot.sendMessage(id, "🍺 Welcome back to the WIT Bar!");
    return;
  }

  const wallet = msg.text.split(" ")[1];
  if (!wallet) {
    bot.sendMessage(id, "Send your wallet with: /start YOUR_WALLET");
    return;
  }

  balances[wallet] = { telegramId: id, balance: 0 };
  save(balances);

  bot.sendMessage(id, "🔗 Wallet linked! I’ll notify you when WIT arrives.");
});

app.listen(PORT, () => {
  console.log(`🚀 WitPay running on port ${PORT}`);
});













