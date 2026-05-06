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

window.onload = () => {
    initApp();
    setupScrollEffects();
    setupDragToScroll();
    setupSearch();
    setupFullscreenCleanMode();
};

// --- CLEAN STRING (Anti Crash) ---
function safeText(str) {
    if (!str) return 'Unknown';
    return String(str).replace(/['"\\`]/g, '');
}

// --- AMBIENT BG ---
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

// --- INIT APP FULL CONTENT ---
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

// --- MY LIST (FAVORIT) LOGIC ---
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

// --- RENDER ENGINE ---
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
                    <div class="poster-container" onclick="playMovie(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}', '${m.poster_path || ''}')">
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

function renderCards(movies, container, append = false, isTV = false) {
    if (!container) return;
    if (!append) container.innerHTML = '';

    const myList = getMyList();

    movies.forEach(m => {
        if (!m.poster_path) return;

        const type = isTV ? 'tv' : (m.media_type || m.type || (m.title ? 'movie' : 'tv'));
        const sTitle = safeText(m.title || m.name);

        const progHTML = m.progress
            ? `<div class="resume-bar"><div class="resume-progress" style="width: ${m.progress}%"></div></div>`
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

        const card = document.createElement('div');
        card.className = "movie-card";

        card.innerHTML = `
            <button onclick="toggleMyList(event, '${movieStr}')" class="fav-btn" style="color: ${isFav ? '#ef4444' : 'white'}">${isFav ? '❤️' : '🤍'}</button>
            <div class="poster-container" onclick="playMovie(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}', '${m.poster_path || ''}')">
                <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-all duration-500">
                    <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-lg">▶</div>
                </div>
                ${progHTML}
            </div>
            <div class="mt-3 px-1 text-center">
                <h3 class="text-[11px] font-black truncate text-white uppercase tracking-wider drop-shadow-md">${sTitle}</h3>
            </div>
        `;

        container.appendChild(card);
    });
}

// --- PLAYER & METADATA ---
function changeServer(s) {
    const f = document.getElementById('videoPlayer');
    if (!f) return;

    let url = '';

    /*
        Fullscreen wildcard.
        Ini penting untuk embed yang punya iframe di dalam iframe.
    */
    f.setAttribute(
        'allow',
        'autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; clipboard-write *; web-share *; accelerometer *; gyroscope *'
    );

    f.setAttribute('allowfullscreen', '');
    f.setAttribute('webkitallowfullscreen', '');
    f.setAttribute('mozallowfullscreen', '');

    // Jangan pakai referrerpolicy dulu.
    // Beberapa embed lebih rewel kalau referrer dikosongkan.
    f.removeAttribute('referrerpolicy');

    if (s === 'VidSrc') {
        // Format lama Server 1, paling native untuk VidSrc.
        url = `https://vidsrc.me/embed/${currentPlayType}?tmdb=${currentPlayId}`;
    } else {
        url = `https://player.autoembed.app/embed/${currentPlayType}/${currentPlayId}`;

        if (currentPlayType === 'tv') {
            url += `/${currentSeason}/${currentEpisode}`;
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

function renderEpisodeControls(tvDetails) {
    const playerControls = document.getElementById('playerControls');
    if (!playerControls || currentPlayType !== 'tv') return;

    currentTvDetails = tvDetails;

    const oldSeason = document.getElementById('seasonSelect');
    const oldEpisode = document.getElementById('episodeSelect');
    const oldLabel = document.getElementById('episodeLabel');

    if (oldSeason) oldSeason.remove();
    if (oldEpisode) oldEpisode.remove();
    if (oldLabel) oldLabel.remove();

    const seasons = (tvDetails.seasons || [])
        .filter(s => s.season_number > 0 && s.episode_count > 0);

    if (seasons.length === 0) return;

    const activeSeason = seasons.find(s => s.season_number === currentSeason) || seasons[0];
    currentSeason = activeSeason.season_number;

    if (currentEpisode > activeSeason.episode_count) {
        currentEpisode = 1;
    }

    const seasonOptions = seasons.map(s => {
        return `<option value="${s.season_number}" ${s.season_number === currentSeason ? 'selected' : ''}>
            Season ${s.season_number}
        </option>`;
    }).join('');

    const episodeOptions = Array.from({ length: activeSeason.episode_count }, (_, i) => {
        const ep = i + 1;
        return `<option value="${ep}" ${ep === currentEpisode ? 'selected' : ''}>
            Episode ${ep}
        </option>`;
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
        changeServer('AutoEmbed');
        return;
    }

    currentSeason = newSeason;
    currentEpisode = newEpisode;

    changeServer('AutoEmbed');
}

async function playMovie(id, title, type, backdrop, poster) {
    currentPlayId = id;
    currentPlayType = type;
    currentSeason = 1;
    currentEpisode = 1;
    currentTvDetails = null;

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

function closePlayer() {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }

    if (player) {
        player.classList.add('hidden');
    }

    if (iframe) {
        iframe.src = 'about:blank';
        delete iframe.dataset.lastSrc;
    }

    document.body.classList.remove('player-open');
    document.body.style.overflow = 'auto';

    if (featuredMovies && featuredMovies.length > 0) {
        startCarousel();
    }
}

function setupFullscreenCleanMode() {
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('cursor-idle');
        }
    });
}

// Jangan kosongkan iframe saat tab berubah.
// Beberapa player menganggap fullscreen sebagai visibilitychange,
// jadi kalau iframe diubah ke about:blank, fullscreen bawaan server bisa gagal.
document.addEventListener('visibilitychange', () => {
    const player = document.getElementById('playerContainer');

    if (!player) return;
    if (player.classList.contains('hidden')) return;

    // Sengaja tidak mengubah src iframe.
});

// --- NAV & SEARCH ---
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
    if (!input) return;

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value) {
            loadCategory(
                `search/multi?query=${encodeURIComponent(input.value)}`,
                `Hasil Pencarian: ${input.value}`
            );
        }
    });
}

