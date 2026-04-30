const IMG_PATH = "https://image.tmdb.org/t/p/w342"; // Ukuran gambar lebih kecil (hemat kuota & rapi)
const BACK_PATH = "https://image.tmdb.org/t/p/original";

window.onload = () => {
    initApp();
};

async function initApp() {
    fetchFromProxy('trending/movie/day', 'trendingRow', true);
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
        console.error("Gagal load data");
    }
}

function renderList(movies, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    movies.forEach(movie => {
        if (!movie.poster_path) return;

        const card = document.createElement('div');
        card.className = "movie-card cursor-pointer";
        card.innerHTML = `
            <div class="poster-wrapper shadow-lg border border-gray-800">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy">
                <div class="rating-tag">⭐ ${movie.vote_average.toFixed(1)}</div>
                <div class="quality-tag">HD</div>
            </div>
            <div class="mt-2 text-center">
                <h3 class="text-[11px] md:text-[13px] font-bold truncate leading-tight">${movie.title}</h3>
                <p class="text-[10px] text-gray-500">${movie.release_date ? movie.release_date.split('-')[0] : ''}</p>
            </div>
        `;
        card.onclick = () => playMovie(movie.id, movie.title);
        container.appendChild(card);
    });
}

function setupHero(movie) {
    const hero = document.getElementById('hero');
    hero.classList.remove('hidden');
    document.getElementById('heroBg').style.backgroundImage = `url('${BACK_PATH + movie.backdrop_path}')`;
    document.getElementById('heroTitle').innerText = movie.title;
    document.getElementById('heroDesc').innerText = movie.overview;
    document.getElementById('heroPlayBtn').onclick = () => playMovie(movie.id, movie.title);
}

function sideScroll(elementId, direction) {
    const container = document.getElementById(elementId);
    const amount = container.clientWidth * 0.7;
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    const section = document.getElementById('searchSection');
    section.classList.remove('hidden');
    
    const res = await fetch(`/api/movies?path=search/movie&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderList(data.results, 'searchResults');
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function playMovie(id, title) {
    const player = document.getElementById('playerContainer');
    document.getElementById('videoPlayer').src = `https://vidapi.ru/embed/movie/${id}`;
    document.getElementById('playingTitle').innerText = `Menonton: ${title}`;
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const player = document.getElementById('playerContainer');
    document.getElementById('videoPlayer').src = '';
    player.classList.add('hidden');
    document.body.style.overflow = 'auto';
}
