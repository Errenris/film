const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let currentPlayId = ''; let currentPlayType = '';

window.onload = () => { initApp(); setupScrollEffects(); setupDragToScroll(); startLiveNotif(); };

// --- AMBIENT BG ENGINE ---
function updateAmbient(img) {
    const bg = document.getElementById('ambientBg');
    bg.style.backgroundImage = `url('${BACK_PATH + img}')`;
}

// --- ZEN SCROLL EFFECTS (Auto-Hide UI) ---
function setupScrollEffects() {
    const header = document.getElementById('mainHeader');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        // Fade header on scroll down
        if (currentScroll > 100) {
            header.style.opacity = currentScroll > lastScroll ? "0.1" : "1";
            header.style.transform = currentScroll > lastScroll ? "translateY(-10px) scale(0.95)" : "translateY(0) scale(1)";
        } else {
            header.style.opacity = "1";
            header.style.transform = "translateY(0) scale(1)";
        }
        lastScroll = currentScroll;
    }, { passive: true });
}

// --- FAKE LIVE NOTIF (MINIMAL) ---
function startLiveNotif() {
    const names = ["Andi", "Erren", "Doni", "Siska", "Budi", "Gasi"];
    const verbs = ["watching", "liked", "rated ⭐5", "is rewatching"];
    
    setInterval(() => {
        if(featuredMovies.length === 0) return;
        const m = featuredMovies[Math.floor(Math.random() * featuredMovies.length)];
        const n = document.getElementById('liveNotif');
        document.getElementById('notifImg').style.backgroundImage = `url('${IMG_PATH + m.poster_path}')`;
        document.getElementById('notifText').innerText = `${names[Math.floor(Math.random()*names.length)]} ${verbs[Math.floor(Math.random()*verbs.length)]} ${m.title || m.name}`;
        n.classList.add('show');
        setTimeout(() => n.classList.remove('show'), 5000);
    }, 45000);
}

// --- INIT APP ---
async function initApp() {
    try {
        const res = await fetch(`/api/movies?path=trending/all/day`); const data = await res.json();
        if(data.results) { featuredMovies = data.results.slice(0, 8); updateHero(); startCarousel(); }
        renderHistory();
        
        fetchAndRenderActors('trending/person/week', 'rowActors');
        fetchAndRenderTrending('trending/movie/day', 'rowTrending');
        fetchAndRender('discover/movie?with_companies=420&sort_by=revenue.desc', 'rowMarvel'); 
        fetchAndRender('discover/movie?with_companies=429&sort_by=popularity.desc', 'rowDC'); 
        fetchAndRender('discover/movie?with_companies=3&sort_by=popularity.desc', 'rowPixar'); 
        fetchAndRender('movie/popular', 'row1'); 
        fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'row3', true); 
    } catch(e) {}
}

