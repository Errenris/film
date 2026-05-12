const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1;
let currentPath = '';
let currentAction = '';
let featuredMovies = [];
let currentHeroIndex = 0;
let carouselTimer;
let currentPlayId = '';
let currentPlayType = '';
let liveSearchTimeout;

let currentSeason = 1;
let currentEpisode = 1;
let currentTvDetails = null;
let currentServer = 'VidSrc';

let currentPlayTitle = '';
let currentPlayBackdrop = '';
let currentPlayPoster = '';

let detailMovieData = null;
let detailMovieState = null;

let mobileCloseConfirmTimer = null;
let mobileCloseWaitingConfirm = false;

window.onload = () => {
    initApp();
    setupScrollEffects();
    setupRowButtons();
    setupSearch();
    setupFilterYears();
    openFromTelegramLink();
    setupLiveVisitors();
};

function safeText(str) {
    if (!str) return 'Unknown';
    return String(str).replace(/['"\\`]/g, '');
}

function updateAmbient(img) {
    const bg = document.getElementById('ambientBg');

    if (img && bg) {
        bg.style.backgroundImage = `url('${BACK_PATH + img}')`;
    }
}

function setupScrollEffects() {
    const header = document.getElementById('mainHeader');

    window.addEventListener('scroll', () => {
        if (!header) return;

        const cur = window.pageYOffset;
        header.style.opacity = cur > 100 ? "0.1" : "1";

        if (header.parentElement) {
            header.parentElement.style.transform = cur > 100 ? "translateY(-15px)" : "translateY(0)";
        }
    }, { passive: true });
}

function initApp() {
    let oldHist = JSON.parse(localStorage.getItem('nbg_history') || '[]');

    if (oldHist.length > 0 && !oldHist[0].poster_path) {
        localStorage.removeItem('nbg_history');
    }

    const rows = [
        'rowTrending',
        'rowActors',
        'rowMarvel',
        'rowDC',
        'rowDisney',
        'rowPixar',
        'rowHoror',
        'rowDrakor',
        'rowAnime',
        'row1',
        'row2'
    ];

    rows.forEach(r => renderSkeleton(r));

    loadHeroBanner();
    fetchAndRenderTrending('trending/movie/day', 'rowTrending');
    fetchAndRenderActors('trending/person/week', 'rowActors');

    fetchAndRender('discover/movie?with_companies=420&sort_by=revenue.desc', 'rowMarvel');
    fetchAndRender('discover/movie?with_companies=429&sort_by=popularity.desc', 'rowDC');
    fetchAndRender('discover/movie?with_companies=2&sort_by=popularity.desc', 'rowDisney');
    fetchAndRender('discover/movie?with_companies=3&sort_by=popularity.desc', 'rowPixar');

    fetchAndRender('discover/movie?with_genres=27', 'rowHoror');
    fetchAndRender('discover/tv?with_original_language=ko', 'rowDrakor', true);
    fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'rowAnime', true);
    fetchAndRender('movie/popular', 'row1');
    fetchAndRender('tv/popular', 'row2', true);
    fetchAndRender('movie/upcoming', 'rowUpcoming');
    fetchAndRender('trending/all/week', 'rowTopWeekly');
    fetchAndRender('tv/on_the_air', 'rowLatestEpisode', true);

    renderHistory();
}

function renderSkeleton(id) {
    const c = document.getElementById(id);
    if (!c) return;

    c.innerHTML = '';

    for (let i = 0; i < 8; i++) {
        const s = document.createElement('div');
        s.className = "movie-card";
        s.innerHTML = `<div class="skeleton"></div>`;
        c.appendChild(s);
    }
}

async function loadHeroBanner() {
    try {
        const res = await fetch(`/api/movies?path=trending/all/day`);
        const data = await res.json();

        if (data.results) {
            featuredMovies = data.results.slice(0, 8);
            updateHero();
            startCarousel();
        }
    } catch (e) {}
}

function getMyList() {
    return JSON.parse(localStorage.getItem('nbg_mylist') || '[]');
}

function saveMyList(list) {
    localStorage.setItem('nbg_mylist', JSON.stringify(list));
}

function toggleMyList(e, movieStr) {
    e.stopPropagation();

    const movie = JSON.parse(decodeURIComponent(movieStr));
    let list = getMyList();
    const index = list.findIndex(m => m.id === movie.id);

    if (index > -1) {
        list.splice(index, 1);
        e.target.style.color = 'white';
        e.target.innerText = '🤍';
    } else {
        list.push(movie);
        e.target.style.color = '#ef4444';
        e.target.innerText = '❤️';
    }

    saveMyList(list);

    const gridSection = document.getElementById('gridSection');
    const gridTitle = document.getElementById('gridTitle');

    if (
        gridSection &&
        gridTitle &&
        !gridSection.classList.contains('hidden') &&
        gridTitle.innerText.includes('FAVORIT')
    ) {
        showMyList();
    }
}

function toggleDetailFavorite() {
    if (!detailMovieState) return;

    let list = getMyList();
    const index = list.findIndex(m => m.id === detailMovieState.id);
    const btn = document.getElementById('detailFavoriteBtn');

    if (index > -1) {
        list.splice(index, 1);
        if (btn) btn.innerText = '🤍 Favorit';
    } else {
        list.push({
            id: detailMovieState.id,
            title: detailMovieState.title,
            poster_path: detailMovieState.poster,
            backdrop_path: detailMovieState.backdrop,
            media_type: detailMovieState.type
        });

        if (btn) btn.innerText = '❤️ Favorit';
    }

    saveMyList(list);
}

function showMyList() {
    window.scrollTo(0, 0);

    document.getElementById('homeView')?.classList.add('hidden');
    document.getElementById('heroSection')?.classList.add('hidden');
    document.getElementById('gridSection')?.classList.remove('hidden');

    const gridTitle = document.getElementById('gridTitle');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const container = document.getElementById('gridResults');

    if (gridTitle) gridTitle.innerText = 'Daftar Favorit ❤️';
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');

    const list = getMyList();

    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<p class="text-white/50 font-bold tracking-widest text-sm mt-10">BELUM ADA FILM FAVORIT.</p>';
    } else {
        renderCards(list, container, false, false);
    }
}

