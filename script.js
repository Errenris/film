const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

let featuredMovies = [];
let currentHeroIndex = 0;
let carouselTimer;

window.onload = () => {
    initApp();
};

async function initApp() {
    // Ambil data Trending untuk Hero Carousel (Top 10)
    const res = await fetch(`/api/movies?path=trending/all/day`);
    const data = await res.json();
    featuredMovies = data.results.slice(0, 10);
    
    updateHero();
    startCarousel();

    // Isi Baris Home
    fetchAndRender('trending/movie/week', 'row1');
    fetchAndRender('tv/popular', 'row2');
}

// --- LOGIKA HERO CAROUSEL ---
function updateHero() {
    const movie = featuredMovies[currentHeroIndex];
    if (!movie) return;

    const content = document.getElementById('heroContent');
    const title = document.getElementById('heroTitle');
    const desc = document.getElementById('heroDesc');
    const counter = document.getElementById('carouselIndex');
    const playBtn = document.getElementById('heroPlayBtn');

    content.style.backgroundImage = `url('${BACK_PATH + movie.backdrop_path}')`;
    title.innerText = movie.title || movie.name;
    desc.innerText = movie.overview;
    counter.innerText = `${currentHeroIndex + 1} / 10`;
    
    playBtn.onclick = () => playMovie(movie.id, movie.title || movie.name, movie.media_type);
}

function nextHero() {
    currentHeroIndex = (currentHeroIndex + 1) % featuredMovies.length;
    updateHero();
    resetCarousel();
}

function prevHero() {
    currentHeroIndex = (currentHeroIndex - 1 + featuredMovies.length) % featuredMovies.length;
    updateHero();
    resetCarousel();
}

function startCarousel() {
    carouselTimer = setInterval(nextHero, 8000); // Ganti tiap 8 detik
}

function resetCarousel() {
    clearInterval(carouselTimer);
    startCarousel();
}

// --- LOGIKA CONTENT ---
async function fetchAndRender(path, elementId) {
    const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    renderGrid(data.results, elementId, path.includes('tv'));
}

function renderGrid(movies, elementId, isTV = false) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    movies.forEach(movie => {
        if (!movie.poster_path) return;
        const type = isTV || movie.media_type === 'tv' ? 'tv' : 'movie';
        
        const card = document.createElement('div');
        card.className = "movie-card";
        card.innerHTML = `
            <div class="relative aspect-[2/3] rounded-lg overflow-hidden border border-gray-800 shadow-lg">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute top-2 left-2 bg-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded shadow">⭐ ${movie.vote_average.toFixed(1)}</div>
                <div class="absolute bottom-2 right-2 bg-blue-600 text-[8px] px-1 rounded uppercase">${type}</div>
            </div>
            <h3 class="mt-2 text-[12px] font-bold truncate px-1">${movie.title || movie.name}</h3>
        `;
        card.onclick = () => playMovie(movie.id, movie.title || movie.name, type);
        container.appendChild(card);
    });
}

// --- LOGIKA MENU & NAVIGASI ---
function showSection(type) {
    document.getElementById('homeView').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('heroSection').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('categorySection').classList.add('hidden');
}

async function loadCategory(path, label) {
    showSection('category');
    const section = document.getElementById('categorySection');
    const title = document.getElementById('categoryTitle');
    
    section.classList.remove('hidden');
    title.innerText = label;
    
    const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    renderGrid(data.results, 'categoryResults', path.includes('tv'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;

    showSection('search');
    const section = document.getElementById('searchSection');
    section.classList.remove('hidden');

    const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderGrid(data.results, 'searchResults');
}

function sideScroll(elementId, direction) {
    const container = document.getElementById(elementId);
    const amount = container.clientWidth * 0.8;
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}

// --- PLAYER ---
function playMovie(id, title, type = 'movie') {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    
    // Logika embed vidapi.ru: Jika TV series biasanya butuh season & episode
    // Di sini kita default ke movie embed. Untuk TV, player vidapi biasanya akan menampilkan list episode.
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
