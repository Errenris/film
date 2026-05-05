const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let currentPlayId = ''; let currentPlayType = '';

window.onload = () => { initApp(); setupScrollHide(); setupDragToScroll(); startLiveNotif(); };

// THEME
function changeTheme(color) {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-glow', color + '44');
    document.getElementById('logoAccent').style.color = color;
    localStorage.setItem('nbg_theme', color);
}

// LIVE NOTIF
function startLiveNotif() {
    const names = ["Andi", "Siska", "Budi", "Erren", "Dewi", "Reza", "Putri", "Iwan", "Doni", "Lestari", "Gasi"];
    const cities = ["Malang", "Jakarta", "Surabaya", "Bandung", "Medan", "Bali", "Kepanjen"];
    const verbs = ["baru saja menonton", "memberi ⭐5 pada", "menyukai", "sedang maraton"];
    
    setInterval(() => {
        if(featuredMovies.length === 0) return;
        const randomMovie = featuredMovies[Math.floor(Math.random() * featuredMovies.length)];
        const notif = document.getElementById('liveNotif');
        document.getElementById('notifImg').style.backgroundImage = `url('${IMG_PATH + randomMovie.poster_path}')`;
        document.getElementById('notifUser').innerText = `${names[Math.floor(Math.random()*names.length)]} di ${cities[Math.floor(Math.random()*cities.length)]}`;
        document.getElementById('notifText').innerText = `${verbs[Math.floor(Math.random()*verbs.length)]} ${randomMovie.title || randomMovie.name}`;
        notif.classList.add('show');
        setTimeout(() => notif.classList.remove('show'), 6000);
    }, 40000);
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

async function initApp() {
    const saved = localStorage.getItem('nbg_theme'); if(saved) changeTheme(saved);
    try {
        const res = await fetch(`/api/movies?path=trending/all/day`); const data = await res.json();
        if(data.results) { featuredMovies = data.results.slice(0, 10); updateHero(); startCarousel(); }
        renderHistory();
        
        // Loader untuk semua rows biar UI gak kosong pas nunggu
        const rows = ['rowTrending', 'rowActors', 'rowMarvel', 'rowDC', 'rowDisney', 'rowPixar', 'row2', 'row3', 'row4'];
        rows.forEach(r => renderSkeleton(r));
        
        // Fetch Parallel
        fetchAndRenderActors('trending/person/week', 'rowActors');
        fetchAndRenderTrending('trending/movie/day', 'rowTrending');
        fetchAndRender('discover/movie?with_companies=420&sort_by=revenue.desc', 'rowMarvel'); 
        fetchAndRender('discover/movie?with_companies=429&sort_by=popularity.desc', 'rowDC'); 
        fetchAndRender('discover/movie?with_companies=2&sort_by=popularity.desc', 'rowDisney'); 
        fetchAndRender('discover/movie?with_companies=3&sort_by=popularity.desc', 'rowPixar'); 
        fetchAndRender('tv/popular', 'row2', true);
        fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'row3', true); 
        fetchAndRender('discover/tv?with_original_language=ko', 'row4', true);
    } catch(e) { console.error("Error App:", e); }
}

function renderSkeleton(id, count = 10) {
    const c = document.getElementById(id); if(!c) return; c.innerHTML = '';
    for(let i=0; i<count; i++) {
        const s = document.createElement('div'); s.className = "movie-card";
        s.innerHTML = `<div class="skeleton"></div><div class="h-3 w-3/4 bg-white/10 rounded mt-3 mx-auto animate-pulse"></div>`;
        c.appendChild(s);
    }
}

