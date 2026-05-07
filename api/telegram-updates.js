export default async function handler(req, res) {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;

        if (!token) {
            return res.status(500).json({
                ok: false,
                error: 'TELEGRAM_BOT_TOKEN belum diisi.'
            });
        }

        const tg = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
        const data = await tg.json();

        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: err.message
        });
    }
}
