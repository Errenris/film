// Konfigurasi API
const TMDB_KEY = "80907d8985c7a31505c21f7532d84793"; // Ganti jika tidak muncul
const VID_API = "https://vidapi.ru/api";
const IMG_PATH = "https://image.tmdb.org/t/p/w500";
const BACKDROP_PATH = "https://image.tmdb.org/t/p/original";

window.onload = () => {
    initApp();
    
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 50) {
            nav.classList.add('bg-[#141414]', 'shadow-xl');
        } else {
            nav.classList.remove('bg-[#141414]', 'shadow-xl');
        }
    });
};

async function initApp() {
    // 1. Trending (untuk Hero & Baris 1)
    fetchMovies(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}`, 'trendingRow', true);
    
    // 2. Action Movies
    fetchMovies(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_genres=28`, 'actionRow');
    
    // 3. Top Rated
    fetchMovies(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_KEY}`, 'topRatedRow');
}

async function fetchMovies(url, elementId, isFirst = false) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const movies = data.results;

        if (isFirst && movies.length > 0) setupHero(movies[0]);
        
        renderList(movies, elementId);
    } catch (err) {
        console.error("Gagal mengambil data:", err);
    }
}

function renderList(movies, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    movies.forEach(movie => {
        if (!movie.poster_path) return;

        const card = document.createElement('div');
        card.className = "movie-card cursor-pointer group";
        card.innerHTML = `
            <img src="${IMG_PATH + movie.poster_path}" class="rounded-md shadow-md" alt="${movie.title}">
            <div class="mt-2">
                <p class="text-xs font-bold truncate">${movie.title}</p>
                <p class="text-[10px] text-gray-400">⭐ ${movie.vote_average.toFixed(1)}</p>
            </div>
        `;
        card.onclick = () => playMovie(movie.id, movie.title);
        container.appendChild(card);
    });
}

function setupHero(movie) {
    const hero = document.getElementById('hero');
    hero.classList.remove('hidden');
    document.getElementById('heroBg').style.backgroundImage = `url('${BACKDROP_PATH + movie.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = movie.title;
    document.getElementById('heroDesc').innerText = movie.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(movie.id, movie.title);
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    const section = document.getElementById('searchSection');
    const container = document.getElementById('searchResults');

    if (!query) return;

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}`);
        const data = await res.json();
        
        section.classList.remove('hidden');
        renderList(data.results, 'searchResults');
        section.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert("Pencarian gagal, coba lagi nanti.");
    }
}

function playMovie(id, title) {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    
    // Integrasi ke API vidapi.ru
    iframe.src = `${VID_API}?tmdb=${id}`;
    document.getElementById('playingTitle').innerText = title;
    
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    iframe.src = '';
    player.classList.add('hidden');
    document.body.style.overflow = 'auto';
}
