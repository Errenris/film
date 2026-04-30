const IMG_PATH = "https://image.tmdb.org/t/p/w342";
const BACK_PATH = "https://image.tmdb.org/t/p/original";

// State Pagination
let currentPage = 1;
let currentAction = ''; // 'category' atau 'search'
let currentPath = '';
let currentQuery = '';

// State Hero Carousel
let featuredMovies = [];
let currentHeroIndex = 0;
let carouselTimer;

window.onload = () => {
    initApp();
};

async function initApp() {
    // 1. Hero Carousel 10 Teratas
    const res = await fetch(`/api/movies?path=trending/all/day`);
    const data = await res.json();
    featuredMovies = data.results.slice(0, 10);
    updateHero();
    startCarousel();

    // 2. Isi Baris Home (Halaman 1 Saja Biar Ringan)
    fetchAndRender('movie/popular', 'row1');
    fetchAndRender('tv/popular', 'row2');
}

// --- LOGIKA MENU, SEARCH & LOAD MORE ---
function showSection(type) {
    document.getElementById('homeView').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('heroSection').style.display = type === 'home' ? 'block' : 'none';
    if(type === 'home') {
        document.getElementById('gridSection').classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function loadCategory(path, label) {
    showSection('grid');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = label;
    
    // Reset Data
    currentPage = 1;
    currentAction = 'category';
    currentPath = path;
    
    const container = document.getElementById('gridResults');
    container.innerHTML = '<p class="text-white w-full text-center py-10">Memuat film...</p>';
    document.getElementById('loadMoreBtn').classList.add('hidden'); // Sembunyikan dulu
    
    // Tarik Halaman 1
    const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}&page=${currentPage}`);
    const data = await res.json();
    
    renderCards(data.results, container, false, path.includes('tv'));
    
    if(data.total_pages > 1) {
        document.getElementById('loadMoreBtn').classList.remove('hidden');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    showSection('grid');
    document.getElementById('gridSection').classList.remove('hidden');
    document.getElementById('gridTitle').innerText = `Pencarian: "${query}"`;
    
    // Reset Data
    currentPage = 1;
    currentAction = 'search';
    currentQuery = query;
    
    const container = document.getElementById('gridResults');
    container.innerHTML = '<p class="text-white w-full text-center py-10">Mencari...</p>';
    document.getElementById('loadMoreBtn').classList.add('hidden');
    
    const res = await fetch(`/api/movies?path=search/multi&query=${encodeURIComponent(query)}&page=${currentPage}`);
    const data = await res.json();
    
    if(data.results.length === 0) {
        container.innerHTML = '<p class="text-red-400 w-full text-center py-10">Film tidak ditemukan.</p>';
    } else {
        renderCards(data.results, container, false);
        if(data.total_pages > 1) document.getElementById('loadMoreBtn').classList.remove('hidden');
    }
    
    document.getElementById('gridSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadMore() {
    currentPage++; // Naikkan halaman
    const btn = document.getElementById('loadMoreBtn');
    btn.innerText = 'Memuat Halaman Berikutnya...';
    
    let url = '';
    let isTV = false;

    if (currentAction === 'category') {
        url = `/api/movies?path=${encodeURIComponent(currentPath)}&page=${currentPage}`;
        isTV = currentPath.includes('tv');
    } else if (currentAction === 'search') {
        url = `/api/movies?path=search/multi&query=${encodeURIComponent(currentQuery)}&page=${currentPage}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    
    // APPEND (Tambahkan ke list yang sudah ada)
    renderCards(data.results, document.getElementById('gridResults'), true, isTV);
    
    btn.innerText = '↻ Muat Lebih Banyak';
    
    // Jika sudah mentok halaman terakhir, sembunyikan tombol
    if(currentPage >= data.total_pages) {
        btn.classList.add('hidden');
    }
}

// --- LOGIKA TAMPILAN KARTU FILM ---
async function fetchAndRender(path, elementId) {
    const res = await fetch(`/api/movies?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    renderCards(data.results, document.getElementById(elementId), false, path.includes('tv'));
}

function renderCards(movies, container, append = false, isTV = false) {
    if (!append) container.innerHTML = ''; // Hapus jika bukan load more

    movies.forEach(movie => {
        if (!movie.poster_path) return;
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

// --- LOGIKA LAINNYA (Sama) ---
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

function sideScroll(elementId, direction) {
    const container = document.getElementById(elementId);
    const amount = container.clientWidth * 0.7; 
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}

function playMovie(id, title, type = 'movie') {
    const player = document.getElementById('playerContainer');
    document.getElementById('videoPlayer').src = `https://vidapi.ru/embed/${type === 'tv' ? 'tv' : 'movie'}/${id}`;
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
