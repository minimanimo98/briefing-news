export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'no url' });
  try {
    const r = await fetch(decodeURIComponent(url));
    const text = await r.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/xml');
    res.send(text);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
