const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

/*
    Movie tetap per ID film.
    Series sekarang per episode terakhir, jadi episode baru bisa terkirim otomatis.
*/
const MOVIE_SENT_KEY = 'nobargasi:telegram:sent:movies:v2';
const SERIES_SENT_KEY = 'nobargasi:telegram:sent:series:v2';

/*
    Supaya tidak kena limit Telegram.
    Bisa diatur lewat Vercel env:
    TELEGRAM_MAX_PER_RUN=1 / 2 / 3
*/
const MAX_PER_RUN = getMaxPerRun();
const DELAY_BETWEEN_ITEMS = 3500;
const DELAY_BETWEEN_PHOTO_AND_DETAIL = 1500;

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
            maxPerRun: MAX_PER_RUN,
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
    const n = Number(process.env.TELEGRAM_MAX_PER_RUN || 3);

    if (!Number.isFinite(n)) return 3;

    return Math.max(1, Math.min(n, 8));
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
        .slice(0, MAX_PER_RUN);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const movie of results) {
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
        } catch (err) {
            failed++;
            console.error('Gagal kirim movie:', movie.id, err.message);
        }

        await sleep(DELAY_BETWEEN_ITEMS);
    }

    return {
        checked: results.length,
        sent,
        skipped,
        failed
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
        .slice(0, MAX_PER_RUN);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const series of results) {
        try {
            const seriesDetail = await getSeriesDetails(series.id);

            const lastEp = seriesDetail.last_episode_to_air;
            const seasonNumber = lastEp?.season_number || 1;
            const episodeNumber = lastEp?.episode_number || 1;
            const airDate = lastEp?.air_date || seriesDetail.last_air_date || 'unknown';

            /*
                FIX EPISODE UPDATE:
                Dulu key cuma tv:ID.
                Sekarang key pakai tv:ID:season:episode:airDate.
                Jadi kalau episode baru tayang, bot akan kirim lagi.
            */
            const uniqueId = `tv:${series.id}:s${seasonNumber}:e${episodeNumber}:${airDate}`;
            const alreadySent = await isAlreadySent(SERIES_SENT_KEY, uniqueId);

            if (alreadySent) {
                skipped++;
                continue;
            }

            await sendSeriesToTelegram(series.id, seriesDetail);
            await markAsSent(SERIES_SENT_KEY, uniqueId);

            sent++;
        } catch (err) {
            failed++;
            console.error('Gagal kirim series:', series.id, err.message);
        }

        await sleep(DELAY_BETWEEN_ITEMS);
    }

    return {
        checked: results.length,
        sent,
        skipped,
        failed
    };
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
    const originalTitle = movie.original_title && movie.original_title !== title
        ? movie.original_title
        : '';

    const year = getYear(movie.release_date);
    const releaseDate = formatDate(movie.release_date);
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const voteCount = movie.vote_count ? formatNumber(movie.vote_count) : '0';
    const runtime = movie.runtime ? `${movie.runtime} menit` : 'N/A';
    const genres = listNames(movie.genres);
    const countries = listNames(movie.production_countries);
    const languages = listNames(movie.spoken_languages, 'english_name');
    const studios = listNames(movie.production_companies?.slice(0, 4));
    const cast = listCast(movie.credits?.cast);
    const director = listCrew(movie.credits?.crew, 'Director');
    const writers = listCrew(movie.credits?.crew, 'Writer');
    const certification = getMovieCertification(movie.release_dates);
    const trailer = getYoutubeTrailer(movie.videos?.results);
    const overview = movie.overview || 'Sinopsis belum tersedia.';
    const budget = movie.budget ? `$${formatNumber(movie.budget)}` : 'N/A';
    const revenue = movie.revenue ? `$${formatNumber(movie.revenue)}` : 'N/A';

    const tmdbLink = `https://www.themoviedb.org/movie/${movie.id}`;
    const imdbLink = movie.external_ids?.imdb_id
        ? `https://www.imdb.com/title/${movie.external_ids.imdb_id}`
        : '';

    const siteUrl = buildSiteLink('movie', movie.id);

    const photoCaption = `
🎬 <b>FILM BARU TERSEDIA</b>

<b>${escapeHtml(title)}</b>
${originalTitle ? `\n<i>${escapeHtml(originalTitle)}</i>` : ''}

⭐ <b>${rating}</b>/10 dari ${voteCount} vote
📅 ${escapeHtml(year)}
🎭 ${escapeHtml(genres || 'Genre tidak tersedia')}
`.trim();

    const detailText = `
🎬 <b>INFO UPDATE FILM</b>

<b>${escapeHtml(title)}</b>
${originalTitle ? `🎞️ Judul asli: <b>${escapeHtml(originalTitle)}</b>\n` : ''}

<b>📌 Detail Utama</b>
• Tahun: <b>${escapeHtml(year)}</b>
• Tanggal rilis: <b>${escapeHtml(releaseDate)}</b>
• Rating TMDB: <b>${rating}/10</b>
• Jumlah vote: <b>${voteCount}</b>
• Durasi: <b>${escapeHtml(runtime)}</b>
• Usia rating: <b>${escapeHtml(certification || 'N/A')}</b>
• Status: <b>${escapeHtml(movie.status || 'N/A')}</b>
• Bahasa asli: <b>${escapeHtml((movie.original_language || 'N/A').toUpperCase())}</b>

<b>🎭 Kategori</b>
• Genre: ${escapeHtml(genres || 'N/A')}
• Negara: ${escapeHtml(countries || 'N/A')}
• Bahasa tersedia: ${escapeHtml(languages || 'N/A')}

<b>🎥 Produksi</b>
• Sutradara: ${escapeHtml(director || 'N/A')}
• Penulis: ${escapeHtml(writers || 'N/A')}
• Studio: ${escapeHtml(studios || 'N/A')}
• Budget: ${escapeHtml(budget)}
• Revenue: ${escapeHtml(revenue)}

<b>👥 Pemeran</b>
${escapeHtml(cast || 'N/A')}

<b>📝 Sinopsis</b>
${escapeHtml(trimText(overview, 950))}

<b>🔗 Link</b>
• Nobargasi: ${escapeHtml(siteUrl)}
• TMDB: ${escapeHtml(tmdbLink)}
${imdbLink ? `• IMDb: ${escapeHtml(imdbLink)}\n` : ''}${trailer ? `• Trailer: ${escapeHtml(trailer)}` : '• Trailer: N/A'}
`.trim();

    await sendTelegramPhoto({
        photo: `${IMG_BASE}${movie.poster_path}`,
        caption: trimTelegramCaption(photoCaption),
        topicId: movieTopicId
    });

    await sleep(DELAY_BETWEEN_PHOTO_AND_DETAIL);

    await sendTelegramMessage({
        text: trimTelegramMessage(detailText),
        topicId: movieTopicId
    });
}

