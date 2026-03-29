// /api/rss.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.query.url;
  if (!url) return res.status(400).send('no url');

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(response.status).send(`Upstream error: ${response.status}`);
    }

    const text = await response.text();
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).send(text);

  } catch (e) {
    return res.status(500).send(e.message);
  }
}
