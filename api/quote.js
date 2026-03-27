const https = require('https');

module.exports = function handler(req, res) {
  const symbols = '%5EKS11,%5EKQ11,KRW%3DX,GC%3DF,%5ETNX';
  const options = {
    hostname: 'query1.finance.yahoo.com',
    path: `/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChangePercent`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com'
    }
  };

  https.get(options, (r) => {
    let data = '';
    r.on('data', chunk => data += chunk);
    r.on('end', () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 's-maxage=60');
      res.send(data);
    });
  }).on('error', (e) => {
    res.status(500).json({ error: e.message });
  });
};
