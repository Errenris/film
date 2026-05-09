const ONLINE_KEY = 'nobargasi:live:visitors';
const ONLINE_TTL_MS = 75 * 1000;

export default async function handler(req, res) {
    try {
        const kvUrl = process.env.KV_REST_API_URL;
        const kvToken = process.env.KV_REST_API_TOKEN;

        if (!kvUrl || !kvToken) {
            return res.status(500).json({
                ok: false,
                error: 'KV_REST_API_URL dan KV_REST_API_TOKEN belum diisi.'
            });
        }

        const visitorId = cleanVisitorId(req.query.id || '');

        if (!visitorId) {
            return res.status(400).json({
                ok: false,
                error: 'Visitor ID kosong.'
            });
        }

        const now = Date.now();
        const expiredBefore = now - ONLINE_TTL_MS;

        await redisCommand(['zadd', ONLINE_KEY, now, visitorId]);
        await redisCommand(['zremrangebyscore', ONLINE_KEY, 0, expiredBefore]);

        const countData = await redisCommand(['zcard', ONLINE_KEY]);
        const online = Number(countData.result || 0);

        res.setHeader('Cache-Control', 'no-store');

        return res.status(200).json({
            ok: true,
            online
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: err.message
        });
    }
}

async function redisCommand(args) {
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    const path = args.map(arg => encodeURIComponent(String(arg))).join('/');

    const response = await fetch(`${kvUrl}/${path}`, {
        headers: {
            Authorization: `Bearer ${kvToken}`
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Redis command gagal.');
    }

    return data;
}

function cleanVisitorId(id) {
    return String(id)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 80);
}