async function fetchAndRenderActors(path, id) {
    try {
        const res = await fetch(`/api/movies?path=${path}`);
        const data = await res.json();

        const c = document.getElementById(id);
        if (!c) return;

        c.innerHTML = '';

        data.results?.slice(0, 12).forEach(a => {
            if (!a.profile_path) return;

            const sName = safeText(a.name);
            const d = document.createElement('div');

            d.className = "flex flex-col items-center flex-shrink-0 group";
            d.innerHTML = `
                <img src="${IMG_PATH + a.profile_path}" class="actor-circle" onclick="loadActorFilms(${a.id}, '${sName}')" loading="lazy">
                <p class="text-[9px] text-center text-white/50 mt-4 font-black group-hover:text-white uppercase tracking-widest truncate w-20 transition">${sName}</p>
            `;

            c.appendChild(d);
        });
    } catch (e) {}
}

async function fetchAndRenderTrending(path, id) {
    try {
        const res = await fetch(`/api/movies?path=${path}`);
        const data = await res.json();

        const c = document.getElementById(id);
        if (!c) return;

        c.innerHTML = '';
        const myList = getMyList();

        data.results?.slice(0, 10).forEach((m, i) => {
            if (!m.poster_path) return;

            const sTitle = safeText(m.title || m.name);
            const type = m.media_type || 'movie';

            const savedObj = {
                id: m.id,
                title: sTitle,
                poster_path: m.poster_path,
                backdrop_path: m.backdrop_path,
                media_type: type
            };

            const movieStr = encodeURIComponent(JSON.stringify(savedObj));
            const isFav = myList.some(x => x.id === m.id);

            const w = document.createElement('div');
            w.className = "flex items-end relative flex-shrink-0 mr-12";

            w.innerHTML = `
                <div class="netflix-number">${i + 1}</div>
                <div class="movie-card">
                    <button onclick="toggleMyList(event, '${movieStr}')" class="fav-btn" style="color: ${isFav ? '#ef4444' : 'white'}">${isFav ? '❤️' : '🤍'}</button>
                    <div class="poster-container" onclick="openMovieDetail(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}', '${m.poster_path || ''}')">
                        <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                    </div>
                    <div class="mt-3 px-1 text-center">
                        <h3 class="text-[11px] font-black truncate text-white uppercase tracking-wider drop-shadow-md">${sTitle}</h3>
                    </div>
                </div>
            `;

            c.appendChild(w);
        });
    } catch (e) {}
}

async function fetchAndRender(path, id, isTV = false) {
    try {
        const res = await fetch(`/api/movies?path=${path.replace(/\?/g, '&')}`);
        const data = await res.json();

        const c = document.getElementById(id);

        if (data.results && c) {
            renderCards(data.results, c, false, isTV);
        }
    } catch (e) {}
}

function renderCards(movies, container, append = false, isTV = false, isHistory = false) {
    if (!container) return;
    if (!append) container.innerHTML = '';

    const myList = getMyList();

    movies.forEach(m => {
        if (!m.poster_path) return;

        const type = isTV ? 'tv' : (m.media_type || m.type || (m.title ? 'movie' : 'tv'));
        const sTitle = safeText(m.title || m.name);

        const seasonInfo = type === 'tv'
            ? Number(m.season_number || m.season || m.lastSeason || 1)
            : null;

        const episodeInfo = type === 'tv'
            ? Number(m.episode_number || m.episode || m.lastEpisode || 1)
            : null;

        const progress = m.progress || 0;

        const progHTML = progress
            ? `<div class="resume-bar"><div class="resume-progress" style="width: ${progress}%"></div></div>`
            : '';

        const resumeBadge = type === 'tv' && (m.season_number || m.episode_number || m.lastSeason || m.lastEpisode)
            ? `
                <div class="absolute bottom-2 left-2 right-2 z-20 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 px-2 py-1 text-center">
                    <p class="text-[8px] font-black text-blue-300 uppercase tracking-widest">
                        Terakhir S${seasonInfo} E${episodeInfo}
                    </p>
                </div>
            `
            : '';

        const savedObj = {
            id: m.id,
            title: sTitle,
            poster_path: m.poster_path,
            backdrop_path: m.backdrop_path,
            media_type: type
        };

        const movieStr = encodeURIComponent(JSON.stringify(savedObj));
        const isFav = myList.some(x => x.id === m.id);

        const deleteHistoryBtn = isHistory
    ? `
        <button
            type="button"
            onclick="deleteHistoryItem(event, ${m.id}, '${type}')"
            onpointerdown="event.preventDefault(); event.stopPropagation();"
            class="absolute top-2 left-2 z-40 text-sm bg-red-500/90 hover:bg-red-500 backdrop-blur-md w-9 h-9 rounded-full flex items-center justify-center border border-white/20 transition active:scale-90 shadow-xl"
            title="Hapus dari riwayat"
        >
            🗑️
        </button>
    `
    : '';

        const card = document.createElement('div');
        card.className = "movie-card";

        card.innerHTML = `
            <button onclick="toggleMyList(event, '${movieStr}')" class="fav-btn" style="color: ${isFav ? '#ef4444' : 'white'}">${isFav ? '❤️' : '🤍'}</button>

            ${deleteHistoryBtn}

            <div class="poster-container" onclick="openMovieDetail(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}', '${m.poster_path || ''}', ${seasonInfo || 1}, ${episodeInfo || 1})">
                <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">

                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-all duration-500">
                    <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-lg">▶</div>
                </div>

                ${resumeBadge}
                ${progHTML}
            </div>

            <div class="mt-3 px-1 text-center">
                <h3 class="text-[11px] font-black truncate text-white uppercase tracking-wider drop-shadow-md">${sTitle}</h3>
                ${
                    type === 'tv' && (m.season_number || m.episode_number || m.lastSeason || m.lastEpisode)
                        ? `<p class="text-[9px] text-blue-400 font-black mt-1 uppercase tracking-widest">S${seasonInfo} E${episodeInfo}</p>`
                        : ''
                }
            </div>
        `;

        container.appendChild(card);
    });
}

