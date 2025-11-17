// server.js
import express from 'express';
import bodyParser from 'body-parser';
import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Path helpers (because we’re in an ES module) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Env vars ---
const {
  BOT_TOKEN,
  BAR_WALLET,
  WIT_MINT,
  PORT = 8080,
  SERVER_URL,
  TARGET_CHAT,
} = process.env;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
}
if (!BAR_WALLET) {
  console.error('❌ BAR_WALLET is missing');
}
if (!WIT_MINT) {
  console.error('❌ WIT_MINT is missing');
}

// --- Simple "database" in ./data/state.json ---
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');

let state = {
  users: {},               // { telegramId: { wallet } }
  balances: {},            // { telegramId: number WIT }
  tickets: {},             // { ticketId: { userId, drinkKey, amount, createdAt, redeemed } }
  processedSignatures: {}, // { signature: true }
};

function ensureStateFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      if (raw.trim()) {
        const loaded = JSON.parse(raw);
        state = {
          ...state,
          ...loaded,
          users: loaded.users || {},
          balances: loaded.balances || {},
          tickets: loaded.tickets || {},
          processedSignatures: loaded.processedSignatures || {},
        };
      }
      console.log('📁 Loaded state from data/state.json');
    } catch (err) {
      console.error('⚠️ Failed to read state.json, starting fresh:', err.message);
    }
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    console.log('📁 Created new data/state.json');
  }
}

async function saveState() {
  try {
    await fs.promises.writeFile(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('⚠️ Failed to save state:', err.message);
  }
}

// Helper lookups
function getBalance(userId) {
  return state.balances[userId] || 0;
}

function adjustBalance(userId, delta) {
  const current = getBalance(userId);
  state.balances[userId] = Math.max(0, current + delta);
}

function findUserIdByWallet(wallet) {
  if (!wallet) return null;
  for (const [userId, info] of Object.entries(state.users)) {
    if (info.wallet === wallet) return userId;
  }
  return null;
}

// --- Drink menu ---
const DRINKS = {
  BEER:        { key: 'BEER',        name: 'Beer',          price: 5 },
  COCKTAIL:    { key: 'COCKTAIL',    name: 'Cocktail',      price: 10 },
  PARTY_BUCKET:{ key: 'PARTY_BUCKET',name: 'Party Bucket',  price: 20 },
};

function buildMenuText() {
  return [
    '🍹 *WIT Bar Menu*',
    '',
    `• ${DRINKS.BEER.name}: *${DRINKS.BEER.price} WIT*`,
    `• ${DRINKS.COCKTAIL.name}: *${DRINKS.COCKTAIL.price} WIT*`,
    `• ${DRINKS.PARTY_BUCKET.name}: *${DRINKS.PARTY_BUCKET.price} WIT*`,
  ].join('\n');
}

// ticket id (text code for now – can turn into QR later)
function generateTicketId(drinkKey, userId) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WIT-${drinkKey}-${userId}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

// --- Telegram bot setup ---
const bot = new Telegraf(BOT_TOKEN);
const pendingWalletLink = new Set(); // telegramId strings

async function sendBarMessage(text) {
  if (!TARGET_CHAT) return;
  try {
    await bot.telegram.sendMessage(TARGET_CHAT, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('⚠️ Failed to send to TARGET_CHAT:', err.message);
  }
}

function short(addr = '') {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// --- /start ---
async function sendWelcome(ctx) {
  const menuText = buildMenuText();

  const text = [
    '🍹 *Welcome to the WIT Bar Bot!*',
    '',
    'Send WIT to the bar wallet:',
    `\`${BAR_WALLET}\``,
    '',
    menuText,
    '',
    '1. Tap *Connect Wallet* and paste the wallet you\'ll send WIT from.',
    '2. Send WIT to the bar wallet.',
    '3. Use *Order Drink* to turn your WIT balance into drink tickets.',
  ].join('\n');

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔗 Connect Wallet', 'connect_wallet')],
      [Markup.button.callback('💰 Check Balance', 'check_balance')],
      [Markup.button.callback('🍹 Order Drink', 'order_drink_menu')],
    ]),
  });
}

