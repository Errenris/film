const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;
let liveSearchTimeout;

window.onload = () => { initApp(); };

async function initApp() {
    const res = await fetch(`/api/movies?path=trending/all/day`);
    const data = await res.json();
    featuredMovies = data.results.slice(0, 10);
    updateHero();
    startCarousel();

    fetchAndRender('movie/popular', 'row1');
    fetchAndRender('tv/popular', 'row2');
}

// =========================================================
// SISTEM CEGAT TOMBOL BACK HP (History API)
// =========================================================

// Fungsi mencatat di history HP setiap buka menu baru
function addHistoryState(type) {
    history.pushState({ view: type }, '', `#${type}`);
}

// Listener: Deteksi jika user pencet tombol 'Back' di HP/Browser
window.addEventListener('popstate', () => {
    // 1. Kalau Player lagi kebuka, tutup playernya aja.
    const player = document.getElementById('playerContainer');
    if (!player.classList.contains('hidden')) {
        player.classList.add('hidden');
        document.getElementById('videoPlayer').src = '';
        document.body.style.overflow = 'auto';
        return;
    }
    
    // 2. Kalau Suggestion terbuka, tutup aja
    closeSuggestions();

    // 3. Kalau URL hashnya kosong, balikin ke halaman Home
    if (!window.location.hash) {
        showSection('home');
    } else {
        // Biarkan kembali ke hash sebelumnya jika ada
        showSection('home');
    }
});

// Fungsi tombol Home
function goHome() {
    history.pushState(null, null, ' '); // Menghapus tagar dari URL
    showSection('home');
}
// =========================================================

// --- LIVE SEARCH ---
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
            const suggestions = data.results.filter(m => m.poster_path).slice(0, 5);
            
            if (suggestions.length === 0) {
                 suggestBox.innerHTML = '<p class="text-xs text-center text-red-400 py-3">Film tidak ditemukan</p>';
                 return;
            }

            suggestBox.innerHTML = ''; 
            suggestions.forEach(movie => {
                const type = movie.media_type === 'tv' ? 'tv' : 'movie';
                const year = (movie.release_date || movie.first_air_date || '').split('-')[0];
                const item = document.createElement('div');
                item.className = "flex items-center gap-3 p-2 hover:bg-white/10 rounded-xl cursor-pointer transition";
                item.innerHTML = `
                    <img src="${IMG_PATH + movie.poster_path}" class="w-8 h-12 object-cover rounded shadow">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-bold text-white truncate">${movie.title || movie.name}</h4>
                        <p class="text-[9px] text-white/50 mt-0.5">${year} • <span class="uppercase text-blue-400">${type}</span></p>
                    </div>
                `;
                item.onclick = () => {
                    playMovie(movie.id, movie.title || movie.name, type);
                    closeSuggestions();
                    document.getElementById('searchInput').value = '';
                };
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
document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchInput') && !e.target.closest('#searchSuggestions')) closeSuggestions();
});

function doSearch() {
    closeSuggestions();
    searchMovie();
}

// --- MY LIST ---
function getMyList() { return JSON.parse(localStorage.getItem('streamverse_mylist') || '[]'); }
function saveMyList(list) { localStorage.setItem('streamverse_mylist', JSON.stringify(list)); }

function toggleMyList(event, movieStr) {
    event.stopPropagation(); 
    const movie = JSON.parse(decodeURIComponent(movieStr));
    let list = getMyList();
    const index = list.findIndex(m => m.id === movie.id);
    
    if (index > -1) {
        list.splice(index, 1); 
        event.target.innerText = '🤍';
        event.target.classList.remove('text-red-500');
    } else {
        list.push(movie); 
        event.target.innerText = '❤️';
        event.target.classList.add('text-red-500');
    }
    saveMyList(list);
    if (!document.getElementById('myListSection').classList.contains('hidden')) showMyList();
}

