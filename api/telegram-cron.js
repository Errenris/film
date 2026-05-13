const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

const MOVIE_SENT_KEY = 'nobargasi:telegram:sent:movies:v4';
const SERIES_SENT_KEY = 'nobargasi:telegram:sent:series:v4';

const MAX_PER_RUN = getMaxPerRun();
const SCAN_LIMIT = getScanLimit();
const SCAN_PAGES = getScanPages();

const DELAY_BETWEEN_ITEMS = 12000;

export default async function handler(req, res) {
    try {
        const secret = process.env.CRON_SECRET;
        const authHeader = req.headers.authorization || '';

        const isVercelCron =
            req.headers['x-vercel-cron'] === '1' ||
            req.headers['x-vercel-cron'] === 'true';

        const isBearerAllowed =
            secret && authHeader === `Bearer ${secret}`;

        const isManualAllowed =
            secret && req.query && req.query.secret === secret;

        if (secret && !isManualAllowed && !isBearerAllowed && !isVercelCron) {
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
            maxPerRun: MAX_PER_RUN,
            scanLimit: SCAN_LIMIT,
            scanPages: SCAN_PAGES,
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

function getMaxPerRun() {
    const n = Number(process.env.TELEGRAM_MAX_PER_RUN || 15);
    if (!Number.isFinite(n)) return 15;
    return Math.max(1, Math.min(n, 50));
}

function getScanLimit() {
    const n = Number(process.env.TELEGRAM_SCAN_LIMIT || 60);
    if (!Number.isFinite(n)) return 60;
    return Math.max(MAX_PER_RUN, Math.min(n, 120));
}

function getScanPages() {
    const n = Number(process.env.TELEGRAM_SCAN_PAGES || 5);
    if (!Number.isFinite(n)) return 5;
    return Math.max(1, Math.min(n, 10));
}

async function checkMovies() {
    const today = formatISODate(new Date());
    const lastMonth = formatISODate(addDays(new Date(), -45));

    const paths = [
        `discover/movie?language=id-ID&region=ID&with_original_language=id&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&primary_release_date.gte=${lastMonth}`,
        `movie/now_playing?language=id-ID&region=ID`,
        `movie/upcoming?language=id-ID&region=ID`,
        `discover/movie?language=id-ID&region=ID&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&primary_release_date.gte=${lastMonth}`
    ];

    const collected = await collectTmdbCandidates(paths, SCAN_LIMIT);

    let checked = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const movie of collected.items) {
        if (sent >= MAX_PER_RUN) break;

        checked++;

        const uniqueId = `movie:${movie.id}`;
        const alreadySent = await isAlreadySent(MOVIE_SENT_KEY, uniqueId);

        if (alreadySent) {
            skipped++;
            continue;
        }

        try {
            await sendMovieToTelegram(movie.id);
            await markAsSent(MOVIE_SENT_KEY, uniqueId);

            sent++;

            if (sent < MAX_PER_RUN) {
                await sleep(DELAY_BETWEEN_ITEMS);
            }
        } catch (err) {
            failed++;
            console.error('Gagal kirim movie:', movie.id, err.message);
            await sleep(3000);
        }
    }

    return {
        scanned: collected.items.length,
        checked,
        sent,
        skipped,
        failed,
        sourceErrors: collected.errors
    };
}

async function checkSeries() {
    const today = formatISODate(new Date());
    const lastMonth = formatISODate(addDays(new Date(), -45));

    const paths = [
        `discover/tv?language=id-ID&timezone=Asia/Jakarta&with_original_language=id&sort_by=first_air_date.desc&first_air_date.lte=${today}&first_air_date.gte=${lastMonth}`,
        `tv/airing_today?language=id-ID&timezone=Asia/Jakarta`,
        `tv/on_the_air?language=id-ID&timezone=Asia/Jakarta`,
        `discover/tv?language=id-ID&sort_by=first_air_date.desc&first_air_date.lte=${today}&first_air_date.gte=${lastMonth}`
    ];

    const collected = await collectTmdbCandidates(paths, SCAN_LIMIT);

    let checked = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const series of collected.items) {
        if (sent >= MAX_PER_RUN) break;

        checked++;

        try {
            const seriesDetail = await getSeriesDetails(series.id);

            const lastEp = seriesDetail.last_episode_to_air;
            const seasonNumber = lastEp?.season_number || 1;
            const episodeNumber = lastEp?.episode_number || 1;
            const airDate = lastEp?.air_date || seriesDetail.last_air_date || 'unknown';

            const uniqueId = `tv:${series.id}:s${seasonNumber}:e${episodeNumber}:${airDate}`;
            const alreadySent = await isAlreadySent(SERIES_SENT_KEY, uniqueId);

            if (alreadySent) {
                skipped++;
                continue;
            }

            await sendSeriesToTelegram(series.id, seriesDetail);
            await markAsSent(SERIES_SENT_KEY, uniqueId);

            sent++;

            if (sent < MAX_PER_RUN) {
                await sleep(DELAY_BETWEEN_ITEMS);
            }
        } catch (err) {
            failed++;
            console.error('Gagal kirim series:', series.id, err.message);
            await sleep(3000);
        }
    }

    return {
        scanned: collected.items.length,
        checked,
        sent,
        skipped,
        failed,
        sourceErrors: collected.errors
    };
}

async function collectTmdbCandidates(paths, limit) {
    const map = new Map();
    const errors = [];

    for (const path of paths) {
        for (let page = 1; page <= SCAN_PAGES; page++) {
            if (map.size >= limit) break;

            try {
                const data = await getTmdbList(path, page);
                const results = data.results || [];

                for (const item of results) {
                    if (map.size >= limit) break;
                    if (!item || !item.id || !item.poster_path) continue;

                    map.set(String(item.id), item);
                }
            } catch (err) {
                errors.push({
                    path,
                    page,
                    error: err.message
                });
            }
        }
    }

    const items = Array.from(map.values())
        .sort((a, b) => {
            const aIsID = isIndonesiaItem(a);
            const bIsID = isIndonesiaItem(b);

            if (aIsID && !bIsID) return -1;
            if (!aIsID && bIsID) return 1;

            const da = new Date(a.release_date || a.first_air_date || 0).getTime();
            const db = new Date(b.release_date || b.first_air_date || 0).getTime();

            return db - da;
        })
        .slice(0, limit);

    return {
        items,
        errors
    };
}

async function getTmdbList(path, page = 1) {
    const tmdbKey = getTmdbKey();
    const separator = path.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE}/${path}${separator}api_key=${tmdbKey}&page=${page}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.status_message || `Gagal mengambil list TMDB: ${path}`);
    }

    return data;
}

