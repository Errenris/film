// api/movies.js
export default async function handler(req, res) {
    const { path, query } = req.query;
    const TMDB_KEY = process.env.TMDB_KEY; // Ambil dari Vercel Settings
    
    // Bangun URL TMDB secara dinamis
    const baseUrl = `https://api.themoviedb.org/3/${path}?api_key=${TMDB_KEY}&language=id-ID`;
    const finalUrl = query ? `${baseUrl}&query=${encodeURIComponent(query)}` : baseUrl;

    try {
        const response = await fetch(finalUrl);
        const data = await response.json();
        res.setHeader('Cache-Control', 's-maxage=3600'); // Cache 1 jam agar hemat limit
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Gagal mengambil data dari TMDB' });
    }
}
