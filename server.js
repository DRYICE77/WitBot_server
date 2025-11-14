app.post('/webhook', async (req, res) => {
    try {
        const events = req.body;

        for (const event of events) {
            const instructions = event?.instruction || [];
            const tokenTransfers = event?.tokenTransfers || [];

            // Your bar wallet (RECEIVER)
            const BAR_WALLET = process.env.BAR_WALLET;

            // WIT mint address
            const WIT_MINT = process.env.WIT_MINT;

            for (const transfer of tokenTransfers) {
                const {
                    mint,
                    fromUserAccount,
                    toUserAccount,
                    tokenAmount
                } = transfer;

                // ✅ Only care about WIT
                if (mint !== WIT_MINT) continue;

                // Resolve the *owner* of the destination ATA
                const toOwner = toUserAccount?.owner;

                // ✅ Only care about transfers TO the bar wallet
                if (toOwner !== BAR_WALLET) continue;

                console.log(`🔥 Received ${tokenAmount} WIT`);
                
                // Telegram bot command
                await sendTelegramMessage(
                    `🔥 Someone just sent *${tokenAmount} WIT* to the bar! 🎉`
                );
            }
        }

        res.status(200).send("ok");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("error");
    }
});

