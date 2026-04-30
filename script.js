const IMG_PATH = "https://image.tmdb.org/t/p/w342";

window.onload = () => {
    initApp();
};

async function initApp() {
    fetchFromProxy('trending/movie/day', 'trendingRow');
    fetchFromProxy('discover/movie?with_genres=28', 'actionRow');
}

async function fetchFromProxy(path, elementId) {
    try {
        const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (data.results) {
            renderCards(data.results, elementId);
        }
    } catch (e) {
        console.error("Gagal load data");
    }
}

function renderCards(movies, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    movies.forEach(movie => {
        if (!movie.poster_path) return;

        const card = document.createElement('div');
        card.className = "movie-card";
        card.innerHTML = `
            <div class="poster-container">
                <img src="${IMG_PATH + movie.poster_path}" class="w-full h-full object-cover" loading="lazy" alt="${movie.title}">
                
                <!-- Glass Overlay on Hover -->
                <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center">
                    <div class="w-12 h-12 rounded-full glass-btn flex items-center justify-center pl-1">
                        ▶
                    </div>
                </div>
                
                <!-- Glass Rating Badge -->
                <div class="absolute top-2 left-2 bg-black/30 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    ⭐ ${movie.vote_average.toFixed(1)}
                </div>
            </div>
            <div class="mt-3 px-1 text-center">
                <h3 class="text-[13px] font-bold truncate text-white/90">${movie.title || movie.name}</h3>
                <p class="text-[11px] text-white/50 mt-1">${movie.release_date ? movie.release_date.split('-')[0] : ''}</p>
            </div>
        `;
        card.onclick = () => playMovie(movie.id, movie.title || movie.name);
        container.appendChild(card);
    });
}

function sideScroll(elementId, direction) {
    const container = document.getElementById(elementId);
    // Scroll 70% dari lebar container agar mulus
    const amount = container.clientWidth * 0.7; 
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    const section = document.getElementById('searchSection');
    section.classList.remove('hidden');
    
    const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    renderCards(data.results, 'searchResults');
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function playMovie(id, title) {
    const player = document.getElementById('playerContainer');
    document.getElementById('videoPlayer').src = `https://vidapi.ru/embed/movie/${id}`;
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
