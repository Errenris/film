const IMG_PATH = "https://image.tmdb.org/t/p/w500";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

window.onload = () => {
    initApp();
    // Navbar Scroll Effect
    window.onscroll = () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 100) nav.classList.add('bg-[#080808]', 'shadow-2xl');
        else nav.classList.remove('bg-[#080808]');
    };
};

async function initApp() {
    // Memanggil Serverless Function
    fetchFromProxy('trending/movie/week', 'trendingRow', true);
    fetchFromProxy('discover/movie?with_genres=28', 'actionRow');
}

async function fetchFromProxy(path, elementId, isHero = false) {
    try {
        const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        
        if (data.results) {
            if (isHero) setupHero(data.results[0]);
            renderList(data.results, elementId);
        }
    } catch (e) {
        console.error("Gagal memuat data");
    }
}

function renderList(movies, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = movies.map(movie => `
        <div class="movie-card min-w-[180px] md:min-w-[240px] cursor-pointer" onclick="playMovie(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">
            <div class="relative group overflow-hidden rounded-2xl">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <p class="text-xs text-red-500 font-bold mb-1">⭐ ${movie.vote_average.toFixed(1)}</p>
                    <button class="bg-white text-black text-[10px] font-bold py-2 rounded-lg">TONTON SEKARANG</button>
                </div>
            </div>
            <h3 class="mt-3 text-sm font-semibold truncate">${movie.title}</h3>
        </div>
    `).join('');
}

function setupHero(movie) {
    const hero = document.getElementById('hero');
    hero.classList.remove('hidden');
    document.getElementById('heroBg').style.backgroundImage = `url('${BACK_PATH + movie.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = movie.title;
    document.getElementById('heroDesc').innerText = movie.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(movie.id, movie.title);
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    const section = document.getElementById('searchSection');
    section.classList.remove('hidden');
    
    // Panggil proxy dengan query pencarian
    const res = await fetch(`/api/movies?path=search/movie&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderList(data.results, 'searchResults');
    section.scrollIntoView({ behavior: 'smooth' });
}

function playMovie(id, title) {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    iframe.src = `https://vidapi.ru/embed/movie/${id}`;
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const player = document.getElementById('playerContainer');
    document.getElementById('videoPlayer').src = '';
    player.classList.add('hidden');
    document.body.style.overflow = 'auto';
}
