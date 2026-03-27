export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('no url');
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await response.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(text);
  } catch(e) {
    res.status(500).send(e.message);
  }
}

