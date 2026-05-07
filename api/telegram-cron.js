const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

const MOVIE_SENT_KEY = 'nobargasi:telegram:sent:movies';
const SERIES_SENT_KEY = 'nobargasi:telegram:sent:series';

export default async function handler(req, res) {
    try {
        const secret = process.env.CRON_SECRET;

        const isVercelCron =
            req.headers['x-vercel-cron'] === '1' ||
            req.headers['x-vercel-cron'] === 'true';

        const isManualAllowed =
            secret &&
            req.query &&
            req.query.secret === secret;

        if (secret && !isManualAllowed && !isVercelCron) {
            return res.status(401).json({
                ok: false,
                error: 'Unauthorized'
            });
        }

        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        const tmdbKey = getTmdbKey();

        if (!token || !chatId || !tmdbKey) {
            return res.status(500).json({
                ok: false,
                error: 'TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, dan TMDB_KEY/TMDB_API_KEY wajib diisi.'
            });
        }

        const movieResult = await checkMovies();
        const seriesResult = await checkSeries();

        return res.status(200).json({
            ok: true,
            message: 'Telegram cron berhasil berjalan.',
            movie: movieResult,
            series: seriesResult
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: err.message
        });
    }
}

function getTmdbKey() {
    return process.env.TMDB_API_KEY || process.env.TMDB_KEY || '';
}

async function checkMovies() {
    const tmdbKey = getTmdbKey();

    const url = `${TMDB_BASE}/movie/now_playing?api_key=${tmdbKey}&language=id-ID&page=1&region=ID`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.status_message || 'Gagal mengambil data movie dari TMDB.');
    }

    const results = (data.results || [])
        .filter(item => item.poster_path)
        .slice(0, 8);

    let sent = 0;
    let skipped = 0;

    for (const movie of results) {
        const uniqueId = `movie:${movie.id}`;
        const alreadySent = await isAlreadySent(MOVIE_SENT_KEY, uniqueId);

        if (alreadySent) {
            skipped++;
            continue;
        }

        await sendMovieToTelegram(movie);
        await markAsSent(MOVIE_SENT_KEY, uniqueId);

        sent++;
        await sleep(900);
    }

    return {
        checked: results.length,
        sent,
        skipped
    };
}

async function checkSeries() {
    const tmdbKey = getTmdbKey();

    const url = `${TMDB_BASE}/tv/on_the_air?api_key=${tmdbKey}&language=id-ID&page=1`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.status_message || 'Gagal mengambil data series dari TMDB.');
    }

    const results = (data.results || [])
        .filter(item => item.poster_path)
        .slice(0, 8);

    let sent = 0;
    let skipped = 0;

    for (const series of results) {
        const uniqueId = `tv:${series.id}`;
        const alreadySent = await isAlreadySent(SERIES_SENT_KEY, uniqueId);

        if (alreadySent) {
            skipped++;
            continue;
        }

        await sendSeriesToTelegram(series);
        await markAsSent(SERIES_SENT_KEY, uniqueId);

        sent++;
        await sleep(900);
    }

    return {
        checked: results.length,
        sent,
        skipped
    };
}

async function sendMovieToTelegram(movie) {
    const siteUrl = process.env.SITE_URL || '';
    const movieTopicId = process.env.TELEGRAM_MOVIE_TOPIC_ID;

    const title = escapeHtml(movie.title || 'Tanpa Judul');
    const year = (movie.release_date || '').split('-')[0] || 'N/A';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const overview = trimText(movie.overview || 'Sinopsis belum tersedia.', 450);

    const link = siteUrl
        ? `\n\n▶️ <b>Buka Nobargasi:</b>\n${escapeHtml(siteUrl)}`
        : '';

    const caption = `
🎬 <b>Film Baru Tersedia</b>

<b>${title}</b>
📅 Tahun: ${year}
⭐ Rating: ${rating}

${escapeHtml(overview)}${link}
`.trim();

    await sendTelegramPhoto({
        photo: `${IMG_BASE}${movie.poster_path}`,
        caption,
        topicId: movieTopicId
    });
}

async function sendSeriesToTelegram(series) {
    const siteUrl = process.env.SITE_URL || '';
    const seriesTopicId = process.env.TELEGRAM_SERIES_TOPIC_ID;

    const title = escapeHtml(series.name || 'Tanpa Judul');
    const year = (series.first_air_date || '').split('-')[0] || 'N/A';
    const rating = series.vote_average ? series.vote_average.toFixed(1) : 'N/A';
    const overview = trimText(series.overview || 'Sinopsis belum tersedia.', 450);

    const link = siteUrl
        ? `\n\n▶️ <b>Buka Nobargasi:</b>\n${escapeHtml(siteUrl)}`
        : '';

    const caption = `
📺 <b>Series Update</b>

<b>${title}</b>
📅 Tahun: ${year}
⭐ Rating: ${rating}

${escapeHtml(overview)}${link}
`.trim();

    await sendTelegramPhoto({
        photo: `${IMG_BASE}${series.poster_path}`,
        caption,
        topicId: seriesTopicId
    });
}

async function sendTelegramPhoto({ photo, caption, topicId }) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const payload = {
        chat_id: chatId,
        photo,
        caption,
        parse_mode: 'HTML'
    };

    if (topicId) {
        payload.message_thread_id = Number(topicId);
    }

    const tg = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await tg.json();

    if (!data.ok) {
        throw new Error(data.description || 'Gagal kirim foto ke Telegram.');
    }

    return data;
}

/*
    Anti-spam pakai KV Redis / Upstash REST.
    Env yang dipakai:
    KV_REST_API_URL
    KV_REST_API_TOKEN

    Kalau env ini kosong, bot tetap jalan,
    tapi film/series bisa terkirim ulang saat cron berikutnya.
*/
async function isAlreadySent(key, value) {
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
        return false;
    }

    const res = await fetch(`${kvUrl}/sismember/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
        headers: {
            Authorization: `Bearer ${kvToken}`
        }
    });

    const data = await res.json();

    return data.result === 1;
}

async function markAsSent(key, value) {
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
        return false;
    }

    await fetch(`${kvUrl}/sadd/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
        headers: {
            Authorization: `Bearer ${kvToken}`
        }
    });

    return true;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function trimText(text, max = 450) {
    const clean = String(text).trim();

    if (clean.length <= max) return clean;

    return clean.slice(0, max).trim() + '...';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
