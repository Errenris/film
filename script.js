const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let currentPlayId = ''; let currentPlayType = '';

window.onload = () => { initApp(); setupScrollHide(); setupHeroSwipe(); setupDragToScroll(); startLiveNotif(); };

// --- FITUR 4: THEME CHANGER ---
function changeTheme(color) {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-glow', color + '44');
    document.getElementById('logoAccent').style.color = color;
    localStorage.setItem('nbg_theme', color);
}

// --- FITUR 2: SOCIAL PROOF NOTIF (FAKE LIVE) ---
function startLiveNotif() {
    const names = ["Andi", "Siska", "Budi", "Erren", "Dewi", "Reza", "Putri", "Iwan", "Doni", "Lestari"];
    const cities = ["Jakarta", "Surabaya", "Malang", "Medan", "Bandung", "Jogja", "Bali"];
    const verbs = ["baru saja menonton", "sedang maraton", "menyukai film", "memberi rating ⭐5 pada"];
    
    setInterval(async () => {
        if(featuredMovies.length === 0) return;
        const randomMovie = featuredMovies[Math.floor(Math.random() * featuredMovies.length)];
        const notif = document.getElementById('liveNotif');
        
        document.getElementById('notifImg').style.backgroundImage = `url('${IMG_PATH + randomMovie.poster_path}')`;
        document.getElementById('notifUser').innerText = `${names[Math.floor(Math.random()*names.length)]} di ${cities[Math.floor(Math.random()*cities.length)]}`;
        document.getElementById('notifText').innerText = `${verbs[Math.floor(Math.random()*verbs.length)]} ${randomMovie.title || randomMovie.name}`;
        
        notif.classList.add('show');
        setTimeout(() => notif.classList.remove('show'), 6000);
    }, 45000); // Muncul tiap 45 detik
}

// --- FITUR 1: MOOD FILTER ---
function loadMood(mood) {
    let path = 'discover/movie?sort_by=popularity.desc';
    let label = '';
    if(mood === 'galau') { path += '&with_genres=18,10749'; label = "Lagi Galau & Butuh Pelukan 🥺"; }
    else if(mood === 'action') { path += '&with_genres=28,12'; label = "Aksi Full Adrenalin 💥"; }
    else if(mood === 'ngakak') { path += '&with_genres=35'; label = "Siap-siap Sakit Perut 😂"; }
    else if(mood === 'serem') { path += '&with_genres=27,53'; label = "Jangan Nonton Sendirian 👻"; }
    else if(mood === 'mikir') { path += '&with_genres=878,9648'; label = "Bikin Otak Meledak 🧠"; }
    
    loadCategory(path, label, 'movies');
}

// --- LOGIKA UTAMA ---
async function initApp() {
    // Load saved theme
    const savedTheme = localStorage.getItem('nbg_theme');
    if(savedTheme) changeTheme(savedTheme);

    try {
        const res = await fetch(`/api/movies?path=trending/all/day`); const data = await res.json();
        if(data.results) { featuredMovies = data.results.slice(0, 10); updateHero(); startCarousel(); }
        renderHistory();
        
        const rows = ['rowTrending', 'rowActors', 'rowMarvel', 'rowPixar', 'row1', 'row3'];
        rows.forEach(r => renderSkeleton(r));
        
        fetchAndRenderActors('trending/person/week', 'rowActors');
        fetchAndRenderTrending('trending/movie/day', 'rowTrending');
        fetchAndRender('discover/movie?with_companies=420&sort_by=revenue.desc', 'rowMarvel'); 
        fetchAndRender('discover/movie?with_companies=3&sort_by=popularity.desc', 'rowPixar'); 
        fetchAndRender('movie/popular', 'row1'); 
        fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'row3'); 
    } catch(e) {}
}

