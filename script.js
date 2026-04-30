const API_BASE = "https://vidapi.ru/api";
const TMDB_KEY = "52a1d7f550504d909030616970769a93"; // Key publik demo

// Jalankan fungsi load rekomendasi saat web dibuka
window.onload = () => {
    loadRecommendations();
};

async function loadRecommendations() {
    const grid = document.getElementById('recommendationGrid');
    try {
        const response = await fetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_KEY}`);
        const data = await response.json();
        renderMovies(data.results, grid);
    } catch (error) {
        grid.innerHTML = '<p class="text-gray-500">Gagal memuat rekomendasi.</p>';
    }
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    const searchSection = document.getElementById('searchSection');
    const resultsGrid = document.getElementById('resultsGrid');
    
    if (!query) return;

    searchSection.classList.remove('hidden');
    resultsGrid.innerHTML = '<p class="col-span-full">Mencari...</p>';

    try {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}`);
        const data = await response.json();
        renderMovies(data.results, resultsGrid);
        window.scrollTo({ top: searchSection.offsetTop - 20, behavior: 'smooth' });
    } catch (error) {
        resultsGrid.innerHTML = '<p class="text-red-500">Terjadi kesalahan.</p>';
    }
}

// Fungsi reusable untuk menampilkan card film
function renderMovies(movies, container) {
    container.innerHTML = '';
    movies.forEach(movie => {
        if (!movie.poster_path) return; // Lewati jika tidak ada poster

        const card = document.createElement('div');
        card.className = "bg-slate-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition border border-slate-700 shadow-lg";
        card.innerHTML = `
            <div class="relative">
                <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}" class="w-full h-64 object-cover">
                <div class="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
                    ⭐ ${movie.vote_average.toFixed(1)}
                </div>
            </div>
            <div class="p-3">
                <h3 class="font-medium text-sm truncate">${movie.title}</h3>
                <p class="text-xs text-gray-400">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
            </div>
        `;
        card.onclick = () => playMovie(movie.id, movie.title);
        container.appendChild(card);
    });
}

function playMovie(id, title) {
    const playerContainer = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    const titleHeader = document.getElementById('currentTitle');

    // Integrasi dengan API vidapi.ru
    iframe.src = `https://vidapi.ru/api?tmdb=${id}`;
    
    titleHeader.innerText = `Sedang Menonton: ${title}`;
    playerContainer.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