async function fetchAndRenderActors(path, elementId) {
    try {
        const res = await fetch(`/api/movies?path=${path}`); const data = await res.json();
        const container = document.getElementById(elementId); if(!container) return; container.innerHTML = '';
        if(data.results) {
            data.results.slice(0, 12).forEach(a => {
                if(!a.profile_path) return;
                const safeName = a.name ? a.name.replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';
                const div = document.createElement('div'); div.className = "flex flex-col items-center flex-shrink-0 group";
                div.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="actor-circle" onclick="loadActorFilms(${a.id}, '${safeName}')" loading="lazy">
                                <p class="text-[9px] md:text-xs text-center text-white/50 mt-3 font-bold group-hover:text-blue-400 w-20 truncate">${a.name}</p>`;
                container.appendChild(div);
            });
        }
    } catch(e) {}
}

async function fetchAndRenderTrending(path, elementId) {
    try {
        const res = await fetch(`/api/movies?path=${path}`); const data = await res.json();
        const container = document.getElementById(elementId); if(data.results && container) renderTrendingCards(data.results, container);
    } catch(e) {}
}

function renderTrendingCards(movies, container) {
    container.innerHTML = '';
    movies.slice(0, 10).forEach((m, i) => {
        if(!m.poster_path) return;
        const type = m.media_type || 'movie';
        const rawTitle = m.title || m.name || 'Unknown';
        const safeTitle = rawTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safeBackdrop = m.backdrop_path ? m.backdrop_path : '';
        
        const wrapper = document.createElement('div'); wrapper.className = "trending-wrapper";
        wrapper.innerHTML = `<div class="netflix-number">${i+1}</div>
            <div class="movie-card" onclick="playMovie(${m.id}, '${safeTitle}', '${type}', '${safeBackdrop}')">
                <div class="poster-container"><img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy"></div>
                <div class="mt-3 px-1 text-center"><h3 class="text-[10px] font-bold truncate opacity-60 uppercase tracking-widest">${rawTitle}</h3></div>
            </div>`;
        container.appendChild(wrapper);
    });
}

async function fetchAndRender(path, elementId, isTV = false) {
    try {
        // Safe Fetch Call
        const res = await fetch(`/api/movies?path=${path.replace('?', '&')}`); const data = await res.json();
        const container = document.getElementById(elementId); 
        if(data.results && container) {
            renderCards(data.results, container, false, isTV);
        } else if(container) {
            container.innerHTML = '<p class="text-xs text-white/40">Gagal memuat film.</p>';
        }
    } catch(e) { console.error('Gagal render:', elementId); }
}

function renderCards(movies, container, append = false, isTV = false) {
    if (!container) return;
    if (!append) container.innerHTML = '';
    movies.forEach(m => {
        if (!m.poster_path) return;
        const type = m.media_type || (isTV ? 'tv' : (m.title ? 'movie' : 'tv'));
        const prog = m.progress || 0;
        const progHTML = prog ? `<div class="absolute bottom-0 left-0 w-full h-1 bg-black/50"><div class="h-full bg-blue-500" style="width: ${prog}%"></div></div>` : '';

        const rawTitle = m.title || m.name || 'Unknown';
        const safeTitle = rawTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safeBackdrop = m.backdrop_path ? m.backdrop_path : '';

        const card = document.createElement('div'); card.className = "movie-card";
        card.innerHTML = `<div class="poster-container" onclick="playMovie(${m.id}, '${safeTitle}', '${type}', '${safeBackdrop}')">
                <img src="${IMG_PATH + m.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"><div class="w-10 h-10 rounded-full glass-btn flex items-center justify-center pl-1 text-white text-lg shadow-[0_0_15px_rgba(255,255,255,0.5)]">▶</div></div>
                ${progHTML}
            </div>
            <div class="mt-3 px-1 text-center"><h3 class="text-[10px] font-bold truncate opacity-60 uppercase tracking-widest">${rawTitle}</h3></div>`;
        container.appendChild(card);
    });
}

// NAVIGATION & SEARCH
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
        const res = await fetch(`/api/movies?path=${path.replace('?', '&')}&page=${currentPage}`); const data = await res.json();
        renderCards(data.results || [], document.getElementById('gridResults'));
    } catch(e){}
}

async function loadMore() {
    currentPage++;
    try {
        const res = await fetch(`/api/movies?path=${currentPath.replace('?', '&')}&page=${currentPage}`); const data = await res.json();
        renderCards(data.results || [], document.getElementById('gridResults'), true);
    } catch(e){}
}

function goHome() { window.location.reload(); }

// PLAYER
function changeServer(s) {
    const f = document.getElementById('videoPlayer'); let url = '';
    if(s==='VidSrc') url = `https://vidsrc.me/embed/${currentPlayType}?tmdb=${currentPlayId}`;
    else if(s==='AutoEmbed') url = `https://player.autoembed.app/embed/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    else url = `https://vidlink.pro/${currentPlayType}/${currentPlayId}${currentPlayType==='tv'?'/1/1':''}`;
    f.src = url;
    document.querySelectorAll('.server-btn').forEach(b => b.classList.add('opacity-50'));
    const btn = document.getElementById('btn-'+s); if(btn) btn.classList.remove('opacity-50');
}

async function playMovie(id, title, type, backdrop) {
    currentPlayId = id; currentPlayType = type;
    document.getElementById('playingTitle').innerText = title;
    
    if(backdrop && backdrop !== 'null') { document.getElementById('playerBg').style.backgroundImage = `url('${BACK_PATH + backdrop}')`; } 
    else { document.getElementById('playerBg').style.backgroundImage = 'none'; }
    
    document.getElementById('playerControls').innerHTML = `
        <button id="btn-VidSrc" onclick="changeServer('VidSrc')" class="server-btn px-5 py-2 rounded-full text-[10px] font-bold bg-blue-600">SERVER Utama</button>
        <button id="btn-AutoEmbed" onclick="changeServer('AutoEmbed')" class="server-btn px-5 py-2 rounded-full text-[10px] font-bold glass-btn opacity-50">SERVER 2</button>
        <button onclick="shareMovie('${title.replace(/'/g, "\\'")}')" class="glass-btn px-5 py-2 rounded-full text-[10px] font-bold">📤 SHARE</button>`;
    
    changeServer('VidSrc');
    document.getElementById('playerContainer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    saveToHistory(id, type, backdrop, title);
    fetchDetails(id, type);
}

async function fetchDetails(id, type) {
    try {
        const res = await fetch(`/api/movies?path=${type}/${id}/credits`); const data = await res.json();
        const cBox = document.getElementById('castContainer'); cBox.innerHTML = '';
        data.cast?.slice(0, 10).forEach(a => {
            if(!a.profile_path) return;
            const safeName = a.name ? a.name.replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';
            const d = document.createElement('div'); d.className = "flex-shrink-0 text-center w-16 cursor-pointer hover:scale-110 transition";
            d.onclick = () => { closePlayer(); loadActorFilms(a.id, safeName); };
            d.innerHTML = `<img src="${IMG_PATH + a.profile_path}" class="w-12 h-12 rounded-full object-cover mx-auto"><p class="text-[8px] mt-2 truncate font-bold text-white/50">${a.name}</p>`;
            cBox.appendChild(d);
        });
    } catch(e){}

    try {
        const sim = await fetch(`/api/movies?path=${type}/${id}/recommendations`); const sData = await sim.json();
        renderCards(sData.results?.slice(0, 10) || [], document.getElementById('similarContainer'), false, type === 'tv');
    } catch(e){}
}

async function loadActorFilms(actorId, actorName) {
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = `Filmografi: ${actorName} 🎭`;
    currentPage = 1; currentPath = `discover/movie?with_cast=${actorId}&sort_by=popularity.desc`;
    document.getElementById('gridResults').innerHTML = '';
    renderSkeleton('gridResults', 15);
    try {
        const res = await fetch(`/api/movies?path=${currentPath.replace('?', '&')}&page=${currentPage}`); const data = await res.json();
        renderCards(data.results || [], document.getElementById('gridResults'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(e){}
}

function closePlayer() { document.getElementById('playerContainer').classList.add('hidden'); document.getElementById('videoPlayer').src = ''; document.body.style.overflow = 'auto'; }

// HISTORY
function saveToHistory(id, type, backdrop, title) {
    let h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    h = h.filter(x => x.id !== id);
    h.unshift({id, type, backdrop_path: backdrop, title, progress: Math.floor(Math.random()*50)+20});
    localStorage.setItem('nbg_history', JSON.stringify(h.slice(0, 15)));
    renderHistory();
}
function renderHistory() {
    const h = JSON.parse(localStorage.getItem('nbg_history') || '[]');
    if(h.length > 0) { document.getElementById('historySection').classList.remove('hidden'); renderCards(h, document.getElementById('rowHistory')); }
}
function clearHistory() { localStorage.removeItem('nbg_history'); document.getElementById('historySection').classList.add('hidden'); }

// UI UTILS
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
            requestAnimationFrame(() => slider.scrollLeft = scrollLeft - walk);
        });
    });
}
function setupScrollHide() {
    let lastScrollY = window.scrollY; let ticking = false; const nav = document.getElementById('mobileNav');
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if(window.scrollY > lastScrollY && window.scrollY > 150) { nav.classList.add('translate-y-32'); } 
                else { nav.classList.remove('translate-y-32'); }
                lastScrollY = window.scrollY; ticking = false;
            }); ticking = true;
        }
    }, { passive: true });
}
function updateHero() {
    const m = featuredMovies[currentHeroIndex]; if(!m) return;
    const rawTitle = m.title || m.name || 'Unknown';
    const safeTitle = rawTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + m.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = rawTitle;
    document.getElementById('heroDesc').innerText = m.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(m.id, safeTitle, m.media_type, m.backdrop_path);
    let dots = ''; featuredMovies.forEach((_, i) => dots += `<div class="h-1.5 rounded-full transition-all ${i===currentHeroIndex?'w-10 bg-blue-500 shadow-[0_0_10px_#3b82f6]':'w-3 bg-white/20'}"></div>`);
    document.getElementById('heroDots').innerHTML = dots;
}
function startCarousel() { carouselTimer = setInterval(() => { currentHeroIndex = (currentHeroIndex+1)%featuredMovies.length; updateHero(); }, 8000); }
function shareMovie(t) { if(navigator.share){ navigator.share({ title: `Nonton ${t}`, text: `Seru banget nonton ${t} gratis di Nobargasi!`, url: window.location.href }); } else { alert("Browser belum mendukung fitur share."); } }
async function handleLiveSearch(query) {
    const box = document.getElementById('searchSuggestions');
    if (!query || query.length < 2) { box.classList.add('hidden'); return; }
    clearTimeout(liveSearchTimeout);
    liveSearchTimeout = setTimeout(async () => {
        try {
            box.innerHTML = '<p class="text-xs text-center py-3 text-white/50">Mencari...</p>'; box.classList.remove('hidden');
            const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}&page=1`); const data = await res.json();
            const suggestions = data.results ? data.results.filter(m => m.poster_path).slice(0, 5) : [];
            if (suggestions.length === 0) { box.innerHTML = '<p class="text-xs text-center text-red-400 py-3">Tidak ditemukan</p>'; return; }
            box.innerHTML = ''; 
            suggestions.forEach(m => {
                const type = m.media_type === 'tv' ? 'tv' : 'movie'; const year = (m.release_date || m.first_air_date || '').split('-')[0];
                const rawTitle = m.title || m.name || 'Unknown';
                const safeTitle = rawTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const item = document.createElement('div'); item.className = "flex items-center gap-3 p-2 hover:bg-white/10 rounded-xl cursor-pointer transition";
                item.innerHTML = `<img src="${IMG_PATH + m.poster_path}" class="w-8 h-12 object-cover rounded shadow"><div class="flex-1 min-w-0"><h4 class="text-xs font-bold truncate">${rawTitle}</h4><p class="text-[9px] text-white/50 mt-0.5">${year} • <span class="uppercase text-blue-400">${type}</span></p></div>`;
                item.onclick = () => { playMovie(m.id, safeTitle, type, m.backdrop_path); closeSuggestions(); document.getElementById('searchInput').value = ''; };
                box.appendChild(item);
            });
            if (data.results.length > 5) { const btn = document.createElement('button'); btn.className = "w-full text-center text-[10px] font-bold text-blue-400 py-2 mt-1 border-t border-white/10"; btn.innerText = `Lihat semua ➔`; btn.onclick = () => { doSearch(); }; box.appendChild(btn); }
        } catch (e) { box.classList.add('hidden'); }
    }, 500); 
}
function closeSuggestions() { document.getElementById('searchSuggestions').classList.add('hidden'); }
document.addEventListener('click', (e) => { if (!e.target.closest('#searchInput') && !e.target.closest('#searchSuggestions')) closeSuggestions(); });
function doSearch() { closeSuggestions(); const q = document.getElementById('searchInput').value; if(q) { loadCategory(`search/multi&query=${encodeURIComponent(q)}`, `Pencarian: ${q}`); document.getElementById('searchInput').value = ''; } }
async function surpriseMe() { try { const res = await fetch(`/api/movies?path=movie/popular&page=${Math.floor(Math.random() * 10) + 1}`); const data = await res.json(); if(data.results && data.results.length > 0) { const m = data.results[Math.floor(Math.random() * data.results.length)]; const safeTitle = (m.title||m.name||'').replace(/'/g, "\\'").replace(/"/g, "&quot;"); playMovie(m.id, safeTitle, 'movie', m.backdrop_path); } } catch(e){} }