// --- UTILS HISTORY FIX ---
function saveToHistory(id, type, backdrop, poster, title) {
    let h = JSON.parse(localStorage.getItem('nbg_history') || '[]');

    h = h.filter(x => x.id !== id);

    const prog = Math.floor(Math.random() * 50) + 25;

    h.unshift({
        id,
        type,
        backdrop_path: backdrop,
        poster_path: poster,
        title,
        progress: prog
    });

    localStorage.setItem('nbg_history', JSON.stringify(h.slice(0, 10)));

    renderHistory();
}

function renderHistory() {
    const h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    const sect = document.getElementById('historySection');

    if (h.length > 0 && sect) {
        sect.classList.remove('hidden');
        renderCards(h, document.getElementById('rowHistory'));
    }
}

function clearHistory() {
    localStorage.removeItem('nbg_history');

    const sect = document.getElementById('historySection');

    if (sect) {
        sect.classList.add('hidden');
    }
}

function setupDragToScroll() {
    document.querySelectorAll('.overflow-x-auto').forEach(s => {
        let isDown = false;
        let startX;
        let scrollLeft;

        s.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - s.offsetLeft;
            scrollLeft = s.scrollLeft;
            s.classList.add('cursor-grabbing');
        });

        s.addEventListener('mouseleave', () => {
            isDown = false;
            s.classList.remove('cursor-grabbing');
        });

        s.addEventListener('mouseup', () => {
            isDown = false;
            s.classList.remove('cursor-grabbing');
        });

        s.addEventListener('mousemove', (e) => {
            if (!isDown) return;

            e.preventDefault();

            const x = e.pageX - s.offsetLeft;
            const walk = (x - startX) * 2;

            s.scrollLeft = scrollLeft - walk;
        });
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
            playMovie(
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

    playMovie(
        r.id,
        safeText(r.title || r.name),
        r.media_type || 'movie',
        r.backdrop_path || '',
        r.poster_path || ''
    );
}

/* ===================================================== */
/* DNS / BRAVE RECOMMENDATION NOTICE */
/* ===================================================== */

function showDnsNotice() {
    const notice = document.getElementById('dnsNotice');
    if (!notice) return;

    notice.classList.remove('hidden');
    notice.classList.add('flex');
}

function closeDnsNotice() {
    const notice = document.getElementById('dnsNotice');
    if (!notice) return;

    notice.classList.add('hidden');
    notice.classList.remove('flex');
}

function copyDnsNotice() {
    const dnsText = 'p2.freedns.controld.com';

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

window.addEventListener('load', () => {
    setTimeout(() => {
        showDnsNotice();
    }, 1200);
});
