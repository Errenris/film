const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let liveSearchTimeout;

window.onload = () => { initApp(); };

function renderSkeleton(elementId, count = 10) {
    const container = document.getElementById(elementId);
    if(!container) return;
    container.innerHTML = '';
    for(let i=0; i<count; i++) {
        const skel = document.createElement('div');
        skel.className = "movie-card";
        skel.innerHTML = `<div class="skeleton"></div><div class="h-3 w-3/4 bg-white/10 rounded mt-2 mx-auto animate-pulse"></div><div class="h-2 w-1/2 bg-white/5 rounded mt-1 mx-auto animate-pulse"></div>`;
        container.appendChild(skel);
    }
}

async function initApp() {
    const res = await fetch(`/api/movies?path=trending/all/day`);
    const data = await res.json();
    if(data.results) {
        featuredMovies = data.results.slice(0, 10);
        updateHero();
        startCarousel();
    }

    renderHistory();
    const rows = ['rowTrending', 'row1', 'row2', 'row3', 'row4', 'row5'];
    rows.forEach(r => renderSkeleton(r));

    fetchAndRenderTrending('trending/movie/day', 'rowTrending');
    fetchAndRender('movie/popular', 'row1');
    fetchAndRender('tv/popular', 'row2');
    fetchAndRender('discover/tv?with_original_language=ja&with_genres=16', 'row3'); 
    fetchAndRender('discover/tv?with_original_language=ko', 'row4');                
    fetchAndRender('discover/movie?with_genres=27', 'row5');                        
}

function toggleFilterPanel() { document.getElementById('filterPanel').classList.toggle('hidden'); }
function applyFilters() {
    const year = document.getElementById('filterYear').value;
    const rating = document.getElementById('filterRating').value;
    let path = 'discover/movie?sort_by=popularity.desc';
    if(year) path += `&primary_release_year=${year}`;
    if(rating) path += `&vote_average.gte=${rating}`;
    document.getElementById('filterPanel').classList.add('hidden');
    loadCategory(path, `Filter: ${year ? year : 'Semua Tahun'} | Rating ${rating ? rating+'+' : 'Semua'}`);
}
async function surpriseMe() {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    try {
        const res = await fetch(`/api/movies?path=movie/popular&page=${randomPage}`);
        const data = await res.json();
        if(data.results && data.results.length > 0) {
            const m = data.results[Math.floor(Math.random() * data.results.length)];
            playMovie(m.id, m.title || m.name, 'movie', m.backdrop_path);
        }
    } catch(e) { alert("Gagal mengacak film. Coba lagi."); }
}

async function saveToHistory(id, type, backdrop) {
    try {
        const res = await fetch(`/api/movies?path=${type}/${id}`);
        const data = await res.json();
        if(!data.poster_path) return;
        const savedObj = { id: data.id, title: data.title || data.name, poster_path: data.poster_path, backdrop_path: backdrop || data.backdrop_path, media_type: type, vote_average: data.vote_average || 0, release_date: data.release_date || data.first_air_date || '' };
        let history = JSON.parse(localStorage.getItem('streamverse_history') || '[]');
        history = history.filter(m => m.id !== id); history.unshift(savedObj); 
        if (history.length > 15) history.pop(); 
        localStorage.setItem('streamverse_history', JSON.stringify(history));
        renderHistory();
    } catch(e) {}
}
function renderHistory() {
    const history = JSON.parse(localStorage.getItem('streamverse_history') || '[]');
    const section = document.getElementById('historySection');
    const container = document.getElementById('rowHistory');
    if (history.length === 0) { section.classList.add('hidden'); } 
    else { section.classList.remove('hidden'); renderCards(history, container, false, false); }
}
function clearHistory() { localStorage.removeItem('streamverse_history'); renderHistory(); }

function addHistoryState(type) { history.pushState({ view: type }, '', `#${type}`); }
window.addEventListener('popstate', () => {
    const player = document.getElementById('playerContainer');
    if (!player.classList.contains('hidden')) {
        player.classList.add('hidden');
        document.getElementById('videoPlayer').src = '';
        document.getElementById('playerBg').style.backgroundImage = 'none';
        document.body.style.overflow = 'auto';
        return;
    }
    closeSuggestions();
    if (!window.location.hash) { showSection('home'); } else { showSection('home'); }
});
function goHome() { history.pushState(null, null, ' '); showSection('home'); }

