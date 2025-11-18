require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { Telegraf } = require("telegraf");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// ============================
//   Load / Save User Balances
// ============================

const DATA_PATH = path.join(__dirname, "data.json");

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

let db = loadData();

// ============================
//     Telegram Bot Setup
// ============================

const bot = new Telegraf(process.env.BOT_TOKEN);

const BAR_WALLET = process.env.BAR_WALLET;
const WIT_MINT = process.env.WIT_MINT;

// Drink prices
const DRINKS = {
  beer: 5,
  cocktail: 10,
  bucket: 15,
};

// -----------------------------
// Start Command
// -----------------------------
bot.start((ctx) => {
  const userId = String(ctx.from.id);

  if (!db[userId]) {
    db[userId] = { wallet: null, balance: 0 };
    saveData(db);
  }

  ctx.reply(
    `🍻 Welcome to the WIT Bar Bot!\n\nYour bar wallet:\n${BAR_WALLET}\n\nSend WIT to buy drinks!\n\nReply with your *Solana wallet address* so I know where to credit your WIT.`,
    { parse_mode: "Markdown" }
  );
});

// -----------------------------
// Handle Wallet Address
// -----------------------------
bot.on("text", (ctx) => {
  const userId = String(ctx.from.id);
  const text = ctx.message.text.trim();

  // If message looks like a Solana address
  if (text.length >= 32 && text.length <= 60) {
    db[userId].wallet = text;
    saveData(db);
    return ctx.reply("🔗 Wallet linked!\nI will notify you when WIT arrives.");
  }
});

// -----------------------------
// Drink Menu Command
// -----------------------------
bot.command("menu", (ctx) => sendMenu(ctx));

function sendMenu(ctx) {
  ctx.reply(
    `🍹 *WIT Bar Menu*\n
Beer 🍺 — 5 WIT
Buy: /buy_beer

Cocktail 🍸 — 10 WIT
Buy: /buy_cocktail

Party Bucket 🎉 — 15 WIT
Buy: /buy_bucket
`,
    { parse_mode: "Markdown" }
  );
}

// -----------------------------
// Purchase Commands
// -----------------------------
bot.command("buy_beer", (ctx) => attemptPurchase(ctx, "beer"));
bot.command("buy_cocktail", (ctx) => attemptPurchase(ctx, "cocktail"));
bot.command("buy_bucket", (ctx) => attemptPurchase(ctx, "bucket"));

function attemptPurchase(ctx, drink) {
  const userId = String(ctx.from.id);
  const price = DRINKS[drink];

  if (!db[userId]) {
    return ctx.reply("❌ You must /start first.");
  }

  const balance = db[userId].balance;

  if (balance < price) {
    return ctx.reply(
      `❌ Not enough WIT!\n${drinkLabel(drink)} costs *${price} WIT* but you only have *${balance} WIT*.`,
      { parse_mode: "Markdown" }
    );
  }

  db[userId].balance -= price;
  saveData(db);

  ctx.reply(
    `🎉 You bought a ${drinkLabel(drink)}!\nRemaining Balance: *${db[userId].balance} WIT*`,
    { parse_mode: "Markdown" }
  );
}

function drinkLabel(d) {
  if (d === "beer") return "Beer 🍺";
  if (d === "cocktail") return "Cocktail 🍸";
  if (d === "bucket") return "Party Bucket 🎉";
  return d;
}

// ============================
//       HELIUS WEBHOOK
// ============================

app.post("/helius", (req, res) => {
  const body = req.body;

  console.log("📬 Incoming Helius:", JSON.stringify(body, null, 2));

  if (!Array.isArray(body)) {
    return res.status(200).send("ignored");
  }

  for (const event of body) {
    if (!event.tokenTransfers) continue;

    for (const t of event.tokenTransfers) {
      // Check the mint
      if (t.mint !== WIT_MINT) continue;

      // Must be TO the bar wallet
      if (t.toUserAccount !== BAR_WALLET) continue;

      const amount = Number(t.tokenAmount);
      const fromWallet = t.fromUserAccount;

      // Find which Telegram user this wallet belongs to
      const userId = Object.keys(db).find((uid) => db[uid].wallet === fromWallet);
      if (!userId) continue;

      // Credit user
      db[userId].balance += amount;
      saveData(db);

      // Send Telegram message
      bot.telegram.sendMessage(
        userId,
        `🍻 *WIT RECEIVED!*\nYou sent *${amount} WIT* to the bar.\nNew balance: *${db[userId].balance} WIT*`,
        { parse_mode: "Markdown" }
      );
    }
  }

  res.status(200).send("ok");
});

// ============================
//      TELEGRAM WEBHOOK
// ============================

app.post("/telegram", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// ============================
//        START SERVER
// ============================

const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`🚀 WitPay server running on port ${PORT}`);

  // Set webhook on startup
  const url = process.env.WEBHOOK_URL;
  if (url) {
    try {
      await bot.telegram.setWebhook(`${url}/telegram`);
      console.log("✅ Telegram webhook set:", `${url}/telegram`);
    } catch (err) {
      console.error("❌ Failed to set webhook", err);
    }
  }
});













