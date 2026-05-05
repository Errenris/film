const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentPath = ''; let currentAction = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let currentPlayId = ''; let currentPlayType = ''; let liveSearchTimeout;

window.onload = () => { initApp(); setupScrollEffects(); setupDragToScroll(); setupSearch(); };

// --- CLEAN STRING (Anti Crash) ---
function safeText(str) {
    if (!str) return 'Unknown';
    return str.replace(/['"\\`]/g, '');
}

// --- AMBIENT BG ---
function updateAmbient(img) {
    const bg = document.getElementById('ambientBg');
    if(img && bg) bg.style.backgroundImage = `url('${BACK_PATH + img}')`;
}

function setupScrollEffects() {
    const header = document.getElementById('mainHeader');
    window.addEventListener('scroll', () => {
        if(!header) return;
        const cur = window.pageYOffset;
        header.style.opacity = cur > 100 ? "0.1" : "1";
        header.parentElement.style.transform = cur > 100 ? "translateY(-15px)" : "translateY(0)";
    }, { passive: true });
}

// --- INIT APP ---
function initApp() {
    let oldHist = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    if(oldHist.length > 0 && !oldHist[0].poster_path) { localStorage.removeItem('nbg_history'); }

    const rows = ['rowTrending', 'rowActors', 'rowMarvel', 'rowDC', 'rowDrakor', 'rowAnime', 'row1', 'row2'];
    rows.forEach(r => renderSkeleton(r));

    loadHeroBanner();
    fetchAndRenderTrending('trending/movie/day', 'rowTrending');
    fetchAndRenderActors('trending/person/week', 'rowActors');
    fetchAndRender('discover/movie?with_companies=420&sort_by=revenue.desc', 'rowMarvel'); 
    fetchAndRender('discover/movie?with_companies=429&sort_by=popularity.desc', 'rowDC'); 
    fetchAndRender('discover/tv?with_original_language=ko', 'rowDrakor', true); 
    fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'rowAnime', true); 
    fetchAndRender('movie/popular', 'row1'); 
    fetchAndRender('tv/popular', 'row2', true); 
    
    renderHistory();
}

function renderSkeleton(id) {
    const c = document.getElementById(id); if(!c) return; c.innerHTML = '';
    for(let i=0; i<8; i++) {
        const s = document.createElement('div'); s.className = "movie-card";
        s.innerHTML = `<div class="skeleton"></div>`;
        c.appendChild(s);
    }
}

async function loadHeroBanner() {
    try {
        const res = await fetch(`/api/movies?path=trending/all/day`); 
        const data = await res.json();
        if(data.results) { featuredMovies = data.results.slice(0, 8); updateHero(); startCarousel(); }
    } catch(e){}
}

// --- PLAYER ENGINE (SANDBOX REMOVED) ---
function changeServer(s) {
    const f = document.getElementById('videoPlayer'); 
    let url = '';
    
    if(s === 'VidLink') {
        url = `https://vidlink.pro/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    } else if(s === 'VidsrcCC') {
        url = `https://vidsrc.cc/v2/embed/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    } else if(s === 'EmbedSu') {
        url = `https://embed.su/embed/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    }
    
    // DISABLE SANDBOX: Baris setAttribute sandbox dihapus agar player jalan normal
    f.removeAttribute('sandbox'); 
    f.src = url;
    
    document.querySelectorAll('.server-btn').forEach(b => b.className = "server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-40 transition");
    const active = document.getElementById('btn-'+s);
    if(active) active.className = "server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black shadow-xl transition active:scale-95";
}

async function playMovie(id, title, type, backdrop, poster) {
    currentPlayId = id; currentPlayType = type;
    const player = document.getElementById('playerContainer');
    document.getElementById('playingTitle').innerText = title;
    document.getElementById('playerOverview').innerText = "Memuat data...";
    
    document.getElementById('playerControls').innerHTML = `
        <button id="btn-VidLink" onclick="changeServer('VidLink')" class="server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black shadow-xl">Server 1 (Clean)</button>
        <button id="btn-VidsrcCC" onclick="changeServer('VidsrcCC')" class="server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-40">Server 2 (Fast)</button>
        <button id="btn-EmbedSu" onclick="changeServer('EmbedSu')" class="server-btn px-8 py-3 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-40">Server 3 (HD)</button>
        <button onclick="shareMovie('${title.replace(/'/g, "\\'")}')" class="px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black transition">Share</button>`;
    
    changeServer('VidLink');
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if(backdrop && backdrop !== 'null') updateAmbient(backdrop);

    try {
        const res = await fetch(`/api/movies?path=${type}/${id}`);
        const m = await res.json();
        document.getElementById('playerOverview').innerText = m.overview || 'Sinopsis tidak tersedia.';
        document.getElementById('playerRating').innerText = `⭐ ${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}`;
        document.getElementById('playerYear').innerText = (m.release_date || m.first_air_date || '2024').split('-')[0];
        document.getElementById('playerRuntime').innerText = m.runtime ? `${m.runtime}m` : (m.episode_run_time?.length ? `${m.episode_run_time[0]}m` : 'TV Series');
        saveToHistory(id, type, backdrop || m.backdrop_path, poster || m.poster_path, title);
    } catch(e){}
    fetchDetails(id, type);
}

// --- RENDERERS ---
function renderCards(movies, container, append = false, isTV = false) {
    if (!container) return; if (!append) container.innerHTML = '';
    const myList = getMyList();

    movies.forEach(m => {
        if (!m.poster_path) return;
        const type = isTV ? 'tv' : (m.media_type || (m.title ? 'movie' : 'tv'));
        const sTitle = safeText(m.title || m.name);
        const progHTML = m.progress ? `<div class="resume-bar"><div class="resume-progress" style="width: ${m.progress}%"></div></div>` : '';
        const movieObj = encodeURIComponent(JSON.stringify({ id: m.id, title: sTitle, poster_path: m.poster_path, backdrop_path: m.backdrop_path, media_type: type }));
        const isFav = myList.some(x => x.id === m.id);

        const card = document.createElement('div'); card.className = "movie-card";
        card.innerHTML = `
            <button onclick="toggleMyList(event, '${movieObj}')" class="fav-btn" style="color: ${isFav ? '#ef4444' : 'white'}">${isFav ? '❤️' : '🤍'}</button>
            <div class="poster-container" onclick="playMovie(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}', '${m.poster_path || ''}')">
                <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-all duration-500"><div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-xl">▶</div></div>
                ${progHTML}
            </div>
            <div class="mt-3 px-1 text-center"><h3 class="text-[11px] font-[900] truncate text-white uppercase tracking-wider leading-tight drop-shadow-md">${sTitle}</h3></div>`;
        container.appendChild(card);
    });
}

function renderTrendingCards(movies, container) {
    if(!container) return; container.innerHTML = '';
    const myList = getMyList();
    movies.slice(0, 10).forEach((m, i) => {
        const sTitle = safeText(m.title || m.name);
        const type = m.media_type || 'movie';
        const movieObj = encodeURIComponent(JSON.stringify({ id: m.id, title: sTitle, poster_path: m.poster_path, backdrop_path: m.backdrop_path, media_type: type }));
        const isFav = myList.some(x => x.id === m.id);

        const w = document.createElement('div'); w.className = "flex items-end relative flex-shrink-0 mr-12";
        w.innerHTML = `<div class="netflix-number">${i+1}</div>
            <div class="movie-card">
                <button onclick="toggleMyList(event, '${movieObj}')" class="fav-btn" style="color: ${isFav ? '#ef4444' : 'white'}">${isFav ? '❤️' : '🤍'}</button>
                <div class="poster-container" onclick="playMovie(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}', '${m.poster_path || ''}')">
                    <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                </div>
                <div class="mt-3 px-1 text-center"><h3 class="text-[11px] font-[900] truncate text-white uppercase tracking-wider leading-tight drop-shadow-md">${sTitle}</h3></div>
            </div>`;
        container.appendChild(w);
    });
}

// --- UTILS ---
function getMyList() { return JSON.parse(localStorage.getItem('nbg_mylist') || '[]'); }
function saveMyList(list) { localStorage.setItem('nbg_mylist', JSON.stringify(list)); }
function toggleMyList(e, movieStr) {
    e.stopPropagation(); 
    const movie = JSON.parse(decodeURIComponent(movieStr));
    let list = getMyList();
    const idx = list.findIndex(m => m.id === movie.id);
    if (idx > -1) { list.splice(idx, 1); e.target.innerText = '🤍'; e.target.style.color = 'white'; } 
    else { list.push(movie); e.target.innerText = '❤️'; e.target.style.color = '#ef4444'; }
    saveMyList(list);
    if (!document.getElementById('gridSection').classList.contains('hidden') && document.getElementById('gridTitle').innerText.includes('MY LIST')) showMyList();
}

function showMyList() {
    window.scrollTo(0,0);
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = '❤️ My List';
    document.getElementById('loadMoreBtn').classList.add('hidden');
    renderCards(getMyList(), document.getElementById('gridResults'));
}

function saveToHistory(id, type, backdrop, poster, title) {
    let h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    h = h.filter(x => x.id !== id);
    h.unshift({id, type, backdrop_path: backdrop, poster_path: poster, title, progress: Math.floor(Math.random()*40)+30});
    localStorage.setItem('nbg_history', JSON.stringify(h.slice(0, 10)));
    renderHistory();
}
function renderHistory() {
    const h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    const sect = document.getElementById('historySection');
    if(h.length > 0 && sect) { sect.classList.remove('hidden'); renderCards(h, document.getElementById('rowHistory')); }
}
function clearHistory() { localStorage.removeItem('nbg_history'); document.getElementById('historySection').classList.add('hidden'); }
function closePlayer() { document.getElementById('playerContainer').classList.add('hidden'); document.getElementById('videoPlayer').src = ''; document.body.style.overflow = 'auto'; }
function goHome() { window.location.reload(); }

async function fetchAndRenderTrending(path, id) { const res = await fetch(`/api/movies?path=${path}`); const data = await res.json(); renderTrendingCards(data.results, document.getElementById(id)); }
async function fetchAndRender(path, id, isTV = false) { try { const res = await fetch(`/api/movies?path=${path.replace(/\?/g, '&')}`); const data = await res.json(); renderCards(data.results, document.getElementById(id), false, isTV); } catch(e){} }
async function fetchAndRenderActors(path, id) {
    const res = await fetch(`/api/movies?path=${path}`); const data = await res.json();
    const c = document.getElementById(id); if(!c) return; c.innerHTML = '';
    data.results?.slice(0, 12).forEach(a => { if(a.profile_path) {
            const dv = document.createElement('div'); dv.className="flex flex-col items-center flex-shrink-0 group";
            dv.innerHTML=`<img src="${IMG_PATH+a.profile_path}" class="actor-circle" onclick="loadActorFilms(${a.id},'${a.name.replace(/'/g,'')}')"><p class="text-[8px] text-center text-white/30 mt-3 font-black uppercase tracking-widest truncate w-20 transition">${a.name}</p>`;
            c.appendChild(dv);
    }});
}
async function fetchDetails(id, type) {
    const res = await fetch(`/api/movies?path=${type}/${id}/credits`); const data = await res.json();
    const cBox = document.getElementById('castContainer'); cBox.innerHTML = '';
    data.cast?.slice(0, 10).forEach(a => { if(a.profile_path) {
        const d = document.createElement('div'); d.className = "flex-shrink-0 text-center w-20 opacity-60 hover:opacity-100 transition cursor-pointer";
        d.onclick = () => { closePlayer(); loadActorFilms(a.id, a.name); };
        d.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="actor-circle mx-auto mb-3 shadow-lg border border-white/10"><p class="text-[8px] font-black uppercase tracking-tighter truncate w-full text-white">${a.name}</p>`;
        cBox.appendChild(d);
    }});
}
async function loadCategory(path, label) { window.scrollTo(0,0); document.getElementById('homeView').classList.add('hidden'); document.getElementById('heroSection').classList.add('hidden'); document.getElementById('gridSection').classList.remove('hidden'); document.getElementById('gridTitle').innerText = label; document.getElementById('loadMoreBtn').classList.remove('hidden'); currentPage = 1; currentPath = path; document.getElementById('gridResults').innerHTML = ''; renderSkeleton('gridResults'); const res = await fetch(`/api/movies?path=${path.replace(/\?/g, '&')}&page=${currentPage}`); const data = await res.json(); renderCards(data.results || [], document.getElementById('gridResults')); }
function setupSearch() { const i = document.getElementById('searchInput'); i.addEventListener('keypress', (e) => { if(e.key === 'Enter' && i.value) loadCategory(`search/multi?query=${encodeURIComponent(i.value)}`, `Hasil Pencarian: ${i.value}`); }); }
function setupDragToScroll() { document.querySelectorAll('.overflow-x-auto').forEach(s => { let d = false, sx, sl; s.addEventListener('mousedown', (e) => { d = true; sx = e.pageX - s.offsetLeft; sl = s.scrollLeft; s.classList.add('cursor-grabbing'); }); s.addEventListener('mouseleave', () => d = false); s.addEventListener('mouseup', () => d = false); s.addEventListener('mousemove', (e) => { if(!d) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; const w = (x - sx) * 2; s.scrollLeft = sl - w; }); }); }
function updateHero() {
    const m = featuredMovies[currentHeroIndex]; if(!m) return;
    const title = safeText(m.title || m.name);
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + m.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = title;
    document.getElementById('heroDesc').innerText = m.overview || '';
    document.getElementById('heroPlayBtn').onclick = () => playMovie(m.id, title, m.media_type, m.backdrop_path, m.poster_path);
    updateAmbient(m.backdrop_path);
    let dots = ''; featuredMovies.forEach((_, i) => dots += `<div class="w-1 h-5 rounded-full transition-all ${i===currentHeroIndex?'bg-blue-500 shadow-[0_0_10px_#3b82f6]':'bg-white/10'}"></div>`);
    if(document.getElementById('heroDots')) document.getElementById('heroDots').innerHTML = dots;
}
function startCarousel() { carouselTimer = setInterval(() => { currentHeroIndex = (currentHeroIndex+1)%featuredMovies.length; updateHero(); }, 8000); }
function shareMovie(t) { if(navigator.share) { navigator.share({ title: `Nonton ${t}`, text: `Streaming di Nobargasi!`, url: window.location.href }); } }
async function surpriseMe() { if(featuredMovies.length > 0) { const r = featuredMovies[Math.floor(Math.random()*featuredMovies.length)]; playMovie(r.id, safeText(r.title||r.name), r.media_type || 'movie', r.backdrop_path || '', r.poster_path || ''); } }
