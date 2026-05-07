export default async function handler(req, res) {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        const movieTopicId = process.env.TELEGRAM_MOVIE_TOPIC_ID;

        if (!token || !chatId) {
            return res.status(500).json({
                ok: false,
                error: 'TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID wajib diisi di Vercel Environment Variables.'
            });
        }

        const payload = {
            chat_id: chatId,
            text: '✅ Bot Nobargasi aktif dan siap kirim update film/series.',
            parse_mode: 'HTML'
        };

        if (movieTopicId) {
            payload.message_thread_id = Number(movieTopicId);
        }

        const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await tg.json();

        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: err.message
        });
    }
}
