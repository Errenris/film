const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let featuredMovies = [];
let currentHeroIndex = 0;
let carouselTimer;

window.onload = () => {
    initApp();
};

async function initApp() {
    // 1. Hero Carousel cukup 10 film dari Halaman 1
    const res = await fetch(`/api/movies?path=trending/all/day&page=1`);
    const data = await res.json();
    featuredMovies = data.results.slice(0, 10);
    updateHero();
    startCarousel();

    // 2. Load Home Default (Tarik 3 Halaman = 60 Film per baris)
    fetchAndRenderMulti('movie/popular', 'row1', 3);
    fetchAndRenderMulti('tv/popular', 'row2', 3);
}

// --- LOGIKA MULTI-PAGE FETCHING (Biar Filmnya Banyak) ---
async function fetchAndRenderMulti(path, elementId, totalPages = 3) {
    let allMovies = [];
    
    // Sedot data dari Halaman 1 sampai Halaman yang ditentukan
    for (let i = 1; i <= totalPages; i++) {
        const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}&page=${i}`);
        const data = await res.json();
        if (data.results) allMovies = allMovies.concat(data.results);
    }
    
    renderGrid(allMovies, elementId, path.includes('tv'));
}

// --- LOGIKA MENU NAVIGASI ---
function showSection(type) {
    document.getElementById('homeView').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('heroSection').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('categorySection').classList.add('hidden');
    
    if(type === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadCategory(path, label) {
    showSection('category');
    document.getElementById('categorySection').classList.remove('hidden');
    document.getElementById('categoryTitle').innerText = `Kategori: ${label}`;
    
    // Teks loading selagi nyedot banyak data
    document.getElementById('categoryResults').innerHTML = '<p class="text-blue-400 font-bold ml-2">Mengambil puluhan film...</p>';
    
    let allMovies = [];
    // Tarik 4 Halaman sekaligus (80 Film) untuk halaman Menu
    for (let i = 1; i <= 4; i++) {
        const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}&page=${i}`);
        const data = await res.json();
        if (data.results) allMovies = allMovies.concat(data.results);
    }
    
    renderGrid(allMovies, 'categoryResults', path.includes('tv'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- LOGIKA HERO CAROUSEL ---
function updateHero() {
    const movie = featuredMovies[currentHeroIndex];
    if (!movie) return;

    document.getElementById('heroContent').style.backgroundImage = `url('${BACK_PATH + movie.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = movie.title || movie.name;
    document.getElementById('heroDesc').innerText = movie.overview;
    document.getElementById('carouselIndex').innerText = `${currentHeroIndex + 1} / 10`;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(movie.id, movie.title || movie.name, movie.media_type);
}

function nextHero() { currentHeroIndex = (currentHeroIndex + 1) % featuredMovies.length; updateHero(); resetCarousel(); }
function prevHero() { currentHeroIndex = (currentHeroIndex - 1 + featuredMovies.length) % featuredMovies.length; updateHero(); resetCarousel(); }
function startCarousel() { carouselTimer = setInterval(nextHero, 7000); }
function resetCarousel() { clearInterval(carouselTimer); startCarousel(); }

// --- LOGIKA PENCARIAN ---
async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    showSection('search');
    const section = document.getElementById('searchSection');
    section.classList.remove('hidden');
    document.getElementById('searchResults').innerHTML = '<p class="text-blue-400 font-bold ml-2">Mencari...</p>';
    
    let allMovies = [];
    // Cari hasil dari 3 halaman teratas
    for (let i = 1; i <= 3; i++) {
        const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}&page=${i}`);
        const data = await res.json();
        if (data.results) allMovies = allMovies.concat(data.results);
    }
    
    renderGrid(allMovies, 'searchResults');
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- LOGIKA RENDER (TAMPILAN CARD) ---
function renderGrid(movies, elementId, isTV = false) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    // Filter biar gambar yang rusak/tidak ada posternya gak ikut masuk
    const filteredMovies = movies.filter(movie => movie.poster_path);

    filteredMovies.forEach(movie => {
        const type = isTV || movie.media_type === 'tv' ? 'tv' : 'movie';

        const card = document.createElement('div');
        card.className = "movie-card";
        card.innerHTML = `
            <div class="poster-container">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy" alt="${movie.title || movie.name}">
                
                <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center">
                    <div class="w-12 h-12 rounded-full glass-btn flex items-center justify-center pl-1 text-white text-xl shadow-[0_0_15px_rgba(255,255,255,0.5)]">▶</div>
                </div>
                
                <div class="absolute top-2 left-2 glass-panel text-white text-[9px] font-bold px-2 py-1 rounded-full">⭐ ${movie.vote_average.toFixed(1)}</div>
                <div class="absolute bottom-2 right-2 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg uppercase">${type}</div>
            </div>
            <div class="mt-3 px-1 text-center">
                <h3 class="text-[13px] font-bold truncate text-white/90">${movie.title || movie.name}</h3>
                <p class="text-[11px] text-white/50 mt-1">${movie.release_date ? movie.release_date.split('-')[0] : ''}</p>
            </div>
        `;
        card.onclick = () => playMovie(movie.id, movie.title || movie.name, type);
        container.appendChild(card);
    });
}

function sideScroll(elementId, direction) {
    const container = document.getElementById(elementId);
    const amount = container.clientWidth * 0.7; 
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}

// --- LOGIKA PLAYER ---
function playMovie(id, title, type = 'movie') {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    const embedPath = type === 'tv' ? `tv/${id}` : `movie/${id}`;
    
    iframe.src = `https://vidapi.ru/embed/${embedPath}`;
    document.getElementById('playingTitle').innerText = title;
    
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const player = document.getElementById('playerContainer');
    document.getElementById('videoPlayer').src = '';
    player.classList.add('hidden');
    document.body.style.overflow = 'auto';
}
