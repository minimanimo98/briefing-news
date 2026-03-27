export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('no url');
  try {
    const response = await fetch(url);
    const text = await response.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/xml');
    res.send(text);
  } catch(e) {
    res.status(500).send(e.message);
  }
}