bot.start(sendWelcome);

// --- Actions: connect wallet / balance / order drinks ---
bot.action('connect_wallet', async (ctx) => {
  const userId = String(ctx.from.id);
  pendingWalletLink.add(userId);
  await ctx.answerCbQuery();
  await ctx.reply(
    '🔗 Please reply with the *Solana wallet address* you will use to send WIT.',
    { parse_mode: 'Markdown' }
  );
});

bot.command('balance', async (ctx) => {
  const userId = String(ctx.from.id);
  const balance = getBalance(userId);
  await ctx.reply(
    `💰 Your WIT Bar balance is *${balance} WIT*.`,
    { parse_mode: 'Markdown' }
  );
});

bot.action('check_balance', async (ctx) => {
  const userId = String(ctx.from.id);
  const balance = getBalance(userId);
  await ctx.answerCbQuery();
  await ctx.reply(
    `💰 Your WIT Bar balance is *${balance} WIT*.`,
    { parse_mode: 'Markdown' }
  );
});

bot.action('order_drink_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    'What would you like to order?',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🍺 Beer', 'order_BEER'),
        Markup.button.callback('🍸 Cocktail', 'order_COCKTAIL'),
      ],
      [
        Markup.button.callback('🪣 Party Bucket', 'order_PARTY_BUCKET'),
      ],
    ])
  );
});

async function handleDrinkOrder(ctx, drinkKey) {
  const drink = DRINKS[drinkKey];
  if (!drink) {
    await ctx.answerCbQuery('Unknown drink', { show_alert: true });
    return;
  }

  const userId = String(ctx.from.id);
  const balance = getBalance(userId);

  if (balance < drink.price) {
    await ctx.reply(
      `❌ You need *${drink.price} WIT* for a ${drink.name}, but you only have *${balance} WIT*.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  adjustBalance(userId, -drink.price);
  const remaining = getBalance(userId);

  const ticketId = generateTicketId(drinkKey, userId);
  state.tickets[ticketId] = {
    userId,
    drinkKey,
    amount: drink.price,
    createdAt: new Date().toISOString(),
    redeemed: false,
  };
  await saveState();

  const ticketText = [
    '🎟 *Drink Ticket Created!*',
    '',
    `Drink: *${drink.name}*`,
    `Cost: *${drink.price} WIT*`,
    `Remaining balance: *${remaining} WIT*`,
    '',
    'Your ticket code:',
    `\`${ticketId}\``,
    '',
    'Show this to the bartender to redeem your drink.',
  ].join('\n');

  await ctx.reply(ticketText, { parse_mode: 'Markdown' });

  // Let the bar know a ticket was created
  await sendBarMessage(
    [
      '🎟 *New Drink Ticket*',
      '',
      `User: \`${userId}\` (@${ctx.from.username || 'unknown'})`,
      `Drink: *${drink.name}*`,
      `Amount: *${drink.price} WIT*`,
      `Ticket: \`${ticketId}\``,
      `Balance: *${remaining} WIT*`,
    ].join('\n')
  );
}

bot.action('order_BEER', async (ctx) => {
  await ctx.answerCbQuery();
  await handleDrinkOrder(ctx, 'BEER');
});

bot.action('order_COCKTAIL', async (ctx) => {
  await ctx.answerCbQuery();
  await handleDrinkOrder(ctx, 'COCKTAIL');
});

bot.action('order_PARTY_BUCKET', async (ctx) => {
  await ctx.answerCbQuery();
  await handleDrinkOrder(ctx, 'PARTY_BUCKET');
});

// --- Handle wallet input (ONLY when user is linking) ---
bot.on('text', async (ctx) => {
  const userId = String(ctx.from.id);

  // If they’re not in wallet-link mode, ignore regular messages
  if (!pendingWalletLink.has(userId)) {
    return;
  }

  const text = (ctx.message.text || '').trim();

  // Very rough Solana base58-ish check
  const walletRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  if (!walletRegex.test(text)) {
    await ctx.reply(
      '⚠️ That doesn\'t look like a valid Solana wallet address. Please try again.'
    );
    return;
  }

  state.users[userId] = { wallet: text };
  await saveState();
  pendingWalletLink.delete(userId);

  await ctx.reply(
    [
      '✅ Wallet linked!',
      '',
      `I’ll watch for WIT transfers _from_ this address:`,
      `\`${text}\``,
      '',
      'When you send WIT to the bar wallet, your balance will update automatically.',
    ].join('\n'),
    { parse_mode: 'Markdown' }
  );
});

// --- Express app + webhooks ---
const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.send('WIT Bar Bot is alive');
});