async function getMovieDetails(id) {
    const tmdbKey = getTmdbKey();

    const url =
        `${TMDB_BASE}/movie/${id}` +
        `?api_key=${tmdbKey}` +
        `&language=id-ID` +
        `&append_to_response=credits,external_ids,videos,release_dates`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.status_message || 'Gagal mengambil detail movie.');
    }

    return data;
}

async function getSeriesDetails(id) {
    const tmdbKey = getTmdbKey();

    const url =
        `${TMDB_BASE}/tv/${id}` +
        `?api_key=${tmdbKey}` +
        `&language=id-ID` +
        `&append_to_response=credits,external_ids,videos,content_ratings`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.status_message || 'Gagal mengambil detail series.');
    }

    return data;
}

async function sendMovieToTelegram(movieId) {
    const movie = await getMovieDetails(movieId);
    const movieTopicId = process.env.TELEGRAM_MOVIE_TOPIC_ID;

    const title = movie.title || movie.original_title || 'Tanpa Judul';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const runtime = movie.runtime ? `${movie.runtime} menit` : 'N/A';
    const genres = listNames(movie.genres);
    const cast = listCast(movie.credits?.cast, 5);
    const overview = movie.overview || 'Sinopsis belum tersedia.';
    const siteUrl = buildSiteLink('movie', movie.id);

    const idBadge = isIndonesiaItem(movie)
        ? '\n🇮🇩 Prioritas Indonesia'
        : '';

    const caption = `
🎬 <b>FILM BARU TERSEDIA</b>${idBadge}

<b>${escapeHtml(title)}</b>

⭐ ${rating}/10
📅 ${escapeHtml(formatDateID(movie.release_date))}
⏱️ ${escapeHtml(runtime)}
🎭 ${escapeHtml(genres || 'N/A')}

👥 Pemeran:
${escapeHtml(cast || 'N/A')}

📝 ${escapeHtml(trimText(overview, 260))}

🔗 ${escapeHtml(siteUrl)}
`.trim();

    await sendTelegramPhoto({
        photo: `${IMG_BASE}${movie.poster_path}`,
        caption: trimTelegramCaption(caption),
        topicId: movieTopicId
    });
}