async function openMovieDetail(id, title, type, backdrop, poster, season = 1, episode = 1) {
    // --- SOLUSI BUG: Tutup player otomatis jika sedang nonton ---
    if (document.body.classList.contains('player-open')) {
        closePlayer();
    }
    // ------------------------------------------------------------

    detailMovieState = {
        id,
        title,
        type,
        backdrop,
        poster,
        season,
        episode
    };

    const modal = document.getElementById('detailModal');
    const backdropBox = document.getElementById('detailBackdrop');
    const posterImg = document.getElementById('detailPoster');

    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (backdropBox) {
        backdropBox.style.backgroundImage = backdrop ? `url('${BACK_PATH + backdrop}')` : '';
    }

    if (posterImg) {
        posterImg.src = poster ? IMG_PATH + poster : '';
    }

    document.getElementById('detailTitle').innerText = title;
    document.getElementById('detailOverview').innerText = 'Memuat detail...';
    document.getElementById('detailRating').innerText = '⭐ ...';
    document.getElementById('detailYear').innerText = '....';
    document.getElementById('detailRuntime').innerText = '...';
    document.getElementById('detailType').innerText = type === 'tv' ? 'SERIES' : 'MOVIE';
    document.getElementById('detailGenres').innerHTML = '';
    document.getElementById('detailCastContainer').innerHTML = '';

    const playBtn = document.getElementById('detailPlayBtn');
    const trailerBtn = document.getElementById('detailTrailerBtn');
    const favBtn = document.getElementById('detailFavoriteBtn');

    if (playBtn) {
        playBtn.onclick = () => {
            closeDetailModal(false);
            playMovie(id, title, type, backdrop, poster, season, episode);
        };
    }

    if (trailerBtn) {
        trailerBtn.onclick = () => openTrailer(type, id);
    }

    if (favBtn) {
        const isFav = getMyList().some(x => x.id === id);
        favBtn.innerText = isFav ? '❤️ Favorit' : '🤍 Favorit';
        favBtn.onclick = toggleDetailFavorite;
    }

    try {
        const res = await fetch(`/api/movies?path=${type}/${id}`);
        const m = await res.json();
        detailMovieData = m;

        const year = (m.release_date || m.first_air_date || '2024').split('-')[0];
        const runtime = m.runtime
            ? `${m.runtime}m`
            : (m.episode_run_time?.length ? `${m.episode_run_time[0]}m` : 'TV Series');

        document.getElementById('detailOverview').innerText = m.overview || 'Sinopsis tidak tersedia.';
        document.getElementById('detailRating').innerText = `⭐ ${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}`;
        document.getElementById('detailYear').innerText = year;
        document.getElementById('detailRuntime').innerText = runtime;

        const genres = document.getElementById('detailGenres');

        if (genres) {
            genres.innerHTML = (m.genres || []).slice(0, 5).map(g => {
                return `<span class="bg-white/10 border border-white/10 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest text-white/70">${g.name}</span>`;
            }).join('');
        }
    } catch (e) {
        document.getElementById('detailOverview').innerText = 'Gagal memuat detail.';
    }

    try {
        const res = await fetch(`/api/movies?path=${type}/${id}/credits`);
        const data = await res.json();

        const castBox = document.getElementById('detailCastContainer');
        if (!castBox) return;

        castBox.innerHTML = '';

        data.cast?.slice(0, 10).forEach(a => {
            if (!a.profile_path) return;

            const sName = safeText(a.name);
            const d = document.createElement('div');

            d.className = "flex-shrink-0 text-center w-20 opacity-70 hover:opacity-100 cursor-pointer transition hover:scale-110";
            d.onclick = () => {
                closeDetailModal();
                loadActorFilms(a.id, sName);
            };

            d.innerHTML = `
                <img src="${IMG_PATH + a.profile_path}" class="actor-circle mx-auto mb-3 shadow-lg border border-white/10">
                <p class="text-[8px] font-black uppercase tracking-tighter truncate w-full text-white">${sName}</p>
            `;

            castBox.appendChild(d);
        });
    } catch (e) {}
}

function closeDetailModal(restoreScroll = true) {
    const modal = document.getElementById('detailModal');
    if (!modal) return;

    modal.classList.add('hidden');

    if (restoreScroll && !document.body.classList.contains('player-open')) {
        document.body.style.overflow = 'auto';
    }
}

