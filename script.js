const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let currentPlayId = ''; let currentPlayType = '';

window.onload = () => { initApp(); setupScrollEffects(); setupDragToScroll(); setupSearch(); };

// --- AMBIENT BG ---
function updateAmbient(img) {
    const bg = document.getElementById('ambientBg');
    if(img && bg) bg.style.backgroundImage = `url('${BACK_PATH + img}')`;
}

function setupScrollEffects() {
    const header = document.getElementById('mainHeader');
    window.addEventListener('scroll', () => {
        const cur = window.pageYOffset;
        if(header) {
            header.style.opacity = cur > 100 ? "0.2" : "1";
            header.parentElement.style.transform = cur > 100 ? "translateY(-15px)" : "translateY(0)";
        }
    }, { passive: true });
}

// --- INIT ---
function initApp() {
    ['rowTrending', 'rowMarvel', 'rowDC', 'row1', 'row2', 'row3'].forEach(r => renderSkeleton(r));
    loadHeroBanner();
    fetchAndRenderTrending('trending/movie/day', 'rowTrending');
    fetchAndRenderActors('trending/person/week', 'rowActors');
    fetchAndRender('discover/movie?with_companies=420&sort_by=revenue.desc', 'rowMarvel'); 
    fetchAndRender('discover/movie?with_companies=429&sort_by=popularity.desc', 'rowDC'); 
    fetchAndRender('movie/popular', 'row1'); 
    fetchAndRender('tv/popular', 'row2', true); 
    fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'row3', true); 
    renderHistory();
}

async function loadHeroBanner() {
    try {
        const res = await fetch(`/api/movies?path=trending/all/day`); 
        const data = await res.json();
        if(data.results) { featuredMovies = data.results.slice(0, 8); updateHero(); startCarousel(); }
    } catch(e){}
}

function renderSkeleton(id) {
    const c = document.getElementById(id); if(!c) return; c.innerHTML = '';
    for(let i=0; i<8; i++) {
        const s = document.createElement('div'); s.className = "movie-card";
        s.innerHTML = `<div class="skeleton"></div>`;
        c.appendChild(s);
    }
}

// --- METADATA & PLAYER ---
async function playMovie(id, title, type, backdrop) {
    currentPlayId = id; currentPlayType = type;
    const player = document.getElementById('playerContainer');
    
    // Reset & Loading State
    document.getElementById('playingTitle').innerText = title;
    document.getElementById('playerOverview').innerText = "Memuat sinopsis...";
    document.getElementById('playerRating').innerText = "⭐ ...";
    
    // Controls
    document.getElementById('playerControls').innerHTML = `
        <button id="btn-VidSrc" onclick="changeServer('VidSrc')" class="px-8 py-3 rounded-full text-[10px] font-black uppercase bg-white text-black shadow-xl transition active:scale-95">Server 1</button>
        <button id="btn-AutoEmbed" onclick="changeServer('AutoEmbed')" class="px-8 py-3 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-30 transition">Server 2</button>
    `;
    
    changeServer('VidSrc');
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateAmbient(backdrop);

    // Fetch Details (Rating, Sinopsis, Durasi)
    try {
        const res = await fetch(`/api/movies?path=${type}/${id}`);
        const m = await res.json();
        document.getElementById('playerOverview').innerText = m.overview || 'Sinopsis tidak tersedia untuk film ini.';
        document.getElementById('playerRating').innerText = `⭐ ${m.vote_average.toFixed(1)}`;
        document.getElementById('playerYear').innerText = (m.release_date || m.first_air_date || '2024').split('-')[0];
        document.getElementById('playerRuntime').innerText = m.runtime ? `${m.runtime}m` : (m.episode_run_time ? `${m.episode_run_time[0]}m` : 'TV Series');
        
        saveToHistory(id, type, backdrop || m.backdrop_path, title);
    } catch(e){}

    fetchDetails(id, type);
}