// Telegram webhook
app.use('/telegram', bot.webhookCallback('/telegram'));

// Helius webhook: tracks WIT transfers
app.post('/helius', async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const tx of events) {
      const { signature, tokenTransfers } = tx || {};
      if (!tokenTransfers || !Array.isArray(tokenTransfers)) continue;

      // Avoid double-processing the same tx
      if (signature && state.processedSignatures[signature]) {
        continue;
      }
      if (signature) {
        state.processedSignatures[signature] = true;
      }

      for (const t of tokenTransfers) {
        if (!t) continue;

        const mint = t.mint;
        if (mint !== WIT_MINT) continue;

        const from = t.fromUserAccount;
        const to = t.toUserAccount;

        // tokenAmount is usually human-readable; fall back to amount if needed
        const rawAmt = Number(
          t.tokenAmount ?? t.amount ?? 0
        );
        if (!Number.isFinite(rawAmt) || rawAmt <= 0) continue;

        let direction;
        if (to === BAR_WALLET) {
          direction = 'Incoming';
        } else if (from === BAR_WALLET) {
          direction = 'Outgoing';
        } else {
          continue; // not involving the bar wallet
        }

        const summary = [
          '🔥 *WIT Transfer Detected!*',
          '',
          `*Direction:* ${direction === 'Incoming' ? '➡️ Incoming to bar' : '⬅️ Outgoing from bar'}`,
          `*Amount:* ${rawAmt} WIT`,
          '',
          `*From:* \`${from}\``,
          `*To:* \`${to}\``,
          signature ? `*Signature:* \`${signature}\`` : '',
        ].join('\n');

        await sendBarMessage(summary);

        // Credit user balance if it's WIT -> bar
        if (direction === 'Incoming') {
          const userId = findUserIdByWallet(from);
          if (userId) {
            adjustBalance(userId, rawAmt);
            await saveState();

            const newBal = getBalance(userId);
            try {
              await bot.telegram.sendMessage(
                userId,
                [
                  '🍹 *WIT Deposit Received!*',
                  '',
                  `You sent *${rawAmt} WIT* to the bar from wallet:`,
                  `\`${short(from)}\``,
                  '',
                  `Your new WIT Bar balance is *${newBal} WIT*.`,
                  '',
                  'Use *Order Drink* in the menu to create a drink ticket.',
                ].join('\n'),
                { parse_mode: 'Markdown' }
              );
            } catch (err) {
              console.error('⚠️ Failed to DM user about deposit:', err.message);
            }
          }
        }
      }
    }

    await saveState();
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error handling /helius webhook:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Start server & set Telegram webhook ---
ensureStateFile();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  if (SERVER_URL) {
    const cleanBase = SERVER_URL.replace(/\/+$/, '');
    const webhookUrl = `${cleanBase}/telegram`;
    console.log(`🔗 Setting Telegram webhook to: ${webhookUrl}`);

    bot.telegram
      .setWebhook(webhookUrl)
      .then(() => console.log('✅ Telegram webhook set successfully'))
      .catch((err) =>
        console.error('❌ Failed to set Telegram webhook:', err.message)
      );
  } else {
    console.warn('⚠️ SERVER_URL is not set – Telegram webhook not configured');
  }
});

// Graceful shutdown (just in case)
process.once('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  process.exit(0);
});
process.once('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  process.exit(0);
});