async function openTrailer(type, id) {
    try {
        const res = await fetch(`/api/movies?path=${type}/${id}/videos`);
        const data = await res.json();

        const trailer = (data.results || []).find(v => {
            return v.site === 'YouTube' && v.type === 'Trailer';
        }) || (data.results || []).find(v => v.site === 'YouTube');

        if (!trailer) {
            alert('Trailer belum tersedia.');
            return;
        }

        const modal = document.getElementById('trailerModal');
        const frame = document.getElementById('trailerFrame');

        if (!modal || !frame) return;

        frame.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (e) {
        alert('Gagal memuat trailer.');
    }
}

function closeTrailerModal() {
    const modal = document.getElementById('trailerModal');
    const frame = document.getElementById('trailerFrame');

    if (frame) frame.src = '';

    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function changeServer(s) {
    const f = document.getElementById('videoPlayer');
    let url = '';

    if (!f) return;

    currentServer = s;

    f.setAttribute(
        'allow',
        'autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; clipboard-write *; web-share *; accelerometer *; gyroscope *; user-interaction *'
    );

    f.setAttribute('allowfullscreen', '');
    f.setAttribute('webkitallowfullscreen', '');
    f.setAttribute('mozallowfullscreen', '');
    f.removeAttribute('referrerpolicy');

    // SERVER 1: VAPlayer (Bawaan asli)
    if (s === 'VidSrc') {
        if (currentPlayType === 'tv') {
            url = `https://vaplayer.ru/embed/tv/${currentPlayId}/${currentSeason}/${currentEpisode}?lang=id&ds_lang=id`;
        } else {
            url = `https://vaplayer.ru/embed/movie/${currentPlayId}?lang=id&ds_lang=id`;
        }
    } 
    // SERVER 2: VidKing.net (Otomatis panggil Sub Indo untuk SEMUA film)
    else {
        // Kita pakai sub_label=Indonesian agar server otomatis nyari file di database mereka
        const params = "?autoPlay=true&nextEpisode=true&episodeSelector=true&sub_label=Indonesian";
        
        if (currentPlayType === 'tv') {
            url = `https://www.vidking.net/embed/tv/${currentPlayId}/${currentSeason}/${currentEpisode}${params}`;
        } else {
            url = `https://www.vidking.net/embed/movie/${currentPlayId}${params}`;
        }
    }

    f.src = url;

    document.querySelectorAll('.server-btn').forEach(b => {
        b.className = "server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-40 transition";
    });

    const active = document.getElementById('btn-' + s);

    if (active) {
        active.className = "server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black shadow-xl transition active:scale-95";
    }
}

async function playMovie(id, title, type, backdrop, poster, season = 1, episode = 1) {
    currentPlayId = id;
    currentPlayType = type;
    currentSeason = Number(season) || 1;
    currentEpisode = Number(episode) || 1;
    currentTvDetails = null;

    currentPlayTitle = title;
    currentPlayBackdrop = backdrop || '';
    currentPlayPoster = poster || '';

    const player = document.getElementById('playerContainer');
    const playingTitle = document.getElementById('playingTitle');
    const playerOverview = document.getElementById('playerOverview');
    const playerRating = document.getElementById('playerRating');
    const playerRuntime = document.getElementById('playerRuntime');
    const playerYear = document.getElementById('playerYear');
    const playerControls = document.getElementById('playerControls');

    if (!player) return;

    if (playingTitle) playingTitle.innerText = title;
    if (playerOverview) playerOverview.innerText = "Memuat sinopsis...";
    if (playerRating) playerRating.innerText = "⭐ ...";
    if (playerRuntime) playerRuntime.innerText = "...";
    if (playerYear) playerYear.innerText = "....";

    if (playerControls) {
        // Label tombol Server 2 diubah menjadi "Server 2 (VidKing)"
        playerControls.innerHTML = `
            <button id="btn-VidSrc" onclick="changeServer('VidSrc')" class="server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black shadow-xl">
                Server 1
            </button>

            <button id="btn-AutoEmbed" onclick="changeServer('AutoEmbed')" class="server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-40">
                Server 2 (VidKing)
            </button>

            <button onclick="shareMovie('${title.replace(/'/g, "\\'")}')" class="px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black transition">
                Share
            </button>
        `;
    }

    clearInterval(carouselTimer);

    player.classList.remove('hidden');
    document.body.classList.add('player-open');
    document.body.style.overflow = 'hidden';

    changeServer('VidSrc');

    if (backdrop && backdrop !== 'null') {
        updateAmbient(backdrop);
    }

    try {
        const res = await fetch(`/api/movies?path=${type}/${id}`);
        const m = await res.json();

        if (type === 'tv') {
            renderEpisodeControls(m);
        }

        if (playerOverview) {
            playerOverview.innerText = m.overview || 'Sinopsis tidak tersedia untuk film ini.';
        }

        if (playerRating) {
            playerRating.innerText = `⭐ ${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}`;
        }

        if (playerYear) {
            playerYear.innerText = (m.release_date || m.first_air_date || '2024').split('-')[0];
        }

        if (playerRuntime) {
            playerRuntime.innerText = m.runtime
                ? `${m.runtime}m`
                : (m.episode_run_time?.length ? `${m.episode_run_time[0]}m` : 'TV Series');
        }

        saveToHistory(id, type, backdrop || m.backdrop_path, poster || m.poster_path, title);
    } catch (e) {}

    fetchDetails(id, type);
}

function renderEpisodeControls(tvDetails) {
    const playerControls = document.getElementById('playerControls');
    if (!playerControls || currentPlayType !== 'tv') return;

    currentTvDetails = tvDetails;

    const oldLabel = document.getElementById('episodeLabel');
    const oldSeason = document.getElementById('seasonSelect');
    const oldEpisode = document.getElementById('episodeSelect');

    if (oldLabel) oldLabel.remove();
    if (oldSeason) oldSeason.remove();
    if (oldEpisode) oldEpisode.remove();

    const seasons = (tvDetails.seasons || [])
        .filter(s => s.season_number > 0 && s.episode_count > 0);

    if (seasons.length === 0) return;

    const activeSeason = seasons.find(s => s.season_number === currentSeason) || seasons[0];
    currentSeason = activeSeason.season_number;

    if (currentEpisode > activeSeason.episode_count) {
        currentEpisode = 1;
    }

    const seasonOptions = seasons.map(s => {
        return `
            <option value="${s.season_number}" ${s.season_number === currentSeason ? 'selected' : ''}>
                Season ${s.season_number}
            </option>
        `;
    }).join('');

    const episodeOptions = Array.from({ length: activeSeason.episode_count }, (_, i) => {
        const ep = i + 1;

        return `
            <option value="${ep}" ${ep === currentEpisode ? 'selected' : ''}>
                Episode ${ep}
            </option>
        `;
    }).join('');

    playerControls.insertAdjacentHTML('afterbegin', `
        <span id="episodeLabel" class="px-4 py-3 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
            PILIH EP
        </span>

        <select id="seasonSelect" onchange="changeSeasonEpisode()" class="px-5 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black outline-none">
            ${seasonOptions}
        </select>

        <select id="episodeSelect" onchange="changeSeasonEpisode()" class="px-5 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black outline-none">
            ${episodeOptions}
        </select>
    `);
}

function changeSeasonEpisode() {
    const seasonSelect = document.getElementById('seasonSelect');
    const episodeSelect = document.getElementById('episodeSelect');

    if (!seasonSelect || !episodeSelect) return;

    const newSeason = Number(seasonSelect.value);
    const newEpisode = Number(episodeSelect.value);

    if (newSeason !== currentSeason && currentTvDetails) {
        currentSeason = newSeason;
        currentEpisode = 1;
        renderEpisodeControls(currentTvDetails);
    } else {
        currentSeason = newSeason;
        currentEpisode = newEpisode;
    }

    saveToHistory(
        currentPlayId,
        currentPlayType,
        currentPlayBackdrop,
        currentPlayPoster,
        currentPlayTitle
    );

    changeServer(currentServer || 'VidSrc');
}

async function playMovie(id, title, type, backdrop, poster, season = 1, episode = 1) {
    currentPlayId = id;
    currentPlayType = type;
    currentSeason = Number(season) || 1;
    currentEpisode = Number(episode) || 1;
    currentTvDetails = null;

    currentPlayTitle = title;
    currentPlayBackdrop = backdrop || '';
    currentPlayPoster = poster || '';

    const player = document.getElementById('playerContainer');
    const playingTitle = document.getElementById('playingTitle');
    const playerOverview = document.getElementById('playerOverview');
    const playerRating = document.getElementById('playerRating');
    const playerRuntime = document.getElementById('playerRuntime');
    const playerYear = document.getElementById('playerYear');
    const playerControls = document.getElementById('playerControls');

    if (!player) return;

    if (playingTitle) playingTitle.innerText = title;
    if (playerOverview) playerOverview.innerText = "Memuat sinopsis...";
    if (playerRating) playerRating.innerText = "⭐ ...";
    if (playerRuntime) playerRuntime.innerText = "...";
    if (playerYear) playerYear.innerText = "....";

    if (playerControls) {
        playerControls.innerHTML = `
            <button id="btn-VidSrc" onclick="changeServer('VidSrc')" class="server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black shadow-xl">
                Server 1
            </button>

            <button id="btn-AutoEmbed" onclick="changeServer('AutoEmbed')" class="server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-40">
                Server 2
            </button>

            <button onclick="shareMovie('${title.replace(/'/g, "\\'")}')" class="px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black transition">
                Share
            </button>
        `;
    }

    clearInterval(carouselTimer);

    player.classList.remove('hidden');
    document.body.classList.add('player-open');
    document.body.style.overflow = 'hidden';

    changeServer('VidSrc');

    if (backdrop && backdrop !== 'null') {
        updateAmbient(backdrop);
    }

    try {
        const res = await fetch(`/api/movies?path=${type}/${id}`);
        const m = await res.json();

        if (type === 'tv') {
            renderEpisodeControls(m);
        }

        if (playerOverview) {
            playerOverview.innerText = m.overview || 'Sinopsis tidak tersedia untuk film ini.';
        }

        if (playerRating) {
            playerRating.innerText = `⭐ ${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}`;
        }

        if (playerYear) {
            playerYear.innerText = (m.release_date || m.first_air_date || '2024').split('-')[0];
        }

        if (playerRuntime) {
            playerRuntime.innerText = m.runtime
                ? `${m.runtime}m`
                : (m.episode_run_time?.length ? `${m.episode_run_time[0]}m` : 'TV Series');
        }

        saveToHistory(id, type, backdrop || m.backdrop_path, poster || m.poster_path, title);
    } catch (e) {}

    fetchDetails(id, type);
}

async function fetchDetails(id, type) {
    try {
        const res = await fetch(`/api/movies?path=${type}/${id}/credits`);
        const data = await res.json();

        const cBox = document.getElementById('castContainer');
        if (!cBox) return;

        cBox.innerHTML = '';

        data.cast?.slice(0, 10).forEach(a => {
            if (!a.profile_path) return;

            const sName = safeText(a.name);
            const d = document.createElement('div');

            d.className = "flex-shrink-0 text-center w-20 opacity-60 hover:opacity-100 cursor-pointer transition hover:scale-110";

            d.onclick = () => {
                closePlayer();
                loadActorFilms(a.id, sName);
            };

            d.innerHTML = `
                <img src="${IMG_PATH + a.profile_path}" class="actor-circle mx-auto mb-3 shadow-lg border border-white/10">
                <p class="text-[8px] font-black uppercase tracking-tighter truncate w-full text-white">${sName}</p>
            `;

            cBox.appendChild(d);
        });
    } catch (e) {}

    try {
        const sim = await fetch(`/api/movies?path=${type}/${id}/recommendations`);
        const sData = await sim.json();

        renderCards(
            sData.results?.slice(0, 10) || [],
            document.getElementById('similarContainer'),
            false,
            type === 'tv'
        );
    } catch (e) {}
}

function isMobileView() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function safeClosePlayer() {
    const btn = document.getElementById('playerCloseBtn');

    if (!isMobileView()) {
        closePlayer();
        return;
    }

    if (mobileCloseWaitingConfirm) {
        mobileCloseWaitingConfirm = false;

        if (btn) {
            btn.classList.remove('need-confirm');
        }

        clearTimeout(mobileCloseConfirmTimer);
        closePlayer();
        return;
    }

    mobileCloseWaitingConfirm = true;

    if (btn) {
        btn.classList.add('need-confirm');
    }

    clearTimeout(mobileCloseConfirmTimer);

    mobileCloseConfirmTimer = setTimeout(() => {
        mobileCloseWaitingConfirm = false;

        if (btn) {
            btn.classList.remove('need-confirm');
        }
    }, 2200);
}

function closePlayer() {
    mobileCloseWaitingConfirm = false;
    clearTimeout(mobileCloseConfirmTimer);

    const closeBtn = document.getElementById('playerCloseBtn');

    if (closeBtn) {
        closeBtn.classList.remove('need-confirm');
    }

    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }

    if (player) {
        player.classList.add('hidden');
    }

    if (iframe) {
        iframe.src = '';
        delete iframe.dataset.lastSrc;
    }

    document.body.classList.remove('player-open');
    document.body.style.overflow = 'auto';

    if (featuredMovies && featuredMovies.length > 0) {
        startCarousel();
    }
}

async function loadCategory(path, label) {
    window.scrollTo(0, 0);

    document.getElementById('homeView')?.classList.add('hidden');
    document.getElementById('heroSection')?.classList.add('hidden');
    document.getElementById('gridSection')?.classList.remove('hidden');

    const gridTitle = document.getElementById('gridTitle');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const gridResults = document.getElementById('gridResults');

    if (gridTitle) gridTitle.innerText = label;
    if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');

    currentPage = 1;
    currentPath = path;

    if (gridResults) {
        gridResults.innerHTML = '';
    }

    renderSkeleton('gridResults');

    try {
        const res = await fetch(`/api/movies?path=${path.replace(/\?/g, '&')}&page=${currentPage}`);
        const data = await res.json();

        renderCards(data.results || [], document.getElementById('gridResults'));
    } catch (e) {}
}

async function loadMore() {
    currentPage++;

    try {
        const res = await fetch(`/api/movies?path=${currentPath.replace(/\?/g, '&')}&page=${currentPage}`);
        const data = await res.json();

        renderCards(data.results || [], document.getElementById('gridResults'), true);
    } catch (e) {}
}

async function loadActorFilms(actorId, actorName) {
    window.scrollTo(0, 0);

    document.getElementById('homeView')?.classList.add('hidden');
    document.getElementById('heroSection')?.classList.add('hidden');
    document.getElementById('gridSection')?.classList.remove('hidden');

    const gridTitle = document.getElementById('gridTitle');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const gridResults = document.getElementById('gridResults');

    if (gridTitle) gridTitle.innerText = `Movies by ${actorName}`;
    if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');

    currentPage = 1;
    currentPath = `discover/movie?with_cast=${actorId}&sort_by=popularity.desc`;

    if (gridResults) {
        gridResults.innerHTML = '';
    }

    renderSkeleton('gridResults');

    try {
        const res = await fetch(`/api/movies?path=${currentPath.replace(/\?/g, '&')}&page=${currentPage}`);
        const data = await res.json();

        renderCards(data.results || [], document.getElementById('gridResults'));
    } catch (e) {}
}

function goHome() {
    window.location.reload();
}

function setupSearch() {
    const input = document.getElementById('searchInput');
    const suggestions = document.getElementById('searchSuggestions');

    if (!input || !suggestions) return;

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            hideSearchSuggestions();
            loadCategory(
                `search/multi?query=${encodeURIComponent(input.value.trim())}`,
                `Hasil Pencarian: ${input.value.trim()}`
            );
        }
    });

    input.addEventListener('input', () => {
        clearTimeout(liveSearchTimeout);

        const query = input.value.trim();

        if (query.length < 2) {
            hideSearchSuggestions();
            return;
        }

        liveSearchTimeout = setTimeout(() => {
            loadSearchSuggestions(query);
        }, 350);
    });

    document.addEventListener('click', (e) => {
        if (!suggestions.contains(e.target) && e.target !== input) {
            hideSearchSuggestions();
        }
    });
}

