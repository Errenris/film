const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let currentPage = 1; let currentAction = ''; let currentPath = ''; let currentQuery = '';
let featuredMovies = []; let currentHeroIndex = 0; let carouselTimer;

window.onload = () => { initApp(); };

async function initApp() {
    const res = await fetch(`/api/movies?path=trending/all/day`);
    const data = await res.json();
    featuredMovies = data.results.slice(0, 10);
    updateHero();
    startCarousel();

    // Render baris default di Home
    fetchAndRender('movie/popular', 'row1');
    fetchAndRender('tv/popular', 'row2');
    // Jika kamu sudah pasang rowNostalgia di index.html, hapus tanda '//' di bawah ini:
    // fetchAndRender('discover/movie?primary_release_date.gte=2000-01-01&primary_release_date.lte=2009-12-31&sort_by=vote_average.desc&vote_count.gte=1000', 'rowNostalgia');
}

// --- LOGIKA 1: MY LIST (DAFTAR FAVORIT) ---
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

// --- LOGIKA 2: FILTER GENRE DINAMIS ---
function loadGenre(genreId, label) {
    loadCategory(`discover/movie?with_genres=${genreId}`, `Genre: ${label}`);
}

// --- LOGIKA MENU & LOAD MORE ---
function showSection(type) {
    document.getElementById('homeView').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('heroSection').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('gridSection').classList.add('hidden');
    document.getElementById('myListSection').classList.add('hidden');
    if(type === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadCategory(path, label) {
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
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
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
}

async function loadMore() {
    currentPage++;
    const btn = document.getElementById('loadMoreBtn');
    btn.innerText = 'Memuat...';
    let url = currentAction === 'category' 
        ? `/api/movies?path=${encodeURIComponent(currentPath)}&page=${currentPage}`
        : `/api/movies?path=search/multi&query=${encodeURIComponent(currentQuery)}&page=${currentPage}`;

    const res = await fetch(url);
    const data = await res.json();
    renderCards(data.results, document.getElementById('gridResults'), true, currentPath.includes('tv'));
    btn.innerText = '↻ Muat Lebih Banyak';
    if(currentPage >= data.total_pages) btn.classList.add('hidden');
}

// --- LOGIKA RENDER CARD & TOMBOL LOVE & INDIKATOR NEW ---
async function fetchAndRender(path, elementId) {
    const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    renderCards(data.results, document.getElementById(elementId), false, path.includes('tv'));
}

function renderCards(movies, container, append = false, isTV = false) {
    if (!append) container.innerHTML = '';
    const myList = getMyList();
    const currentYear = new Date().getFullYear(); // Ambil tahun saat ini (Otomatis)

    movies.forEach(movie => {
        if (!movie.poster_path) return;
        const type = movie.media_type || (isTV ? 'tv' : 'movie');
        
        const savedObj = {
            id: movie.id, title: movie.title || movie.name, poster_path: movie.poster_path, 
            media_type: type, vote_average: movie.vote_average, release_date: movie.release_date || movie.first_air_date || ''
        };
        const movieStr = encodeURIComponent(JSON.stringify(savedObj));
        const isFav = myList.some(m => m.id === movie.id);
        
        // Cek Tahun Rilis
        const releaseYear = savedObj.release_date ? savedObj.release_date.split('-')[0] : '';
        
        // Logika Badge NEW: Muncul jika rilis di tahun yang sama dengan tahun saat ini
        const newBadgeHTML = (releaseYear == currentYear) 
            ? `<div class="absolute top-2 left-14 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[8px] font-extrabold px-2 py-1 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.8)] animate-pulse pointer-events-none z-10">NEW ✨</div>` 
            : '';

        const card = document.createElement('div');
        card.className = "movie-card";
        card.innerHTML = `
            <div class="poster-container" onclick="playMovie(${movie.id}, '${savedObj.title.replace(/'/g, "\\'")}', '${type}')">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div class="w-12 h-12 rounded-full glass-btn flex items-center justify-center pl-1 text-white text-xl">▶</div>
                </div>
            </div>
            
            <button onclick="toggleMyList(event, '${movieStr}')" class="absolute top-2 right-2 glass-panel w-8 h-8 rounded-full flex items-center justify-center text-sm z-[30] transition ${isFav ? 'text-red-500' : 'text-white'} hover:scale-110">
                ${isFav ? '❤️' : '🤍'}
            </button>
            
            <div class="absolute top-2 left-2 glass-panel text-white text-[9px] font-bold px-2 py-1 rounded-full pointer-events-none z-10">⭐ ${savedObj.vote_average.toFixed(1)}</div>
            
            <!-- Cetak Badge NEW di Sini -->
            ${newBadgeHTML}

            <div class="absolute bottom-16 right-2 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg uppercase pointer-events-none z-10">${type}</div>
            
            <div class="mt-3 px-1 text-center">
                <h3 class="text-[13px] font-bold truncate text-white/90">${savedObj.title}</h3>
                <p class="text-[11px] text-white/50 mt-1">${releaseYear}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- LOGIKA 3: PLAYER + FETCH TRAILER ---
function playMovie(id, title, type = 'movie') {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    const controls = document.getElementById('playerControls');
    
    const movieUrl = `https://vidapi.ru/embed/${type}/${id}`;
    iframe.src = movieUrl;
    document.getElementById('playingTitle').innerText = title;
    
    controls.innerHTML = `
        <button onclick="document.getElementById('videoPlayer').src='${movieUrl}'" class="glass-btn px-4 py-2 rounded-full text-sm font-bold text-blue-300 hover:bg-blue-600/20">▶ Nonton Full</button>
        <button id="trailerBtn" class="glass-btn px-4 py-2 rounded-full text-sm font-bold text-red-400 hover:bg-red-600/20">🎬 Lihat Trailer</button>
    `;

    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    document.getElementById('trailerBtn').onclick = async function() {
        this.innerText = 'Mencari Trailer...';
        try {
            const res = await fetch(`/api/movies?path=${type}/${id}/videos`);
            const data = await res.json();
            const trailer = data.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
            
            if (trailer) {
                iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
                this.innerText = '🎬 Menonton Trailer';
            } else {
                this.innerText = '❌ Trailer Tidak Ada';
                setTimeout(() => this.innerText = '🎬 Lihat Trailer', 2000);
            }
        } catch(e) {
            this.innerText = '❌ Error API';
        }
    };
}

function closePlayer() {
    document.getElementById('videoPlayer').src = '';
    document.getElementById('playerContainer').classList.add('hidden');
    document.body.style.overflow = 'auto';
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