async function sendSeriesToTelegram(seriesId, preloadedSeries = null) {
    const series = preloadedSeries || await getSeriesDetails(seriesId);
    const seriesTopicId = process.env.TELEGRAM_SERIES_TOPIC_ID;

    const title = series.name || series.original_name || 'Tanpa Judul';
    const originalTitle = series.original_name && series.original_name !== title
        ? series.original_name
        : '';

    const firstYear = getYear(series.first_air_date);
    const firstAirDate = formatDate(series.first_air_date);
    const lastAirDate = formatDate(series.last_air_date);
    const rating = series.vote_average ? series.vote_average.toFixed(1) : 'N/A';
    const voteCount = series.vote_count ? formatNumber(series.vote_count) : '0';
    const runtime = series.episode_run_time?.length
        ? `${series.episode_run_time[0]} menit/episode`
        : 'N/A';

    const genres = listNames(series.genres);
    const countries = listNames(series.production_countries);
    const languages = listNames(series.spoken_languages, 'english_name');
    const networks = listNames(series.networks);
    const studios = listNames(series.production_companies?.slice(0, 4));
    const creators = listNames(series.created_by);
    const cast = listCast(series.credits?.cast);
    const trailer = getYoutubeTrailer(series.videos?.results);
    const overview = series.overview || 'Sinopsis belum tersedia.';
    const certification = getSeriesCertification(series.content_ratings);

    const lastEp = series.last_episode_to_air;
    const nextEp = series.next_episode_to_air;

    const lastEpisodeText = lastEp
        ? `S${lastEp.season_number} E${lastEp.episode_number} - ${lastEp.name || 'Tanpa judul'} (${formatDate(lastEp.air_date)})`
        : 'N/A';

    const nextEpisodeText = nextEp
        ? `S${nextEp.season_number} E${nextEp.episode_number} - ${nextEp.name || 'Tanpa judul'} (${formatDate(nextEp.air_date)})`
        : 'Belum ada jadwal';

    const tmdbLink = `https://www.themoviedb.org/tv/${series.id}`;
    const imdbLink = series.external_ids?.imdb_id
        ? `https://www.imdb.com/title/${series.external_ids.imdb_id}`
        : '';

    const siteUrl = buildSiteLink('tv', series.id, lastEp);

    const photoCaption = `
📺 <b>SERIES UPDATE</b>

<b>${escapeHtml(title)}</b>
${originalTitle ? `\n<i>${escapeHtml(originalTitle)}</i>` : ''}

⭐ <b>${rating}</b>/10 dari ${voteCount} vote
📅 Mulai: ${escapeHtml(firstYear)}
🎭 ${escapeHtml(genres || 'Genre tidak tersedia')}
🧩 ${series.number_of_seasons || 0} Season • ${series.number_of_episodes || 0} Episode
${lastEp ? `🆕 Terakhir: S${lastEp.season_number} E${lastEp.episode_number}` : ''}
`.trim();

    const detailText = `
📺 <b>INFO UPDATE SERIES</b>

<b>${escapeHtml(title)}</b>
${originalTitle ? `🎞️ Judul asli: <b>${escapeHtml(originalTitle)}</b>\n` : ''}

<b>📌 Detail Utama</b>
• Tahun mulai: <b>${escapeHtml(firstYear)}</b>
• Tanggal tayang awal: <b>${escapeHtml(firstAirDate)}</b>
• Tanggal tayang terakhir: <b>${escapeHtml(lastAirDate)}</b>
• Rating TMDB: <b>${rating}/10</b>
• Jumlah vote: <b>${voteCount}</b>
• Durasi: <b>${escapeHtml(runtime)}</b>
• Usia rating: <b>${escapeHtml(certification || 'N/A')}</b>
• Status: <b>${escapeHtml(series.status || 'N/A')}</b>
• Bahasa asli: <b>${escapeHtml((series.original_language || 'N/A').toUpperCase())}</b>

<b>🧩 Episode</b>
• Total season: <b>${series.number_of_seasons || 0}</b>
• Total episode: <b>${series.number_of_episodes || 0}</b>
• Episode terakhir: ${escapeHtml(lastEpisodeText)}
• Episode berikutnya: ${escapeHtml(nextEpisodeText)}

<b>🎭 Kategori</b>
• Genre: ${escapeHtml(genres || 'N/A')}
• Negara: ${escapeHtml(countries || 'N/A')}
• Bahasa tersedia: ${escapeHtml(languages || 'N/A')}

<b>🏢 Produksi</b>
• Creator: ${escapeHtml(creators || 'N/A')}
• Network: ${escapeHtml(networks || 'N/A')}
• Studio: ${escapeHtml(studios || 'N/A')}

<b>👥 Pemeran</b>
${escapeHtml(cast || 'N/A')}

<b>📝 Sinopsis</b>
${escapeHtml(trimText(overview, 950))}

<b>🔗 Link</b>
• Nobargasi: ${escapeHtml(siteUrl)}
• TMDB: ${escapeHtml(tmdbLink)}
${imdbLink ? `• IMDb: ${escapeHtml(imdbLink)}\n` : ''}${trailer ? `• Trailer: ${escapeHtml(trailer)}` : '• Trailer: N/A'}
`.trim();

    await sendTelegramPhoto({
        photo: `${IMG_BASE}${series.poster_path}`,
        caption: trimTelegramCaption(photoCaption),
        topicId: seriesTopicId
    });

    await sleep(DELAY_BETWEEN_PHOTO_AND_DETAIL);

    await sendTelegramMessage({
        text: trimTelegramMessage(detailText),
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

async function sendTelegramMessage({ text, topicId }) {
    const payload = {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
    };

    if (topicId) {
        payload.message_thread_id = Number(topicId);
    }

    return sendTelegramApi('sendMessage', payload);
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

function listNames(items, field = 'name') {
    if (!Array.isArray(items) || items.length === 0) return '';

    return items
        .map(item => item?.[field])
        .filter(Boolean)
        .slice(0, 8)
        .join(', ');
}

function listCast(cast) {
    if (!Array.isArray(cast) || cast.length === 0) return '';

    return cast
        .slice(0, 8)
        .map(actor => {
            const name = actor.name || 'Unknown';
            const character = actor.character ? ` sebagai ${actor.character}` : '';
            return `• ${name}${character}`;
        })
        .join('\n');
}

function listCrew(crew, job) {
    if (!Array.isArray(crew) || crew.length === 0) return '';

    return crew
        .filter(person => person.job === job)
        .map(person => person.name)
        .filter(Boolean)
        .slice(0, 5)
        .join(', ');
}

function getYoutubeTrailer(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return '';

    const trailer = videos.find(v => {
        return v.site === 'YouTube' && v.type === 'Trailer';
    }) || videos.find(v => v.site === 'YouTube');

    if (!trailer) return '';

    return `https://www.youtube.com/watch?v=${trailer.key}`;
}

function getMovieCertification(releaseDates) {
    const results = releaseDates?.results || [];

    const preferred =
        results.find(r => r.iso_3166_1 === 'ID') ||
        results.find(r => r.iso_3166_1 === 'US') ||
        results.find(r => r.release_dates?.some(x => x.certification));

    const cert = preferred?.release_dates?.find(x => x.certification)?.certification;

    return cert || '';
}

function getSeriesCertification(contentRatings) {
    const results = contentRatings?.results || [];

    const preferred =
        results.find(r => r.iso_3166_1 === 'ID') ||
        results.find(r => r.iso_3166_1 === 'US') ||
        results.find(r => r.rating);

    return preferred?.rating || '';
}

function getYear(dateText) {
    if (!dateText) return 'N/A';

    return String(dateText).split('-')[0] || 'N/A';
}

function formatDate(dateText) {
    if (!dateText) return 'N/A';

    const parts = String(dateText).split('-');

    if (parts.length !== 3) return dateText;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatNumber(num) {
    return Number(num || 0).toLocaleString('en-US');
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function trimText(text, max = 450) {
    const clean = String(text || '').trim();

    if (clean.length <= max) return clean;

    return clean.slice(0, max).trim() + '...';
}

function trimTelegramCaption(text) {
    const clean = String(text || '').trim();

    if (clean.length <= 1000) return clean;

    return clean.slice(0, 997).trim() + '...';
}

function trimTelegramMessage(text) {
    const clean = String(text || '').trim();

    if (clean.length <= 3900) return clean;

    return clean.slice(0, 3897).trim() + '...';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