async function loadSearchSuggestions(query) {
    const suggestions = document.getElementById('searchSuggestions');
    const input = document.getElementById('searchInput');

    if (!suggestions || !input) return;

    try {
        const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}`);
        const data = await res.json();

        const results = (data.results || [])
            .filter(m => (m.media_type === 'movie' || m.media_type === 'tv') && m.poster_path)
            .slice(0, 6);

        if (results.length === 0) {
            suggestions.innerHTML = `<p class="text-white/40 text-xs font-bold p-4">Tidak ada hasil.</p>`;
            suggestions.classList.remove('hidden');
            return;
        }

        suggestions.innerHTML = '';

        results.forEach(m => {
            const title = safeText(m.title || m.name);
            const type = m.media_type || (m.title ? 'movie' : 'tv');

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'suggestion-item w-full text-left';

            item.innerHTML = `
                <img src="${IMG_PATH + m.poster_path}" class="suggestion-poster" loading="lazy">
                <div class="min-w-0">
                    <h4 class="text-xs font-black text-white truncate uppercase">${title}</h4>
                    <p class="text-[9px] font-black tracking-widest uppercase text-blue-400">${type === 'tv' ? 'Series' : 'Movie'}</p>
                    <p class="text-[10px] text-white/40 truncate">${(m.release_date || m.first_air_date || '').split('-')[0] || 'N/A'}</p>
                </div>
            `;

            item.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                hideSearchSuggestions();
                input.value = '';

                openMovieDetail(
                    m.id,
                    title,
                    type,
                    m.backdrop_path || '',
                    m.poster_path || ''
                );
            });

            suggestions.appendChild(item);
        });

        suggestions.classList.remove('hidden');
    } catch (e) {
        console.error('Gagal memuat search suggestions:', e);
        hideSearchSuggestions();
    }
}

function hideSearchSuggestions() {
    const suggestions = document.getElementById('searchSuggestions');
    if (!suggestions) return;

    suggestions.classList.add('hidden');
    suggestions.innerHTML = '';
}

function setupFilterYears() {
    const yearSelect = document.getElementById('filterYear');
    if (!yearSelect) return;

    const now = new Date().getFullYear();

    for (let y = now; y >= 1980; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        yearSelect.appendChild(opt);
    }
}

async function openFromTelegramLink() {
    const params = new URLSearchParams(window.location.search);

    const type = params.get('type');
    const id = params.get('id');

    if (!type || !id) return;
    if (type !== 'movie' && type !== 'tv') return;

    const season = Number(params.get('season') || params.get('s') || 1);
    const episode = Number(params.get('episode') || params.get('e') || 1);
    const shouldPlay = params.get('play') === '1';

    try {
        const res = await fetch(`/api/movies?path=${type}/${id}`);
        const m = await res.json();

        if (!m || m.success === false) return;

        const title = safeText(m.title || m.name || 'Unknown');
        const backdrop = m.backdrop_path || '';
        const poster = m.poster_path || '';

        if (backdrop) {
            updateAmbient(backdrop);
        }

        setTimeout(() => {
            if (shouldPlay) {
                playMovie(
                    Number(id),
                    title,
                    type,
                    backdrop,
                    poster,
                    season,
                    episode
                );
            } else {
                openMovieDetail(
                    Number(id),
                    title,
                    type,
                    backdrop,
                    poster,
                    season,
                    episode
                );
            }
        }, 700);
    } catch (e) {
        console.error('Gagal membuka link Telegram:', e);
    }
}

function applyFilter() {
    const type = document.getElementById('filterType')?.value || 'movie';
    const genreSelect = document.getElementById('filterGenre');
    const year = document.getElementById('filterYear')?.value || '';
    const language = document.getElementById('filterLanguage')?.value || '';
    const country = document.getElementById('filterCountry')?.value || '';

    let genreId = '';

    if (genreSelect && genreSelect.selectedIndex > -1) {
        const selected = genreSelect.options[genreSelect.selectedIndex];
        genreId = type === 'tv' ? selected.dataset.tv || '' : selected.dataset.movie || '';
    }

    const params = new URLSearchParams();

    params.set('sort_by', 'popularity.desc');

    if (genreId) {
        params.set('with_genres', genreId);
    }

    if (year) {
        if (type === 'tv') {
            params.set('first_air_date_year', year);
        } else {
            params.set('primary_release_year', year);
        }
    }

    if (language) {
        params.set('with_original_language', language);
    }

    if (country) {
        params.set('with_origin_country', country);
    }

    const languageSelect = document.getElementById('filterLanguage');
    const countrySelect = document.getElementById('filterCountry');

    const languageText = languageSelect?.options[languageSelect.selectedIndex]?.text || '';
    const countryText = countrySelect?.options[countrySelect.selectedIndex]?.text || '';

    const labelParts = [
        type === 'tv' ? 'Series' : 'Movie',
        genreSelect?.options[genreSelect.selectedIndex]?.text || '',
        year || '',
        language ? languageText : '',
        country ? countryText : ''
    ].filter(Boolean);

    loadCategory(`discover/${type}?${params.toString()}`, `Filter: ${labelParts.join(' / ')}`);
}

function resetFilter() {
    const type = document.getElementById('filterType');
    const genre = document.getElementById('filterGenre');
    const year = document.getElementById('filterYear');
    const language = document.getElementById('filterLanguage');
    const country = document.getElementById('filterCountry');

    if (type) type.value = 'movie';
    if (genre) genre.value = '';
    if (year) year.value = '';
    if (language) language.value = '';
    if (country) country.value = '';

    goHome();
}

function saveToHistory(id, type, backdrop, poster, title) {
    let h = JSON.parse(localStorage.getItem('nbg_history') || '[]');

    h = h.filter(x => x.id !== id);

    const prog = Math.floor(Math.random() * 50) + 25;

    const item = {
        id,
        type,
        media_type: type,
        backdrop_path: backdrop,
        poster_path: poster,
        title,
        progress: prog
    };

    if (type === 'tv') {
        item.season_number = currentSeason;
        item.episode_number = currentEpisode;
        item.lastSeason = currentSeason;
        item.lastEpisode = currentEpisode;
        item.last_watch_label = `S${currentSeason} E${currentEpisode}`;
    }

    h.unshift(item);

    localStorage.setItem('nbg_history', JSON.stringify(h.slice(0, 10)));

    renderHistory();
}

function renderHistory() {
    const h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    const sect = document.getElementById('historySection');
    const row = document.getElementById('rowHistory');

    if (!sect || !row) return;

    if (h.length > 0) {
        sect.classList.remove('hidden');
        renderCards(h, row, false, false, true);
        setupRowButtons();
    } else {
        row.innerHTML = '';
        sect.classList.add('hidden');
    }
}

function deleteHistoryItem(e, id, type) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    let h = JSON.parse(localStorage.getItem('nbg_history') || '[]');

    h = h.filter(item => {
        const itemType = item.media_type || item.type || (item.title ? 'movie' : 'tv');

        return !(
            Number(item.id) === Number(id) &&
            itemType === type
        );
    });

    localStorage.setItem('nbg_history', JSON.stringify(h));

    renderHistory();
}

function clearHistory() {
    localStorage.removeItem('nbg_history');

    const row = document.getElementById('rowHistory');
    const sect = document.getElementById('historySection');

    if (row) {
        row.innerHTML = '';
    }

    if (sect) {
        sect.classList.add('hidden');
    }
}

function setupDragToScroll() {
    // Drag-scroll dimatikan. Row sekarang pakai tombol kiri/kanan.
}

function setupRowButtons() {
    const rows = document.querySelectorAll('#homeView section > .overflow-x-auto');

    rows.forEach(row => {
        if (!row || !row.id) return;

        const section = row.closest('section');
        if (!section) return;

        const header = section.querySelector('.row-header');
        if (!header) return;

        if (header.querySelector(`[data-row-controls="${row.id}"]`)) return;

        row.classList.remove('cursor-grab');
        row.classList.remove('active:cursor-grabbing');

        const controls = document.createElement('div');
        controls.className = 'row-nav-controls';
        controls.dataset.rowControls = row.id;

        controls.innerHTML = `
            <button type="button" class="row-nav-btn" onclick="scrollMovieRow('${row.id}', -1)" aria-label="Geser kiri">
                ‹
            </button>

            <button type="button" class="row-nav-btn" onclick="scrollMovieRow('${row.id}', 1)" aria-label="Geser kanan">
                ›
            </button>
        `;

        header.appendChild(controls);
    });
}

function scrollMovieRow(rowId, direction) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const amount = Math.max(row.clientWidth * 0.85, 320);

    row.scrollBy({
        left: direction * amount,
        behavior: 'smooth'
    });
}

function copyAdguardDns() {
    const dnsText = 'dns.adguard.com';

    if (navigator.clipboard) {
        navigator.clipboard.writeText(dnsText).then(() => {
            alert('DNS berhasil disalin: ' + dnsText);
        }).catch(() => {
            alert('DNS: ' + dnsText);
        });
    } else {
        alert('DNS: ' + dnsText);
    }
}

function openTelegramOfficial() {
    const telegramWeb = 'https://t.me/nobargasii';

    if (navigator.clipboard) {
        navigator.clipboard.writeText(telegramWeb).catch(() => {});
    }

    window.location.href = telegramWeb;

    setTimeout(() => {
        alert('Kalau belum masuk Telegram otomatis, link grup sudah disalin. Buka Telegram lalu paste link: ' + telegramWeb);
    }, 900);
}

function closeAdguardNotice() {
    const notice = document.getElementById('adguardNotice');
    if (!notice) return;

    notice.classList.add('hidden');
}

function getVisitorId() {
    let id = localStorage.getItem('nbg_visitor_id');

    if (!id) {
        id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('nbg_visitor_id', id);
    }

    return id;
}

async function updateLiveVisitorCount() {
    const el = document.getElementById('liveVisitorCount');

    if (!el) return;

    try {
        const id = getVisitorId();

        const res = await fetch(`/api/visitor-live?id=${encodeURIComponent(id)}&t=${Date.now()}`, {
            cache: 'no-store'
        });

        const data = await res.json();

        if (data.ok) {
            el.innerText = data.online;
        }
    } catch (err) {
        console.warn('Gagal update visitor live:', err.message);
    }
}

function setupLiveVisitors() {
    updateLiveVisitorCount();

    setInterval(() => {
        if (document.visibilityState === 'visible') {
            updateLiveVisitorCount();
        }
    }, 30000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateLiveVisitorCount();
        }
    });
}

function updateHero() {
    const m = featuredMovies[currentHeroIndex];
    if (!m) return;

    const sTitle = safeText(m.title || m.name);

    const heroContent = document.getElementById('heroContent');
    const heroTitle = document.getElementById('heroTitle');
    const heroDesc = document.getElementById('heroDesc');
    const heroPlayBtn = document.getElementById('heroPlayBtn');

    if (heroContent) {
        heroContent.style.backgroundImage = `url('${BACK_PATH + m.backdrop_path}')`;
    }

    if (heroTitle) {
        heroTitle.innerText = sTitle;
    }

    if (heroDesc) {
        heroDesc.innerText = m.overview || '';
    }

    if (heroPlayBtn) {
        heroPlayBtn.onclick = () => {
            openMovieDetail(
                m.id,
                sTitle,
                m.media_type || 'movie',
                m.backdrop_path || '',
                m.poster_path || ''
            );
        };
    }

    updateAmbient(m.backdrop_path);

    let dots = '';

    featuredMovies.forEach((_, i) => {
        dots += `<div class="w-1 h-6 rounded-full transition-all ${i === currentHeroIndex ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-white/10'}"></div>`;
    });

    const dotContainer = document.getElementById('heroDots');

    if (dotContainer) {
        dotContainer.innerHTML = dots;
    }
}

function startCarousel() {
    clearInterval(carouselTimer);

    if (!featuredMovies || featuredMovies.length === 0) return;

    carouselTimer = setInterval(() => {
        currentHeroIndex = (currentHeroIndex + 1) % featuredMovies.length;
        updateHero();
    }, 8000);
}

function shareMovie(t) {
    if (navigator.share) {
        navigator.share({
            title: `Nonton ${t}`,
            text: `Lagi seru nih nonton di Nobargasi!`,
            url: window.location.href
        }).catch(() => {});
    } else {
        alert("Link web disalin!");
    }
}

async function surpriseMe() {
    if (featuredMovies.length === 0) return;

    const r = featuredMovies[Math.floor(Math.random() * featuredMovies.length)];

    openMovieDetail(
        r.id,
        safeText(r.title || r.name),
        r.media_type || 'movie',
        r.backdrop_path || '',
        r.poster_path || ''
    );
}

// ===============================
// WEBVIEW BACK BUTTON FIX
// ===============================

window.addEventListener('popstate', () => {

    // =========================
    // CLOSE TRAILER MODAL
    // =========================
    const trailerModal = document.getElementById('trailerModal');

    if (
        trailerModal &&
        !trailerModal.classList.contains('hidden')
    ) {

        closeTrailerModal();

        history.pushState({
            modal: 'trailer-closed'
        }, '');

        return;
    }

    // =========================
    // CLOSE PLAYER
    // =========================
    if (document.body.classList.contains('player-open')) {

        closePlayer();

        history.pushState({
            modal: 'player-closed'
        }, '');

        return;
    }

    // =========================
    // CLOSE DETAIL MODAL
    // =========================
    const detailModal = document.getElementById('detailModal');

    if (
        detailModal &&
        !detailModal.classList.contains('hidden')
    ) {

        closeDetailModal();

        history.pushState({
            modal: 'detail-closed'
        }, '');

        return;
    }

    // =========================
    // CLOSE CATEGORY / GRID
    // =========================
    const gridSection = document.getElementById('gridSection');
    const homeView = document.getElementById('homeView');
    const heroSection = document.getElementById('heroSection');

    if (
        gridSection &&
        !gridSection.classList.contains('hidden')
    ) {

        gridSection.classList.add('hidden');

        homeView?.classList.remove('hidden');

        heroSection?.classList.remove('hidden');

        history.pushState({
            modal: 'home'
        }, '');

        return;
    }
});

// ===============================
// PUSH INITIAL HISTORY
// ===============================

window.addEventListener('load', () => {

    history.replaceState({
        page: 'home'
    }, '');

});

// ===============================
// DETAIL MODAL HISTORY PATCH
// ===============================

const __originalOpenMovieDetail = openMovieDetail;

openMovieDetail = async function(
    id,
    title,
    type,
    backdrop,
    poster,
    season = 1,
    episode = 1
) {

    history.pushState({
        page: 'detail',
        id: id
    }, '');

    return await __originalOpenMovieDetail(
        id,
        title,
        type,
        backdrop,
        poster,
        season,
        episode
    );
};

// ===============================
// PLAYER HISTORY PATCH
// ===============================

const __originalPlayMovie = playMovie;

playMovie = async function(
    id,
    title,
    type,
    backdrop,
    poster,
    season = 1,
    episode = 1
) {

    history.pushState({
        page: 'player',
        id: id
    }, '');

    return await __originalPlayMovie(
        id,
        title,
        type,
        backdrop,
        poster,
        season,
        episode
    );
};