function changeServer(s) {
    const f = document.getElementById('videoPlayer'); let url = '';
    if(s==='VidSrc') url = `https://vidsrc.me/embed/${currentPlayType}?tmdb=${currentPlayId}`;
    else url = `https://player.autoembed.app/embed/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    f.src = url;
    document.querySelectorAll('#playerControls button').forEach(b => b.classList.add('opacity-30'));
    document.getElementById('btn-'+s).classList.remove('opacity-30');
}

async function fetchDetails(id, type) {
    const res = await fetch(`/api/movies?path=${type}/${id}/credits`); const data = await res.json();
    const cBox = document.getElementById('castContainer'); cBox.innerHTML = '';
    data.cast?.slice(0, 10).forEach(a => {
        if(!a.profile_path) return;
        const d = document.createElement('div'); d.className = "flex-shrink-0 text-center w-20 opacity-40 hover:opacity-100 transition cursor-pointer";
        d.onclick = () => { closePlayer(); loadActorFilms(a.id, a.name); };
        d.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="actor-circle mx-auto mb-3 shadow-lg"><p class="text-[8px] font-black uppercase tracking-tighter truncate w-full">${a.name}</p>`;
        cBox.appendChild(d);
    });
    
    const simRes = await fetch(`/api/movies?path=${type}/${id}/recommendations`); const simData = await simRes.json();
    renderCards(simData.results?.slice(0, 10) || [], document.getElementById('similarContainer'), false, type === 'tv');
}

// --- RESUME LOGIC ---
function saveToHistory(id, type, backdrop, title) {
    let h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    h = h.filter(x => x.id !== id);
    // Random progress for UI feel
    const prog = Math.floor(Math.random() * 60) + 25; 
    h.unshift({id, type, backdrop_path: backdrop, title, progress: prog});
    localStorage.setItem('nbg_history', JSON.stringify(h.slice(0, 12)));
    renderHistory();
}

function renderHistory() {
    const h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    const sect = document.getElementById('historySection');
    if(h.length > 0 && sect) {
        sect.classList.remove('hidden');
        renderCards(h, document.getElementById('rowHistory'));
    }
}
function clearHistory() { localStorage.removeItem('nbg_history'); document.getElementById('historySection').classList.add('hidden'); }

