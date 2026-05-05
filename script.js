const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let currentPlayId = ''; let currentPlayType = '';

window.onload = () => { initApp(); setupScrollEffects(); setupDragToScroll(); setupSearch(); startLiveNotif(); };

// --- FUNGSI SAPU BERSIH (PENCEGAH CRASH TANDA KUTIP) ---
function safeText(str) {
    if (!str) return 'Unknown';
    return str.replace(/['"\\`]/g, ''); // Membuang semua jenis tanda kutip
}

// --- AMBIENT BG ---
function updateAmbient(img) {
    const bg = document.getElementById('ambientBg');
    if(img && bg) bg.style.backgroundImage = `url('${BACK_PATH + img}')`;
}

function setupScrollEffects() {
    const header = document.getElementById('mainHeader');
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const cur = window.pageYOffset;
        if (cur > 100 && header) {
            header.style.opacity = cur > lastScroll ? "0.1" : "1";
            header.parentElement.style.transform = cur > lastScroll ? "translateY(-20px)" : "translateY(0)";
        } else if (header) {
            header.style.opacity = "1";
            header.parentElement.style.transform = "translateY(0)";
        }
        lastScroll = cur;
    }, { passive: true });
}

// --- INIT APP (EKSEKUSI INDEPENDEN ANTI DOMINO EFFECT) ---
function initApp() {
    // 1. Tampilkan semua skeleton loader dulu
    const rows = ['rowTrending', 'rowActors', 'rowMarvel', 'rowDC', 'rowPixar', 'rowDrakor', 'rowAnime', 'rowHoror', 'row1'];
    rows.forEach(r => renderSkeleton(r));

    // 2. Load Hero Section secara terpisah
    loadHeroBanner();

    // 3. Load setiap baris secara paralel dan mandiri
    fetchAndRenderTrending('trending/movie/day', 'rowTrending');
    fetchAndRenderActors('trending/person/week', 'rowActors');
    fetchAndRender('discover/movie?with_companies=420&sort_by=revenue.desc', 'rowMarvel'); 
    fetchAndRender('discover/movie?with_companies=429&sort_by=popularity.desc', 'rowDC'); 
    fetchAndRender('discover/movie?with_companies=3&sort_by=popularity.desc', 'rowPixar'); 
    fetchAndRender('discover/movie?with_genres=27', 'rowHoror'); 
    fetchAndRender('discover/tv?with_original_language=ko', 'rowDrakor', true); 
    fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'rowAnime', true); 
    fetchAndRender('movie/popular', 'row1'); 
    
    renderHistory();
}

async function loadHeroBanner() {
    try {
        const res = await fetch(`/api/movies?path=trending/all/day`); 
        const data = await res.json();
        if(data.results && data.results.length > 0) { 
            featuredMovies = data.results.slice(0, 8); 
            updateHero(); 
            startCarousel(); 
        }
    } catch(e) { console.error("Hero Banner Gagal:", e); }
}

function renderSkeleton(id) {
    const c = document.getElementById(id); if(!c) return; c.innerHTML = '';
    for(let i=0; i<8; i++) {
        const s = document.createElement('div'); s.className = "movie-card";
        s.innerHTML = `<div class="skeleton"></div>`;
        c.appendChild(s);
    }
}

