const API_BASE = "https://vidapi.ru/api"; // Endpoint dari link yang kamu berikan

// Fungsi pencarian menggunakan TMDB (Opsional, atau gunakan input ID langsung)
// Karena vidapi.ru biasanya membutuhkan ID TMDB/IMDb, kita butuh data filmnya dulu.
async function searchMovie() {
    const query = document.getElementById('searchInput').value;
    const grid = document.getElementById('resultsGrid');
    
    if (!query) return;

    grid.innerHTML = '<p class="col-span-full text-center">Mencari film...</p>';

    try {
        // Kita gunakan API publik TMDB untuk mencari ID film berdasarkan judul
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=52a1d7f550504d909030616970769a93&query=${query}`);
        const data = await response.json();

        grid.innerHTML = '';
        data.results.forEach(movie => {
            const card = document.createElement('div');
            card.className = "bg-slate-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition border border-slate-700";
            card.innerHTML = `
                <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}" class="w-full h-64 object-cover">
                <div class="p-3">
                    <h3 class="font-medium text-sm truncate">${movie.title}</h3>
                    <p class="text-xs text-gray-400">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
                </div>
            `;
            card.onclick = () => playMovie(movie.id, movie.title);
            grid.appendChild(card);
        });
    } catch (error) {
        grid.innerHTML = '<p class="col-span-full text-center text-red-500">Gagal memuat data.</p>';
    }
}

function playMovie(id, title) {
    const playerContainer = document.getElementById('playerContainer');
    const iframe = document.getElementById('videoPlayer');
    const titleHeader = document.getElementById('currentTitle');

    // Format URL vidapi.ru biasanya menggunakan tmdb_id
    // Contoh: https://vidapi.ru/api/movie/{tmdb_id} atau via query params
    iframe.src = `https://vidapi.ru/api?tmdb=${id}`;
    
    titleHeader.innerText = `Memutar: ${title}`;
    playerContainer.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