async function fetchAndRenderActors(path, elementId) {
    const res = await fetch(`/api/movies?path=${path}`); const data = await res.json();
    const container = document.getElementById(elementId); container.innerHTML = '';
    data.results.slice(0, 10).forEach(a => {
        if(!a.profile_path) return;
        const div = document.createElement('div'); div.className = "flex flex-col items-center flex-shrink-0 group";
        div.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="actor-circle" onclick="loadActorFilms(${a.id}, '${a.name}')" loading="lazy">
                        <p class="text-[9px] text-center text-white/20 mt-3 font-bold group-hover:text-white uppercase tracking-widest">${a.name}</p>`;
        container.appendChild(div);
    });
}

function renderTrendingCards(movies, container) {
    container.innerHTML = '';
    movies.slice(0, 10).forEach((m, i) => {
        const safeTitle = (m.title||m.name||'').replace(/'/g, "\\'");
        const wrapper = document.createElement('div'); wrapper.className = "flex items-end relative flex-shrink-0 mr-12";
        wrapper.innerHTML = `<div class="netflix-number">${i+1}</div>
            <div class="movie-card" onclick="playMovie(${m.id}, '${safeTitle}', '${m.media_type||'movie'}', '${m.backdrop_path}')">
                <div class="poster-container"><img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy"></div>
            </div>`;
        container.appendChild(wrapper);
    });
}

async function fetchAndRender(path, elementId, isTV = false) {
    const res = await fetch(`/api/movies?path=${path.replace('?', '&')}`); const data = await res.json();
    const container = document.getElementById(elementId); if(data.results) renderCards(data.results, container, false, isTV);
}

function renderCards(movies, container, append = false, isTV = false) {
    if (!container) return; if (!append) container.innerHTML = '';
    movies.forEach(m => {
        if (!m.poster_path) return;
        const type = m.media_type || (isTV ? 'tv' : (m.title ? 'movie' : 'tv'));
        const safeTitle = (m.title||m.name||'').replace(/'/g, "\\'");
        const prog = m.progress || 0;
        const progHTML = prog ? `<div class="absolute bottom-0 left-0 w-full h-0.5 bg-white/10"><div class="h-full bg-white/60" style="width: ${prog}%"></div></div>` : '';

        const card = document.createElement('div'); card.className = "movie-card";
        card.innerHTML = `<div class="poster-container" onclick="playMovie(${m.id}, '${safeTitle}', '${type}', '${m.backdrop_path}')">
                <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                ${progHTML}
            </div>`;
        container.appendChild(card);
    });
}

// --- PLAYER ---
function changeServer(s) {
    const f = document.getElementById('videoPlayer'); let url = '';
    if(s==='VidSrc') url = `https://vidsrc.me/embed/${currentPlayType}?tmdb=${currentPlayId}`;
    else if(s==='AutoEmbed') url = `https://player.autoembed.app/embed/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    else url = `https://vidlink.pro/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    f.src = url;
    document.querySelectorAll('.server-btn').forEach(b => b.classList.add('opacity-30'));
    document.getElementById('btn-'+s).classList.remove('opacity-30');
}

async function playMovie(id, title, type, backdrop) {
    currentPlayId = id; currentPlayType = type;
    document.getElementById('playingTitle').innerText = title;
    document.getElementById('playerControls').innerHTML = `
        <button id="btn-VidSrc" onclick="changeServer('VidSrc')" class="server-btn px-6 py-2 rounded-full text-[10px] font-black uppercase bg-white text-black">Server 1</button>
        <button id="btn-AutoEmbed" onclick="changeServer('AutoEmbed')" class="server-btn px-6 py-2 rounded-full text-[10px] font-black uppercase border border-white/20 opacity-30">Server 2</button>`;
    changeServer('VidSrc');
    document.getElementById('playerContainer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    saveToHistory(id, type, backdrop, title);
    fetchDetails(id, type);
}

async function fetchDetails(id, type) {
    const res = await fetch(`/api/movies?path=${type}/${id}/credits`); const data = await res.json();
    const cBox = document.getElementById('castContainer'); cBox.innerHTML = '';
    data.cast?.slice(0, 8).forEach(a => {
        if(!a.profile_path) return;
        const d = document.createElement('div'); d.className = "flex-shrink-0 text-center w-16 opacity-40 hover:opacity-100 transition";
        d.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="w-10 h-10 rounded-full object-cover mx-auto"><p class="text-[8px] mt-2 truncate font-bold uppercase tracking-widest">${a.name}</p>`;
        cBox.appendChild(d);
    });
}

function closePlayer() { document.getElementById('playerContainer').classList.add('hidden'); document.getElementById('videoPlayer').src = ''; document.body.style.overflow = 'auto'; }

// --- NAV & SEARCH ---
async function loadCategory(path, label) {
    window.scrollTo(0,0);
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = label;
    currentPage = 1; currentPath = path;
    const res = await fetch(`/api/movies?path=${path.replace('?', '&')}&page=${currentPage}`); const data = await res.json();
    renderCards(data.results || [], document.getElementById('gridResults'));
}
function goHome() { window.location.reload(); }

// --- UTILS ---
function saveToHistory(id, type, backdrop, title) {
    let h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    h = h.filter(x => x.id !== id);
    h.unshift({id, type, backdrop_path: backdrop, title, progress: 45});
    localStorage.setItem('nbg_history', JSON.stringify(h.slice(0, 10)));
    renderHistory();
}
function renderHistory() {
    const h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    if(h.length > 0) { document.getElementById('historySection').classList.remove('hidden'); renderCards(h, document.getElementById('rowHistory')); }
}
function clearHistory() { localStorage.removeItem('nbg_history'); document.getElementById('historySection').classList.add('hidden'); }

function setupDragToScroll() {
    const s = document.querySelectorAll('.overflow-x-auto');
    s.forEach(slider => {
        let isDown = false; let startX; let scrollLeft;
        slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; slider.classList.add('cursor-grabbing'); });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('cursor-grabbing'); });
        slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('cursor-grabbing'); });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return; e.preventDefault();
            const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    });
}

function updateHero() {
    const m = featuredMovies[currentHeroIndex]; if(!m) return;
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + m.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = m.title || m.name;
    document.getElementById('heroDesc').innerText = m.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(m.id, (m.title||m.name).replace(/'/g, "\\'"), m.media_type, m.backdrop_path);
    updateAmbient(m.backdrop_path);
    let dots = ''; featuredMovies.forEach((_, i) => dots += `<div class="w-1 h-6 rounded-full transition-all ${i===currentHeroIndex?'bg-white':'bg-white/10'}"></div>`);
    document.getElementById('heroDots').innerHTML = dots;
}
function startCarousel() { carouselTimer = setInterval(() => { currentHeroIndex = (currentHeroIndex+1)%featuredMovies.length; updateHero(); }, 8000); }