async function sendSeriesToTelegram(seriesId, preloadedSeries = null) {
    const series = preloadedSeries || await getSeriesDetails(seriesId);
    const seriesTopicId = process.env.TELEGRAM_SERIES_TOPIC_ID;

    const title = series.name || series.original_name || 'Tanpa Judul';
    const rating = series.vote_average ? series.vote_average.toFixed(1) : 'N/A';
    const genres = listNames(series.genres);
    const cast = listCast(series.credits?.cast, 5);
    const overview = series.overview || 'Sinopsis belum tersedia.';

    const lastEp = series.last_episode_to_air;

    const latestEpisode = lastEp
        ? `S${lastEp.season_number} E${lastEp.episode_number} - ${lastEp.name || 'Tanpa judul'} (${formatDateID(lastEp.air_date)})`
        : 'N/A';

    const siteUrl = buildSiteLink('tv', series.id, lastEp);

    const idBadge = isIndonesiaItem(series)
        ? '\n🇮🇩 Prioritas Indonesia'
        : '';

    const caption = `
📺 <b>SERIES UPDATE</b>${idBadge}

<b>${escapeHtml(title)}</b>

⭐ ${rating}/10
📅 ${escapeHtml(formatDateID(series.first_air_date))}
🎭 ${escapeHtml(genres || 'N/A')}

🆕 Episode terbaru:
${escapeHtml(latestEpisode)}

👥 Pemeran:
${escapeHtml(cast || 'N/A')}

📝 ${escapeHtml(trimText(overview, 260))}

🔗 ${escapeHtml(siteUrl)}
`.trim();

    await sendTelegramPhoto({
        photo: `${IMG_BASE}${series.poster_path}`,
        caption: trimTelegramCaption(caption),
        topicId: seriesTopicId
    });
}

async function sendTelegramPhoto({ photo, caption, topicId }) {
    const payload = {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        photo,
        caption,
        parse_mode: 'HTML'
    };

    if (topicId) {
        payload.message_thread_id = Number(topicId);
    }

    return sendTelegramApi('sendPhoto', payload);
}

async function sendTelegramApi(method, payload, attempt = 1) {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    const tg = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await tg.json();

    if (data.ok) {
        return data;
    }

    const retryAfter = data.parameters?.retry_after;

    if (data.error_code === 429 && retryAfter && attempt <= 3) {
        await sleep((retryAfter + 2) * 1000);
        return sendTelegramApi(method, payload, attempt + 1);
    }

    throw new Error(data.description || `Gagal request Telegram: ${method}`);
}

async function isAlreadySent(key, value) {
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
        return false;
    }

    try {
        const res = await fetch(
            `${kvUrl}/sismember/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
            {
                headers: {
                    Authorization: `Bearer ${kvToken}`
                }
            }
        );

        const data = await res.json();
        return data.result === 1;
    } catch (err) {
        console.error('Gagal cek KV:', err.message);
        return false;
    }
}

async function markAsSent(key, value) {
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
        return false;
    }

    try {
        await fetch(
            `${kvUrl}/sadd/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
            {
                headers: {
                    Authorization: `Bearer ${kvToken}`
                }
            }
        );

        return true;
    } catch (err) {
        console.error('Gagal simpan KV:', err.message);
        return false;
    }
}

function buildSiteLink(type, id, episodeData = null) {
    const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');

    if (!siteUrl) return 'N/A';

    const params = new URLSearchParams();

    params.set('type', type);
    params.set('id', id);

    if (type === 'tv' && episodeData) {
        params.set('s', episodeData.season_number || 1);
        params.set('e', episodeData.episode_number || 1);
    }

    return `${siteUrl}/?${params.toString()}`;
}

function isIndonesiaItem(item) {
    const countries = item.origin_country || [];
    const productionCountries = item.production_countries || [];

    return (
        item.original_language === 'id' ||
        countries.includes('ID') ||
        productionCountries.some(country => country.iso_3166_1 === 'ID')
    );
}

function listNames(items, field = 'name') {
    if (!Array.isArray(items) || items.length === 0) return '';

    return items
        .map(item => item?.[field])
        .filter(Boolean)
        .join(', ');
}

function listCast(cast, limit = 5) {
    if (!Array.isArray(cast) || cast.length === 0) {
        return '';
    }

    return cast
        .slice(0, limit)
        .map(person => `• ${person.name}`)
        .join('\n');
}

function getYear(date) {
    if (!date) return 'N/A';
    return String(date).slice(0, 4);
}

function formatDateID(date) {
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatISODate(date) {
    return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function trimText(text, max = 300) {
    if (!text) return '';

    const clean = String(text).trim();

    if (clean.length <= max) return clean;

    return clean.slice(0, max).trim() + '...';
}

function trimTelegramCaption(text) {
    if (!text) return '';

    const max = 1000;
    const clean = String(text).trim();

    if (clean.length <= max) return clean;

    return clean.slice(0, max - 3).trim() + '...';
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}