function showMyList() {
    addHistoryState('mylist'); // Rekam history
    showSection('mylist');
    document.getElementById('myListSection').classList.remove('hidden');
    const list = getMyList();
    const container = document.getElementById('myListResults');
    if(list.length === 0) {
        container.innerHTML = '<p class="text-gray-400 w-full text-center py-10">Belum ada film di daftar favoritmu.</p>';
    } else {
        renderCards(list, container, false, false, true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- LOAD CATEGORY & SEARCH FULL ---
function loadGenre(genreId, label) { loadCategory(`discover/movie?with_genres=${genreId}`, `Genre: ${label}`); }

function showSection(type) {
    document.getElementById('homeView').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('heroSection').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('gridSection').classList.add('hidden');
    document.getElementById('myListSection').classList.add('hidden');
    if(type === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadCategory(path, label) {
    addHistoryState('kategori'); // Rekam history
    showSection('grid');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = label;
    currentPage = 1; currentAction = 'category'; currentPath = path;
    
    const container = document.getElementById('gridResults');
    container.innerHTML = '<p class="text-white w-full text-center py-10">Memuat film...</p>';
    document.getElementById('loadMoreBtn').classList.add('hidden');
    
    const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}&page=${currentPage}`);
    const data = await res.json();
    renderCards(data.results, container, false, path.includes('tv'));
    if(data.total_pages > 1) document.getElementById('loadMoreBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    addHistoryState('pencarian'); // Rekam history
    showSection('grid');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = `Pencarian: "${query}"`;
    currentPage = 1; currentAction = 'search'; currentQuery = query;
    
    const container = document.getElementById('gridResults');
    container.innerHTML = '<p class="text-white w-full text-center py-10">Mencari...</p>';
    
    const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}&page=${currentPage}`);
    const data = await res.json();
    
    if(data.results.length === 0) {
        container.innerHTML = '<p class="text-red-400 w-full text-center py-10">Film tidak ditemukan.</p>';
        document.getElementById('loadMoreBtn').classList.add('hidden');
    } else {
        renderCards(data.results, container, false);
        if(data.total_pages > 1) document.getElementById('loadMoreBtn').classList.remove('hidden');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadMore() {
    currentPage++;
    const btn = document.getElementById('loadMoreBtn');
    btn.innerText = 'Memuat...';
    let url = currentAction === 'category' ? `/api/movies?path=${encodeURIComponent(currentPath)}&page=${currentPage}` : `/api/movies?path=search/multi&query=${encodeURIComponent(currentQuery)}&page=${currentPage}`;
    const res = await fetch(url);
    const data = await res.json();
    renderCards(data.results, document.getElementById('gridResults'), true, currentPath.includes('tv'));
    btn.innerText = '↻ Muat Lebih Banyak';
    if(currentPage >= data.total_pages) btn.classList.add('hidden');
}

// --- RENDER CARDS ---
async function fetchAndRender(path, elementId) {
    const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    renderCards(data.results, document.getElementById(elementId), false, path.includes('tv'));
}

function renderCards(movies, container, append = false, isTV = false) {
    if (!append) container.innerHTML = '';
    const myList = getMyList();
    const currentYear = new Date().getFullYear(); 

    movies.forEach(movie => {
        if (!movie.poster_path) return;
        const type = movie.media_type || (isTV ? 'tv' : 'movie');
        const savedObj = { id: movie.id, title: movie.title || movie.name, poster_path: movie.poster_path, media_type: type, vote_average: movie.vote_average, release_date: movie.release_date || movie.first_air_date || '' };
        const movieStr = encodeURIComponent(JSON.stringify(savedObj));
        const isFav = myList.some(m => m.id === movie.id);
        const releaseYear = savedObj.release_date ? savedObj.release_date.split('-')[0] : '';
        
        const newBadgeHTML = (releaseYear == currentYear) ? `<div class="absolute top-2 left-12 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.8)] animate-pulse pointer-events-none z-10">NEW</div>` : '';

        const card = document.createElement('div');
        card.className = "movie-card";
        card.innerHTML = `
            <div class="poster-container" onclick="playMovie(${movie.id}, '${savedObj.title.replace(/'/g, "\\'")}', '${type}')">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div class="w-10 h-10 rounded-full glass-btn flex items-center justify-center pl-1 text-white text-lg">▶</div>
                </div>
            </div>
            <button onclick="toggleMyList(event, '${movieStr}')" class="absolute top-2 right-2 glass-panel w-7 h-7 rounded-full flex items-center justify-center text-xs z-[30] transition ${isFav ? 'text-red-500' : 'text-white'} hover:scale-110">${isFav ? '❤️' : '🤍'}</button>
            <div class="absolute top-2 left-2 glass-panel text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none z-10">⭐${savedObj.vote_average.toFixed(1)}</div>
            ${newBadgeHTML}
            <div class="absolute bottom-[44px] right-2 bg-blue-500 text-white text-[7px] font-bold px-1 py-0.5 rounded shadow-lg uppercase pointer-events-none z-10">${type}</div>
            <div class="mt-2 px-1 text-center">
                <h3 class="text-xs font-bold truncate text-white/90">${savedObj.title}</h3>
                <p class="text-[10px] text-white/50">${releaseYear}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- PLAYER ---
function playMovie(id, title, type = 'movie') {
    addHistoryState('nonton'); // Mencegah keluar web kalau mencet back saat nonton
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    const controls = document.getElementById('playerControls');
    
    const movieUrl = `https://vidapi.ru/embed/${type}/${id}`;
    iframe.src = movieUrl;
    document.getElementById('playingTitle').innerText = title;
    
    controls.innerHTML = `
        <button onclick="document.getElementById('videoPlayer').src='${movieUrl}'" class="glass-btn px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold text-blue-300 hover:bg-blue-600/20">▶ Nonton</button>
        <button id="trailerBtn" class="glass-btn px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold text-red-400 hover:bg-red-600/20">🎬 Trailer</button>
    `;

    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    document.getElementById('trailerBtn').onclick = async function() {
        this.innerText = 'Loading...';
        try {
            const res = await fetch(`/api/movies?path=${type}/${id}/videos`);
            const data = await res.json();
            const trailer = data.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
            if (trailer) { iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`; this.innerText = '🎬 Trailer'; } 
            else { this.innerText = '❌ No Trailer'; setTimeout(() => this.innerText = '🎬 Trailer', 2000); }
        } catch(e) { this.innerText = '❌ Error'; }
    };
}

function closePlayer() {
    // Kalau tekan 'X', kita kembali 1 langkah di history HP
    history.back(); 
}

function updateHero() {
    const movie = featuredMovies[currentHeroIndex];
    if (!movie) return;
    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + movie.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = movie.title || movie.name;
    document.getElementById('heroDesc').innerText = movie.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(movie.id, movie.title || movie.name, movie.media_type);
}
function nextHero() { currentHeroIndex = (currentHeroIndex + 1) % featuredMovies.length; updateHero(); clearInterval(carouselTimer); startCarousel(); }
function startCarousel() { carouselTimer = setInterval(nextHero, 7000); }
function sideScroll(elementId, direction) {
    const container = document.getElementById(elementId);
    container.scrollBy({ left: direction === 'left' ? -(container.clientWidth*0.7) : (container.clientWidth*0.7), behavior: 'smooth' });
}