async function fetchAndRenderActors(path, elementId) {
    try {
        const res = await fetch(`/api/movies?path=${path}`); 
        const data = await res.json();
        const container = document.getElementById(elementId); if(!container) return; container.innerHTML = '';
        
        data.results?.slice(0, 12).forEach(a => {
            if(!a.profile_path) return;
            const sName = safeText(a.name);
            const div = document.createElement('div'); div.className = "flex flex-col items-center flex-shrink-0 group";
            div.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="actor-circle" onclick="loadActorFilms(${a.id}, '${sName}')" loading="lazy">
                            <p class="text-[8px] text-center text-white/20 mt-4 font-black group-hover:text-white uppercase tracking-widest truncate w-20">${sName}</p>`;
            container.appendChild(div);
        });
    } catch(e) { console.error("Aktor Gagal:", e); }
}

async function fetchAndRenderTrending(path, elementId) {
    try {
        const res = await fetch(`/api/movies?path=${path}`); 
        const data = await res.json();
        const container = document.getElementById(elementId); if(!container) return; container.innerHTML = '';
        
        data.results?.slice(0, 10).forEach((m, i) => {
            if(!m.poster_path) return;
            const sTitle = safeText(m.title || m.name);
            const type = m.media_type || 'movie';
            const wrapper = document.createElement('div'); wrapper.className = "flex items-end relative flex-shrink-0 mr-12";
            wrapper.innerHTML = `<div class="netflix-number">${i+1}</div>
                <div class="movie-card" onclick="playMovie(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}')">
                    <div class="poster-container"><img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy"></div>
                </div>`;
            container.appendChild(wrapper);
        });
    } catch(e) { console.error("Trending Gagal:", e); }
}

async function fetchAndRender(path, elementId, isTV = false) {
    try {
        const cleanPath = path.replace(/\?/g, '&');
        const res = await fetch(`/api/movies?path=${cleanPath}`); 
        const data = await res.json();
        const container = document.getElementById(elementId); 
        
        if(data.results && container) {
            renderCards(data.results, container, false, isTV);
        } else if(container) {
            container.innerHTML = '<p class="text-[10px] text-white/30 px-4">Gagal memuat film.</p>';
        }
    } catch(e) { 
        console.error(`Gagal muat ${elementId}:`, e); 
        const c = document.getElementById(elementId);
        if(c) c.innerHTML = '<p class="text-[10px] text-red-500/50 px-4">Koneksi API Terputus.</p>';
    }
}

function renderCards(movies, container, append = false, isTV = false) {
    if (!container) return; if (!append) container.innerHTML = '';
    
    movies.forEach(m => {
        if (!m.poster_path) return;
        const type = isTV ? 'tv' : (m.media_type || (m.title ? 'movie' : 'tv'));
        const sTitle = safeText(m.title || m.name);
        const card = document.createElement('div'); card.className = "movie-card";
        
        card.innerHTML = `<div class="poster-container" onclick="playMovie(${m.id}, '${sTitle}', '${type}', '${m.backdrop_path || ''}')">
                <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-all duration-500"><div class="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">▶</div></div>
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
    document.querySelectorAll('.server-btn').forEach(b => b.className = "server-btn px-6 py-2 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-30");
    const active = document.getElementById('btn-'+s);
    if(active) active.className = "server-btn px-6 py-2 rounded-full text-[10px] font-black uppercase bg-white text-black shadow-xl";
}

async function playMovie(id, title, type, backdrop) {
    currentPlayId = id; currentPlayType = type;
    document.getElementById('playingTitle').innerText = title;
    document.getElementById('playerControls').innerHTML = `
        <button id="btn-VidSrc" onclick="changeServer('VidSrc')" class="server-btn px-6 py-2 rounded-full text-[10px] font-black uppercase bg-white text-black">Server 1</button>
        <button id="btn-AutoEmbed" onclick="changeServer('AutoEmbed')" class="server-btn px-6 py-2 rounded-full text-[10px] font-black uppercase border border-white/10 opacity-30">Server 2</button>
        <button onclick="shareMovie('${title}')" class="px-6 py-2 rounded-full text-[10px] font-black uppercase glass-panel border border-white/10 hover:bg-white hover:text-black transition">Share</button>`;
    
    changeServer('VidSrc');
    document.getElementById('playerContainer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    fetchDetails(id, type);
}

async function fetchDetails(id, type) {
    try {
        const res = await fetch(`/api/movies?path=${type}/${id}/credits`); const data = await res.json();
        const cBox = document.getElementById('castContainer'); cBox.innerHTML = '';
        data.cast?.slice(0, 8).forEach(a => {
            if(!a.profile_path) return;
            const sName = safeText(a.name);
            const d = document.createElement('div'); d.className = "flex-shrink-0 text-center w-16 opacity-30 hover:opacity-100 cursor-pointer transition hover:scale-110";
            d.onclick = () => { closePlayer(); loadActorFilms(a.id, sName); };
            d.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="w-10 h-10 rounded-full object-cover mx-auto"><p class="text-[7px] mt-2 truncate font-bold uppercase tracking-widest">${sName}</p>`;
            cBox.appendChild(d);
        });
    } catch(e) { console.log("Gagal muat aktor"); }

    try {
        const sim = await fetch(`/api/movies?path=${type}/${id}/recommendations`); const sData = await sim.json();
        renderCards(sData.results?.slice(0, 10) || [], document.getElementById('similarContainer'), false, type === 'tv');
    } catch(e) { console.log("Gagal muat rekomendasi"); }
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
    
    document.getElementById('gridResults').innerHTML = '';
    renderSkeleton('gridResults', 15);
    
    try {
        const cleanPath = path.replace(/\?/g, '&');
        const res = await fetch(`/api/movies?path=${cleanPath}&page=${currentPage}`); 
        const data = await res.json();
        renderCards(data.results || [], document.getElementById('gridResults'));
    } catch(e) { document.getElementById('gridResults').innerHTML = '<p>Gagal memuat kategori.</p>'; }
}

async function loadMore() {
    currentPage++;
    try {
        const cleanPath = currentPath.replace(/\?/g, '&');
        const res = await fetch(`/api/movies?path=${cleanPath}&page=${currentPage}`); 
        const data = await res.json();
        renderCards(data.results || [], document.getElementById('gridResults'), true);
    } catch(e) { console.log("Load more gagal"); }
}

async function loadActorFilms(actorId, actorName) {
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = `${actorName} Movies`;
    currentPage = 1; currentPath = `discover/movie?with_cast=${actorId}&sort_by=popularity.desc`;
    
    document.getElementById('gridResults').innerHTML = '';
    renderSkeleton('gridResults', 15);
    
    try {
        const res = await fetch(`/api/movies?path=${currentPath.replace(/\?/g, '&')}&page=${currentPage}`); 
        const data = await res.json();
        renderCards(data.results || [], document.getElementById('gridResults'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(e){}
}

function goHome() { window.location.reload(); }

function setupSearch() {
    const input = document.getElementById('searchInput');
    if(!input) return;
    input.addEventListener('keypress', (e) => { 
        if(e.key === 'Enter' && input.value) {
            loadCategory(`search/multi?query=${encodeURIComponent(input.value)}`, `Result: ${input.value}`); 
        }
    });
}

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
    const sTitle = safeText(m.title || m.name);
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + m.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = sTitle;
    document.getElementById('heroDesc').innerText = m.overview || '';
    document.getElementById('heroPlayBtn').onclick = () => playMovie(m.id, sTitle, m.media_type || 'movie', m.backdrop_path || '');
    updateAmbient(m.backdrop_path);
    
    let dots = ''; 
    featuredMovies.forEach((_, i) => dots += `<div class="w-1 h-5 rounded-full transition-all ${i===currentHeroIndex?'bg-white':'bg-white/10'}"></div>`);
    const dotContainer = document.getElementById('heroDots');
    if(dotContainer) dotContainer.innerHTML = dots;
}

function startCarousel() { 
    clearInterval(carouselTimer);
    carouselTimer = setInterval(() => { 
        currentHeroIndex = (currentHeroIndex+1) % featuredMovies.length; 
        updateHero(); 
    }, 9000); 
}

function shareMovie(t) { 
    if(navigator.share) {
        navigator.share({ title: `Nonton ${t}`, text: `Streaming gratis di Nobargasi!`, url: window.location.href }).catch(()=>{}); 
    } else {
        alert("Link disalin! Silakan paste ke temanmu.");
    }
}

async function surpriseMe() { 
    if(featuredMovies.length === 0) return;
    const r = featuredMovies[Math.floor(Math.random()*featuredMovies.length)]; 
    playMovie(r.id, safeText(r.title||r.name), r.media_type || 'movie', r.backdrop_path || ''); 
}

// THEME
function changeTheme(color) {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-glow', color + '44');
    const logo = document.getElementById('logoAccent');
    if(logo) logo.style.color = color;
    localStorage.setItem('nbg_theme', color);
}

// MOOD
function loadMood(mood) {
    let p = 'discover/movie?sort_by=popularity.desc'; let l = '';
    if(mood==='galau'){ p+='&with_genres=18,10749'; l="Mood: Galau & Romantis 🥺"; }
    else if(mood==='action'){ p+='&with_genres=28,12'; l="Mood: Adrenalin Tinggi 💥"; }
    else if(mood==='ngakak'){ p+='&with_genres=35'; l="Mood: Tertawa Lepas 😂"; }
    else if(mood==='serem'){ p+='&with_genres=27,53'; l="Mood: Mencekam & Seru 👻"; }
    loadCategory(p, l);
}

// LIVE NOTIF
function startLiveNotif() {
    const names = ["Andi", "Siska", "Budi", "Erren", "Dewi", "Reza", "Putri", "Iwan", "Doni", "Lestari", "Gasi"];
    const verbs = ["baru saja menonton", "memberi ⭐5 pada", "menyukai", "sedang maraton"];
    
    setInterval(() => {
        if(featuredMovies.length === 0) return;
        const randomMovie = featuredMovies[Math.floor(Math.random() * featuredMovies.length)];
        const notif = document.getElementById('liveNotif');
        if(!notif) return;
        
        document.getElementById('notifImg').style.backgroundImage = `url('${IMG_PATH + randomMovie.poster_path}')`;
        document.getElementById('notifUser').innerText = `${names[Math.floor(Math.random()*names.length)]} di Kepanjen`;
        document.getElementById('notifText').innerText = `${verbs[Math.floor(Math.random()*verbs.length)]} ${safeText(randomMovie.title || randomMovie.name)}`;
        
        notif.classList.add('show');
        setTimeout(() => notif.classList.remove('show'), 6000);
    }, 30000);
}

// HISTORY (GAK BIKIN CRASH KALAU KOSONG)
function renderHistory() {
    const h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    const histSection = document.getElementById('historySection');
    if(h.length > 0 && histSection) { 
        histSection.classList.remove('hidden'); 
        renderCards(h, document.getElementById('rowHistory')); 
    }
}

function clearHistory() { 
    localStorage.removeItem('nbg_history'); 
    const histSection = document.getElementById('historySection');
    if(histSection) histSection.classList.add('hidden'); 
}
