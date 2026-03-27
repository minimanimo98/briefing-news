const https = require('https');
const http = require('http');

module.exports = function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('no url');

  const client = url.startsWith('https') ? https : http;

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    }
  };

  client.get(url, options, (r) => {
    let data = '';
    r.on('data', chunk => data += chunk);
    r.on('end', () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      res.send(data);
    });
  }).on('error', (e) => {
    res.status(500).send(e.message);
  });
};
