export default async function handler(req, res) {

    const response = await fetch(
        `https://api.themoviedb.org/3/trending/movie/week?api_key=${process.env.TMDB_KEY}`
    );

    const data = await response.json();

    res.status(200).json(data);
}