// --- RENDERERS ---
function renderCards(movies, container, append = false, isTV = false) {
    if (!container) return; if (!append) container.innerHTML = '';
    movies.forEach(m => {
        if (!m.poster_path) return;
        const type = isTV ? 'tv' : (m.media_type || (m.title ? 'movie' : 'tv'));
        const title = (m.title||m.name||'').replace(/['"\\`]/g, '');
        const progHTML = m.progress ? `<div class="resume-bar"><div class="resume-progress" style="width: ${m.progress}%"></div></div>` : '';

        const card = document.createElement('div'); card.className = "movie-card";
        card.innerHTML = `<div class="poster-container" onclick="playMovie(${m.id}, '${title}', '${type}', '${m.backdrop_path || ''}')">
                <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                ${progHTML}
            </div>`;
        container.appendChild(card);
    });
}

function renderTrendingCards(movies, container) {
    if(!container) return; container.innerHTML = '';
    movies.slice(0, 10).forEach((m, i) => {
        const title = (m.title||m.name||'').replace(/['"\\`]/g, '');
        const wrapper = document.createElement('div'); wrapper.className = "flex items-end relative flex-shrink-0 mr-12";
        wrapper.innerHTML = `<div class="netflix-number">${i+1}</div>
            <div class="movie-card" onclick="playMovie(${m.id}, '${title}', '${m.media_type||'movie'}', '${m.backdrop_path}')">
                <div class="poster-container"><img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy"></div>
            </div>`;
        container.appendChild(wrapper);
    });
}

// --- UTILS ---
async function fetchAndRenderTrending(p, id) { const res = await fetch(`/api/movies?path=${p}`); const d = await res.json(); renderTrendingCards(d.results, document.getElementById(id)); }
async function fetchAndRender(p, id, isTV=false) { try { const res = await fetch(`/api/movies?path=${p.replace(/\?/g,'&')}`); const d = await res.json(); renderCards(d.results, document.getElementById(id), false, isTV); } catch(e){} }
async function fetchAndRenderActors(p, id) { const res = await fetch(`/api/movies?path=${p}`); const d = await res.json(); const c = document.getElementById(id); if(c) { c.innerHTML = ''; d.results?.slice(0,12).forEach(a => { if(a.profile_path) { const dv = document.createElement('div'); dv.className="flex-shrink-0 text-center"; dv.innerHTML=`<img src="${IMG_PATH+a.profile_path}" class="actor-circle mb-2" onclick="loadActorFilms(${a.id},'${a.name.replace(/'/g,'')}')"><p class="text-[7px] font-black opacity-30 uppercase">${a.name}</p>`; c.appendChild(dv); } }); } }

function closePlayer() { document.getElementById('playerContainer').classList.add('hidden'); document.getElementById('videoPlayer').src = ''; document.body.style.overflow = 'auto'; }
function goHome() { window.location.reload(); }
function updateHero() {
    const m = featuredMovies[currentHeroIndex]; if(!m) return;
    const title = (m.title||m.name||'').replace(/['"\\`]/g, '');
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + m.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = title;
    document.getElementById('heroDesc').innerText = m.overview || '';
    document.getElementById('heroPlayBtn').onclick = () => playMovie(m.id, title, m.media_type, m.backdrop_path);
    updateAmbient(m.backdrop_path);
    let dots = ''; featuredMovies.forEach((_, i) => dots += `<div class="w-1 h-5 rounded-full transition-all ${i===currentHeroIndex?'bg-white':'bg-white/10'}"></div>`);
    document.getElementById('heroDots').innerHTML = dots;
}
function startCarousel() { carouselTimer = setInterval(() => { currentHeroIndex = (currentHeroIndex+1)%featuredMovies.length; updateHero(); }, 9000); }
function setupSearch() { const i = document.getElementById('searchInput'); i.addEventListener('keypress', (e) => { if(e.key === 'Enter' && i.value) loadCategory(`search/multi?query=${encodeURIComponent(i.value)}`, `Result: ${i.value}`); }); }
function setupDragToScroll() { document.querySelectorAll('.overflow-x-auto').forEach(s => { let d = false, sx, sl; s.addEventListener('mousedown', (e) => { d = true; sx = e.pageX - s.offsetLeft; sl = s.scrollLeft; s.classList.add('cursor-grabbing'); }); s.addEventListener('mouseleave', () => d = false); s.addEventListener('mouseup', () => d = false); s.addEventListener('mousemove', (e) => { if(!d) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; const w = (x - sx) * 2; s.scrollLeft = sl - w; }); }); }
async function loadCategory(p, l) { window.scrollTo(0,0); document.getElementById('homeView').classList.add('hidden'); document.getElementById('heroSection').classList.add('hidden'); document.getElementById('gridSection').classList.remove('hidden'); document.getElementById('gridTitle').innerText = l; currentPage = 1; currentPath = p; const res = await fetch(`/api/movies?path=${p.replace(/\?/g,'&')}&page=${currentPage}`); const d = await res.json(); renderCards(d.results || [], document.getElementById('gridResults')); }
async function loadActorFilms(id, n) { document.getElementById('homeView').classList.add('hidden'); document.getElementById('heroSection').classList.add('hidden'); document.getElementById('gridSection').classList.remove('hidden'); document.getElementById('gridTitle').innerText = `${n} Movies`; currentPath = `discover/movie?with_cast=${id}&sort_by=popularity.desc`; const res = await fetch(`/api/movies?path=${currentPath.replace(/\?/g,'&')}`); const d = await res.json(); renderCards(d.results || [], document.getElementById('gridResults')); window.scrollTo({ top: 0, behavior: 'smooth' }); }
async function surpriseMe() { const r = featuredMovies[Math.floor(Math.random()*featuredMovies.length)]; playMovie(r.id, (r.title||r.name).replace(/'/g,""), r.media_type, r.backdrop_path); }