// --- RENDERER ---
function renderSkeleton(id) {
    const c = document.getElementById(id); if(!c) return; c.innerHTML = '';
    for(let i=0; i<8; i++) {
        const s = document.createElement('div'); s.className = "movie-card";
        s.innerHTML = `<div class="skeleton"></div><div class="h-3 w-3/4 bg-white/10 rounded mt-3 mx-auto"></div>`;
        c.appendChild(s);
    }
}

async function fetchAndRenderActors(path, elementId) {
    const res = await fetch(`/api/movies?path=${path}`); const data = await res.json();
    const container = document.getElementById(elementId); container.innerHTML = '';
    data.results.slice(0, 12).forEach(actor => {
        if(!actor.profile_path) return;
        const el = document.createElement('div'); el.className = "flex flex-col items-center flex-shrink-0 group";
        el.innerHTML = `<img src="${IMG_PATH + actor.profile_path}" class="actor-circle" onclick="loadActorFilms(${actor.id}, '${actor.name}')" loading="lazy">
                        <p class="text-[10px] text-center text-white/60 mt-3 font-bold group-hover:text-blue-400 w-20 truncate">${actor.name}</p>`;
        container.appendChild(el);
    });
}

function renderTrendingCards(movies, container) {
    container.innerHTML = '';
    movies.slice(0, 10).forEach((movie, i) => {
        const type = movie.media_type || 'movie';
        const wrapper = document.createElement('div'); wrapper.className = "trending-wrapper";
        wrapper.innerHTML = `<div class="netflix-number">${i+1}</div>
            <div class="movie-card" onclick="playMovie(${movie.id}, '${(movie.title || movie.name).replace(/'/g, "\\'")}', '${type}', '${movie.backdrop_path}')">
                <div class="poster-container"><img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy"></div>
                <div class="mt-3 text-center"><h3 class="text-[11px] font-bold truncate">${movie.title || movie.name}</h3></div>
            </div>`;
        container.appendChild(wrapper);
    });
}

async function fetchAndRender(path, elementId) {
    const res = await fetch(`/api/movies?path=${path.replace('?', '&')}`); const data = await res.json();
    const container = document.getElementById(elementId); if(data.results) renderCards(data.results, container);
}

function renderCards(movies, container, append = false) {
    if (!append) container.innerHTML = '';
    movies.forEach(movie => {
        if (!movie.poster_path) return;
        const type = movie.media_type || (movie.title ? 'movie' : 'tv');
        const prog = movie.progress || 0;
        const progHTML = prog ? `<div class="absolute bottom-0 left-0 w-full h-1 bg-black/50"><div class="h-full bg-blue-500" style="width: ${prog}%"></div></div>` : '';

        const card = document.createElement('div'); card.className = "movie-card";
        card.innerHTML = `<div class="poster-container" onclick="playMovie(${movie.id}, '${(movie.title || movie.name).replace(/'/g, "\\'")}', '${type}', '${movie.backdrop_path}')">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy">
                ${progHTML}
            </div>
            <div class="mt-2 px-1 text-center"><h3 class="text-[11px] font-bold truncate opacity-80">${movie.title || movie.name}</h3></div>`;
        container.appendChild(card);
    });
}

// --- PLAYER LOGIC ---
function changeServer(server) {
    const frame = document.getElementById('videoPlayer');
    let url = '';
    if(server === 'VidSrc') url = `https://vidsrc.me/embed/${currentPlayType}?tmdb=${currentPlayId}`;
    else if(server === 'AutoEmbed') url = `https://player.autoembed.app/embed/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    else url = `https://vidlink.pro/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    
    frame.src = url;
    document.querySelectorAll('.server-btn').forEach(b => b.className = "server-btn px-4 py-1.5 rounded-full text-[10px] font-bold glass-btn opacity-50");
    document.getElementById('btn-'+server).className = "server-btn px-4 py-1.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-lg";
}

