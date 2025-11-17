import express from "express";
import { Telegraf } from "telegraf";

const app = express();
app.use(express.json());

// ===== ENV VARS =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const TARGET_CHAT = process.env.TARGET_CHAT;       // Telegram chat ID
const BAR_WALLET = process.env.BAR_WALLET;         // Your bar wallet
const WIT_MINT = process.env.WIT_MINT;             // WIT mint address

// Telegram Bot
const bot = new Telegraf(BOT_TOKEN);

// ===== TELEGRAM WEBHOOK ENDPOINT =====
app.post("/telegram", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// ===== TELEGRAM COMMANDS =====
bot.start(async (ctx) => {
  try {
    await ctx.reply(
      "🍹 *Welcome to the WIT Bar Bot!*\n\n" +
      "Send WIT to the bar wallet:\n" +
      "```\n" +
      BAR_WALLET +
      "\n```",
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("Telegram /start error:", err);
  }
});

// Ignore all other messages (prevent echoes)
bot.on("message", () => {});

// ===== HELIUS WEBHOOK =====
app.post("/helius", async (req, res) => {
  try {
    const body = req.body;

    // Safety check
    if (!Array.isArray(body)) {
      console.log("Invalid Helius payload:", body);
      return res.status(400).send("Invalid payload");
    }

    for (const event of body) {
      // Only process TRANSFER events
      if (event.type !== "TRANSFER") continue;
      if (!event.tokenTransfers?.length) continue;

      for (const t of event.tokenTransfers) {
        // Only WIT mint transfers INTO the bar wallet
        if (t.mint === WIT_MINT && t.toUserAccount === BAR_WALLET) {
          const msg =
            `🔥 *WIT Transfer Detected!*\n\n` +
            `• *Direction:* ➡️ Incoming\n` +
            `• *Amount:* ${t.tokenAmount}\n` +
            `• *From:* \`${t.fromUserAccount}\`\n` +
            `• *To:* \`${t.toUserAccount}\`\n\n` +
            `#WITTracker`;

          await bot.telegram.sendMessage(TARGET_CHAT, msg, {
            parse_mode: "Markdown",
          });

          console.log("Sent Telegram alert for WIT transfer");
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Helius webhook error:", err);
    res.sendStatus(500);
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("Helius Webhook active at /helius");
  console.log("Telegram Webhook active at /telegram");
});









