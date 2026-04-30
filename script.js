// Ganti dengan API Key TMDB kamu jika ini sudah limit
const TMDB_KEY = "52a1d7f550504d909030616970769a93"; 
const VID_API = "[https://vidapi.ru/api](https://vidapi.ru/api)";

window.onload = () => {
    initApp();
};

async function initApp() {
    // Load berbagai kategori
    fetchAndRender(`[https://api.themoviedb.org/3/trending/movie/day?api_key=$](https://api.themoviedb.org/3/trending/movie/day?api_key=$){TMDB_KEY}`, 'trendingRow', true);
    fetchAndRender(`[https://api.themoviedb.org/3/discover/movie?api_key=$](https://api.themoviedb.org/3/discover/movie?api_key=$){TMDB_KEY}&with_genres=28`, 'actionRow');
    fetchAndRender(`[https://api.themoviedb.org/3/movie/popular?api_key=$](https://api.themoviedb.org/3/movie/popular?api_key=$){TMDB_KEY}`, 'popularRow');
}

async function fetchAndRender(url, elementId, isHero = false) {
    const container = document.getElementById(elementId);
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.results) {
            if (isHero) setupHero(data.results[0]);
            renderCards(data.results, container);
        }
    } catch (e) {
        console.error("Gagal load data: ", e);
    }
}

function renderCards(movies, container) {
    container.innerHTML = '';
    movies.forEach(movie => {
        if (!movie.poster_path) return;
        
        const card = document.createElement('div');
        card.className = "netflix-card min-w-[160px] md:min-w-[200px] cursor-pointer shadow-lg";
        card.innerHTML = `
            <img src="[https://image.tmdb.org/t/p/w500$](https://image.tmdb.org/t/p/w500$){movie.poster_path}" 
                 class="w-full h-auto rounded-md object-cover" 
                 alt="${movie.title}">
        `;
        card.onclick = () => playMovie(movie.id, movie.title);
        container.appendChild(card);
    });
}

function setupHero(movie) {
    const hero = document.getElementById('hero');
    hero.classList.remove('hidden');
    document.getElementById('heroBg').style.backgroundImage = `url('[https://image.tmdb.org/t/p/original$](https://image.tmdb.org/t/p/original$){movie.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = movie.title;
    document.getElementById('heroDesc').innerText = movie.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(movie.id, movie.title);
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    const row = document.getElementById('searchRow');
    const container = document.getElementById('searchResults');

    if (!query) return;

    try {
        const res = await fetch(`[https://api.themoviedb.org/3/search/movie?api_key=$](https://api.themoviedb.org/3/search/movie?api_key=$){TMDB_KEY}&query=${query}`);
        const data = await res.json();
        
        row.classList.remove('hidden');
        renderCards(data.results, container);
        row.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        console.error("Pencarian gagal");
    }
}

function playMovie(id, title) {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    
    // Set URL Vidapi
    iframe.src = `${VID_API}?tmdb=${id}`;
    document.getElementById('playingTitle').innerText = title;
    
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Stop scrolling
}

function closePlayer() {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    iframe.src = '';
    player.classList.add('hidden');
    document.body.style.overflow = 'auto';
}
