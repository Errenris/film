// api/movies.js
export default async function handler(req, res) {
    // Kita pisahkan 'path' (tujuan) dan parameter lain seperti 'page' atau 'query'
    const { path, ...otherParams } = req.query; 
    const TMDB_KEY = process.env.TMDB_KEY;

    // Buat URL utama ke TMDB
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.searchParams.append('api_key', TMDB_KEY);
    url.searchParams.append('language', 'id-ID');

    // LOOP SAKTI: Otomatis memasukkan perintah 'page' atau 'query' dari web kamu
    for (const key in otherParams) {
        if (otherParams[key]) {
            url.searchParams.append(key, otherParams[key]);
        }
    }

    try {
        const response = await fetch(url.toString());
        const data = await response.json();
        
        // Cache supaya web tetap ngebut
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: 'Error memuat API' });
    }
}