async function playMovie(id, title, type, backdrop) {
    currentPlayId = id; currentPlayType = type;
    const player = document.getElementById('playerContainer');
    document.getElementById('playingTitle').innerText = title;
    document.getElementById('playerBg').style.backgroundImage = `url('${BACK_PATH + backdrop}')`;
    
    document.getElementById('playerControls').innerHTML = `
        <button id="btn-VidSrc" onclick="changeServer('VidSrc')" class="server-btn px-4 py-1.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">Utama</button>
        <button id="btn-AutoEmbed" onclick="changeServer('AutoEmbed')" class="server-btn px-4 py-1.5 rounded-full text-[10px] font-bold glass-btn opacity-50">Server 2</button>
        <button onclick="shareMovie('${title}')" class="glass-btn px-4 py-1.5 rounded-full text-[10px] font-bold">📤 Share</button>
    `;
    
    changeServer('VidSrc');
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    saveToHistory(id, type, backdrop, title);
    
    // Cast & Similar
    fetchAndRenderDetail(id, type);
}

async function fetchAndRenderDetail(id, type) {
    const cred = await fetch(`/api/movies?path=${type}/${id}/credits`); const cData = await cred.json();
    const castBox = document.getElementById('castContainer'); castBox.innerHTML = '';
    cData.cast?.slice(0, 10).forEach(a => {
        if(!a.profile_path) return;
        const div = document.createElement('div'); div.className = "flex-shrink-0 text-center w-16";
        div.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="w-12 h-12 rounded-full object-cover mx-auto"><p class="text-[9px] mt-2 truncate font-bold">${a.name}</p>`;
        castBox.appendChild(div);
    });

    const sim = await fetch(`/api/movies?path=${type}/${id}/recommendations`); const sData = await sim.json();
    renderCards(sData.results?.slice(0, 10) || [], document.getElementById('similarContainer'));
}

// --- UTILS ---
function closePlayer() { document.getElementById('playerContainer').classList.add('hidden'); document.getElementById('videoPlayer').src = ''; document.body.style.overflow = 'auto'; }
function goHome() { location.hash = ''; location.reload(); }

function saveToHistory(id, type, backdrop, title) {
    let hist = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    hist = hist.filter(x => x.id !== id);
    hist.unshift({id, type, backdrop_path: backdrop, title, progress: Math.floor(Math.random()*60)+20});
    localStorage.setItem('nbg_history', JSON.stringify(hist.slice(0, 15)));
    renderHistory();
}
function renderHistory() {
    const hist = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    if(hist.length > 0) { document.getElementById('historySection').classList.remove('hidden'); renderCards(hist, document.getElementById('rowHistory')); }
}
function clearHistory() { localStorage.removeItem('nbg_history'); document.getElementById('historySection').classList.add('hidden'); }

function shareMovie(t) { navigator.share({ title: `Nonton ${t}`, text: `Streaming ${t} gratis di Nobargasi!`, url: window.location.href }); }

function setupDragToScroll() {
    const sliders = document.querySelectorAll('.overflow-x-auto');
    sliders.forEach(slider => {
        let isDown = false; let startX; let scrollLeft;
        slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
        slider.addEventListener('mouseleave', () => isDown = false);
        slider.addEventListener('mouseup', () => isDown = false);
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return; e.preventDefault();
            const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2;
            requestAnimationFrame(() => slider.scrollLeft = scrollLeft - walk);
        });
    });
}

// --- HERO LOGIC ---
function updateHero() {
    const m = featuredMovies[currentHeroIndex];
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + m.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = m.title || m.name;
    document.getElementById('heroDesc').innerText = m.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(m.id, m.title || m.name, m.media_type, m.backdrop_path);
    let dots = ''; featuredMovies.forEach((_, i) => dots += `<div class="h-1.5 rounded-full transition-all ${i===currentHeroIndex?'w-8 bg-blue-500':'w-2 bg-white/20'}"></div>`);
    document.getElementById('heroDots').innerHTML = dots;
}
function startCarousel() { carouselTimer = setInterval(() => { currentHeroIndex = (currentHeroIndex+1)%featuredMovies.length; updateHero(); }, 8000); }