async function handleLiveSearch(query) {
    const suggestBox = document.getElementById('searchSuggestions');
    if (!query || query.length < 2) { suggestBox.classList.add('hidden'); return; }
    clearTimeout(liveSearchTimeout);
    liveSearchTimeout = setTimeout(async () => {
        try {
            suggestBox.innerHTML = '<p class="text-xs text-center text-white/50 py-3">Mencari...</p>';
            suggestBox.classList.remove('hidden');
            const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}&page=1`);
            const data = await res.json();
            if(!data.results) return;
            const suggestions = data.results.filter(m => m.poster_path).slice(0, 5);
            if (suggestions.length === 0) { suggestBox.innerHTML = '<p class="text-xs text-center text-red-400 py-3">Tidak ditemukan</p>'; return; }
            suggestBox.innerHTML = ''; 
            suggestions.forEach(movie => {
                const type = movie.media_type === 'tv' ? 'tv' : 'movie';
                const year = (movie.release_date || movie.first_air_date || '').split('-')[0];
                const item = document.createElement('div');
                item.className = "flex items-center gap-3 p-2 hover:bg-white/10 rounded-xl cursor-pointer transition";
                item.innerHTML = `<img src="${IMG_PATH + movie.poster_path}" class="w-8 h-12 object-cover rounded shadow"><div class="flex-1 min-w-0"><h4 class="text-xs font-bold text-white truncate">${movie.title || movie.name}</h4><p class="text-[9px] text-white/50 mt-0.5">${year} • <span class="uppercase text-blue-400">${type}</span></p></div>`;
                item.onclick = () => { playMovie(movie.id, movie.title || movie.name, type, movie.backdrop_path); closeSuggestions(); document.getElementById('searchInput').value = ''; };
                suggestBox.appendChild(item);
            });
            if (data.results.length > 5) {
                const viewAllBtn = document.createElement('button');
                viewAllBtn.className = "w-full text-center text-[10px] font-bold text-blue-400 hover:text-white py-2 mt-1 border-t border-white/10 transition";
                viewAllBtn.innerText = `Lihat semua hasil ➔`;
                viewAllBtn.onclick = () => { doSearch(); };
                suggestBox.appendChild(viewAllBtn);
            }
        } catch (e) { suggestBox.classList.add('hidden'); }
    }, 500); 
}
function closeSuggestions() { document.getElementById('searchSuggestions').classList.add('hidden'); }
document.addEventListener('click', (e) => { if (!e.target.closest('#searchInput') && !e.target.closest('#searchSuggestions')) closeSuggestions(); });
function doSearch() { closeSuggestions(); searchMovie(); }

function getMyList() { return JSON.parse(localStorage.getItem('streamverse_mylist') || '[]'); }
function saveMyList(list) { localStorage.setItem('streamverse_mylist', JSON.stringify(list)); }
function toggleMyList(event, movieStr) {
    event.stopPropagation(); const movie = JSON.parse(decodeURIComponent(movieStr));
    let list = getMyList(); const index = list.findIndex(m => m.id === movie.id);
    if (index > -1) { list.splice(index, 1); event.target.innerText = '🤍'; event.target.classList.remove('text-red-500'); } 
    else { list.push(movie); event.target.innerText = '❤️'; event.target.classList.add('text-red-500'); }
    saveMyList(list); if (!document.getElementById('myListSection').classList.contains('hidden')) showMyList();
}
function showMyList() {
    addHistoryState('mylist'); showSection('mylist'); document.getElementById('myListSection').classList.remove('hidden');
    const list = getMyList(); const container = document.getElementById('myListResults');
    if(list.length === 0) { container.innerHTML = '<p class="text-gray-400 w-full text-center py-10">Belum ada film di daftar favoritmu.</p>'; } 
    else { renderCards(list, container, false, false, true); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadGenre(genreId, label) { loadCategory(`discover/movie?with_genres=${genreId}`, `Genre: ${label}`); }
function showSection(type) {
    document.getElementById('homeView').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('heroSection').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('gridSection').classList.add('hidden'); document.getElementById('myListSection').classList.add('hidden');
    if(type === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadCategory(path, label) {
    addHistoryState('kategori'); showSection('grid'); document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = label; currentPage = 1; currentAction = 'category'; currentPath = path;
    renderSkeleton('gridResults', 15); document.getElementById('loadMoreBtn').classList.add('hidden');
    
    const safePath = path.replace('?', '&');
    const res = await fetch(`/api/movies?path=${safePath}&page=${currentPage}`);
    const data = await res.json();
    if(data.results) {
        renderCards(data.results, document.getElementById('gridResults'), false, path.includes('tv'));
        if(data.total_pages > 1) document.getElementById('loadMoreBtn').classList.remove('hidden');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === FUNGSI BARU: BUKA HALAMAN AKTOR ===
async function loadActorFilms(actorId, actorName) {
    closePlayer(); // Tutup pemutar video dulu
    addHistoryState('aktor');
    showSection('grid');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = `Filmografi: ${actorName} 🎭`;
    
    currentPage = 1; 
    currentAction = 'category'; // Pakai logic category biar gampang load more
    currentPath = `discover/movie?with_cast=${actorId}&sort_by=popularity.desc`;
    
    renderSkeleton('gridResults', 15); 
    document.getElementById('loadMoreBtn').classList.add('hidden');
    
    const res = await fetch(`/api/movies?path=${currentPath.replace('?', '&')}&page=${currentPage}`);
    const data = await res.json();
    
    if(data.results && data.results.length > 0) {
        renderCards(data.results, document.getElementById('gridResults'), false, false);
        if(data.total_pages > 1) document.getElementById('loadMoreBtn').classList.remove('hidden');
    } else {
        document.getElementById('gridResults').innerHTML = '<p class="text-white w-full text-center py-10">Belum ada data film untuk aktor ini.</p>';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value; if (!query) return;
    addHistoryState('pencarian'); showSection('grid'); document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = `Pencarian: "${query}"`; currentPage = 1; currentAction = 'search'; currentQuery = query;
    renderSkeleton('gridResults', 10);
    const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}&page=${currentPage}`);
    const data = await res.json();
    if(!data.results || data.results.length === 0) {
        document.getElementById('gridResults').innerHTML = '<p class="text-red-400 w-full text-center py-10">Film tidak ditemukan.</p>';
        document.getElementById('loadMoreBtn').classList.add('hidden');
    } else {
        renderCards(data.results, document.getElementById('gridResults'), false);
        if(data.total_pages > 1) document.getElementById('loadMoreBtn').classList.remove('hidden');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadMore() {
    currentPage++; const btn = document.getElementById('loadMoreBtn'); btn.innerText = 'Memuat...';
    let url = currentAction === 'category' ? `/api/movies?path=${currentPath.replace('?', '&')}&page=${currentPage}` : `/api/movies?path=search/multi&query=${encodeURIComponent(currentQuery)}&page=${currentPage}`;
    const res = await fetch(url); const data = await res.json();
    if(data.results) renderCards(data.results, document.getElementById('gridResults'), true, currentPath.includes('tv'));
    btn.innerText = '↻ Muat Lebih Banyak'; if(currentPage >= data.total_pages) btn.classList.add('hidden');
}

async function fetchAndRender(path, elementId) {
    const safePath = path.replace('?', '&'); const res = await fetch(`/api/movies?path=${safePath}`); const data = await res.json();
    if(data.results) renderCards(data.results, document.getElementById(elementId), false, path.includes('tv'));
}

function renderCards(movies, container, append = false, isTV = false) {
    if (!append) container.innerHTML = '';
    const myList = getMyList(); const currentYear = new Date().getFullYear(); 

    movies.forEach(movie => {
        if (!movie.poster_path) return;
        const type = movie.media_type || (isTV ? 'tv' : 'movie');
        const savedObj = { id: movie.id, title: movie.title || movie.name, poster_path: movie.poster_path, backdrop_path: movie.backdrop_path, media_type: type, vote_average: movie.vote_average, release_date: movie.release_date || movie.first_air_date || '' };
        const movieStr = encodeURIComponent(JSON.stringify(savedObj));
        const isFav = myList.some(m => m.id === movie.id);
        const releaseYear = savedObj.release_date ? savedObj.release_date.split('-')[0] : '';
        const newBadgeHTML = (releaseYear == currentYear) ? `<div class="absolute top-2 left-12 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.8)] animate-pulse pointer-events-none z-10">NEW</div>` : '';

        const card = document.createElement('div'); card.className = "movie-card";
        card.innerHTML = `
            <div class="poster-container" onclick="playMovie(${movie.id}, '${savedObj.title.replace(/'/g, "\\'")}', '${type}', '${movie.backdrop_path}')">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"><div class="w-10 h-10 rounded-full glass-btn flex items-center justify-center pl-1 text-white text-lg">▶</div></div>
            </div>
            <button onclick="toggleMyList(event, '${movieStr}')" class="absolute top-2 right-2 glass-panel w-7 h-7 rounded-full flex items-center justify-center text-xs z-[30] transition ${isFav ? 'text-red-500' : 'text-white'} hover:scale-110">${isFav ? '❤️' : '🤍'}</button>
            <div class="absolute top-2 left-2 glass-panel text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none z-10">⭐${savedObj.vote_average.toFixed(1)}</div>
            ${newBadgeHTML}
            <div class="absolute bottom-[44px] right-2 bg-blue-500 text-white text-[7px] font-bold px-1 py-0.5 rounded shadow-lg uppercase pointer-events-none z-10">${type}</div>
            <div class="mt-2 px-1 text-center"><h3 class="text-xs font-bold truncate text-white/90">${savedObj.title}</h3><p class="text-[10px] text-white/50">${releaseYear}</p></div>
        `;
        container.appendChild(card);
    });
}

async function fetchAndRenderTrending(path, elementId) {
    const safePath = path.replace('?', '&'); const res = await fetch(`/api/movies?path=${safePath}`); const data = await res.json();
    if(data.results) renderTrendingCards(data.results.slice(0, 10), document.getElementById(elementId));
}

function renderTrendingCards(movies, container) {
    container.innerHTML = ''; const myList = getMyList(); 
    movies.forEach((movie, index) => {
        if (!movie.poster_path) return;
        const type = movie.media_type || 'movie';
        const savedObj = { id: movie.id, title: movie.title || movie.name, poster_path: movie.poster_path, backdrop_path: movie.backdrop_path, media_type: type, vote_average: movie.vote_average, release_date: movie.release_date || movie.first_air_date || '' };
        const movieStr = encodeURIComponent(JSON.stringify(savedObj));
        const isFav = myList.some(m => m.id === movie.id);
        const rank = index + 1;
        const rankColor = rank <= 3 ? 'from-yellow-300 via-yellow-500 to-orange-500 text-black shadow-[0_0_15px_rgba(255,215,0,0.6)]' : 'from-gray-300 via-gray-400 to-gray-600 text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]';

        const card = document.createElement('div'); card.className = "movie-card";
        card.innerHTML = `
            <div class="poster-container" onclick="playMovie(${movie.id}, '${savedObj.title.replace(/'/g, "\\'")}', '${type}', '${movie.backdrop_path}')">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"><div class="w-10 h-10 rounded-full glass-btn flex items-center justify-center pl-1 text-white text-lg">▶</div></div>
            </div>
            <div class="absolute -top-2 -left-2 bg-gradient-to-br ${rankColor} font-black text-sm px-2.5 py-1 rounded-br-xl rounded-tl-xl z-20 border border-white/40">#${rank}</div>
            <button onclick="toggleMyList(event, '${movieStr}')" class="absolute top-2 right-2 glass-panel w-7 h-7 rounded-full flex items-center justify-center text-xs z-[30] transition ${isFav ? 'text-red-500' : 'text-white'} hover:scale-110">${isFav ? '❤️' : '🤍'}</button>
            <div class="absolute bottom-[44px] right-2 bg-blue-500 text-white text-[7px] font-bold px-1 py-0.5 rounded shadow-lg uppercase pointer-events-none z-10">${type}</div>
            <div class="mt-2 px-1 text-center"><h3 class="text-xs font-bold truncate text-white/90">${savedObj.title}</h3></div>
        `;
        container.appendChild(card);
    });
}

// === UPDATE PLAYER: CAST KLIK & FILM SERUPA ===
async function playMovie(id, title, type = 'movie', backdropPath = '') {
    addHistoryState('nonton'); saveToHistory(id, type, backdropPath); 
    const player = document.getElementById('playerContainer'); const iframe = document.getElementById('videoPlayer');
    const controls = document.getElementById('playerControls'); const bg = document.getElementById('playerBg');
    const castBox = document.getElementById('castContainer');
    const similarBox = document.getElementById('similarContainer');
    
    if(backdropPath && backdropPath !== 'null') { bg.style.backgroundImage = `url('${BACK_PATH + backdropPath}')`; } 
    else { bg.style.backgroundImage = 'none'; }

    const movieUrl = `https://vidapi.ru/embed/${type}/${id}`; iframe.src = movieUrl; document.getElementById('playingTitle').innerText = title;
    
    controls.innerHTML = `<button onclick="document.getElementById('videoPlayer').src='${movieUrl}'" class="glass-btn px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold text-blue-300 hover:bg-blue-600/20">▶ Nonton</button><button id="trailerBtn" class="glass-btn px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold text-red-400 hover:bg-red-600/20">🎬 Trailer</button>`;
    player.classList.remove('hidden'); document.body.style.overflow = 'hidden';

    // 1. Tarik Data Pemeran
    castBox.innerHTML = '<p class="text-[10px] text-white/50 animate-pulse">Memuat pemeran...</p>';
    try {
        const castRes = await fetch(`/api/movies?path=${type}/${id}/credits`); const castData = await castRes.json();
        if(castData.cast && castData.cast.length > 0) {
            let castHTML = '';
            castData.cast.slice(0, 10).forEach(actor => {
                if(actor.profile_path) { 
                    // FOTO BISA DIKLIK MENGARAH KE FUNGSI loadActorFilms
                    castHTML += `
                        <div onclick="loadActorFilms(${actor.id}, '${actor.name.replace(/'/g, "\\'")}')" class="flex flex-col items-center w-14 flex-shrink-0 cursor-pointer hover:scale-110 transition duration-300">
                            <img src="${IMG_PATH + actor.profile_path}" class="w-10 h-10 rounded-full object-cover shadow-lg border border-white/20 hover:border-blue-400">
                            <p class="text-[8px] text-center text-white/80 mt-1 w-full truncate leading-tight">${actor.name}</p>
                        </div>
                    `; 
                }
            });
            castBox.innerHTML = castHTML || '<p class="text-[10px] text-white/50">Data pemeran tidak tersedia</p>';
        } else { castBox.innerHTML = '<p class="text-[10px] text-white/50">Data pemeran tidak tersedia</p>'; }
    } catch(e) { castBox.innerHTML = '<p class="text-[10px] text-red-400">Gagal memuat cast</p>'; }

    // 2. Tarik Data Film Serupa (Rekomendasi)
    similarBox.innerHTML = '<p class="text-[10px] text-white/50 animate-pulse">Mencari rekomendasi...</p>';
    try {
        const simRes = await fetch(`/api/movies?path=${type}/${id}/recommendations`);
        const simData = await simRes.json();
        if(simData.results && simData.results.length > 0) {
            const validSimilar = simData.results.filter(m => m.poster_path).slice(0, 10);
            if(validSimilar.length > 0) {
                renderCards(validSimilar, similarBox, false, type === 'tv');
            } else {
                similarBox.innerHTML = '<p class="text-[10px] text-white/50">Tidak ada rekomendasi.</p>';
            }
        } else {
            similarBox.innerHTML = '<p class="text-[10px] text-white/50">Tidak ada rekomendasi.</p>';
        }
    } catch(e) { similarBox.innerHTML = '<p class="text-[10px] text-white/50">Gagal memuat rekomendasi.</p>'; }

    document.getElementById('trailerBtn').onclick = async function() {
        this.innerText = 'Loading...';
        try {
            const res = await fetch(`/api/movies?path=${type}/${id}/videos`); const data = await res.json();
            const trailer = data.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
            if (trailer) { iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`; this.innerText = '🎬 Trailer'; } 
            else { this.innerText = '❌ No Trailer'; setTimeout(() => this.innerText = '🎬 Trailer', 2000); }
        } catch(e) { this.innerText = '❌ Error'; }
    };
}

function closePlayer() { history.back(); }
function updateHero() {
    const movie = featuredMovies[currentHeroIndex]; if (!movie) return;
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + movie.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = movie.title || movie.name; document.getElementById('heroDesc').innerText = movie.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(movie.id, movie.title || movie.name, movie.media_type, movie.backdrop_path);
}
function nextHero() { currentHeroIndex = (currentHeroIndex + 1) % featuredMovies.length; updateHero(); clearInterval(carouselTimer); startCarousel(); }
function startCarousel() { carouselTimer = setInterval(nextHero, 7000); }
