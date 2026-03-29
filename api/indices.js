// /api/indices.js - 한중일 + 미국 주요 지수
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');

  const symbols = [
    { key: 'kospi',    ticker: '%5EKS11',  name: '코스피' },
    { key: 'kosdaq',   ticker: '%5EKQ11',  name: '코스닥' },
    { key: 'nikkei',   ticker: '%5EN225',  name: '닛케이' },
    { key: 'topix',    ticker: '%5ETPX',   name: 'TOPIX' },
    { key: 'shanghai', ticker: '000001.SS', name: '상하이' },
    { key: 'hk',       ticker: '%5EHSI',   name: '항셍' },
    { key: 'sp500',    ticker: '%5EGSPC',  name: 'S&P500' },
    { key: 'nasdaq',   ticker: '%5EIXIC',  name: '나스닥' },
    { key: 'dow',      ticker: '%5EDJI',   name: '다우' },
  ];

  try {
    const results = await Promise.all(
      symbols.map(s =>
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.ticker}?interval=1m&range=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }).then(r => r.json()).catch(() => null)
      )
    );

    const data = {};
    symbols.forEach((s, i) => {
      const d = results[i];
      const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      const prev  = d?.chart?.result?.[0]?.meta?.chartPreviousClose;
      if (!price || !prev) return;
      const chg = price - prev;
      const pct = chg / prev * 100;
      data[s.key] = {
        name: s.name,
        price: price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
        change: (chg >= 0 ? '+' : '') + chg.toFixed(2),
        pct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
        up: chg >= 0
      };
    });

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
