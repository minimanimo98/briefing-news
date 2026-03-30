// /api/fear-greed.js
// 한국 ETF 투자자용 공포/탐욕 지수
// 코스피, 코스닥, 나스닥, VIX, 52주 고저 데이터로 계산

async function fetchQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=60d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) || [];
    return {
      price: meta.regularMarketPrice,
      prev: meta.previousClose,
      high52: meta.fiftyTwoWeekHigh,
      low52: meta.fiftyTwoWeekLow,
      closes, // 최근 60일 종가
    };
  } catch(e) {
    return null;
  }
}

function calcScore(data) {
  const scores = [];
  const details = [];

  // 1. 코스피 모멘텀 (0~25점)
  if (data.kospi && data.kospi.prev) {
    const pct = ((data.kospi.price - data.kospi.prev) / data.kospi.prev) * 100;
    let score;
    if (pct >= 2)       score = 25;
    else if (pct >= 1)  score = 20;
    else if (pct >= 0)  score = 15;
    else if (pct >= -1) score = 10;
    else if (pct >= -2) score = 5;
    else                score = 0;
    scores.push(score);
    details.push({ label: '코스피 등락', value: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', score, max: 25 });
  }

  // 2. 코스닥 모멘텀 (0~20점)
  if (data.kosdaq && data.kosdaq.prev) {
    const pct = ((data.kosdaq.price - data.kosdaq.prev) / data.kosdaq.prev) * 100;
    let score;
    if (pct >= 2)       score = 20;
    else if (pct >= 1)  score = 16;
    else if (pct >= 0)  score = 12;
    else if (pct >= -1) score = 8;
    else if (pct >= -2) score = 4;
    else                score = 0;
    scores.push(score);
    details.push({ label: '코스닥 등락', value: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', score, max: 20 });
  }

  // 3. VIX 공포지수 역산 (0~25점) - VIX 높을수록 공포
  if (data.vix) {
    const vix = data.vix.price;
    let score;
    if (vix <= 15)      score = 25;
    else if (vix <= 20) score = 20;
    else if (vix <= 25) score = 15;
    else if (vix <= 30) score = 8;
    else if (vix <= 40) score = 3;
    else                score = 0;
    scores.push(score);
    details.push({ label: 'VIX 변동성', value: vix.toFixed(1), score, max: 25 });
  }

  // 4. 코스피 52주 위치 (0~15점)
  if (data.kospi && data.kospi.high52 && data.kospi.low52) {
    const range = data.kospi.high52 - data.kospi.low52;
    const pos = range > 0 ? ((data.kospi.price - data.kospi.low52) / range) * 100 : 50;
    let score;
    if (pos >= 80)      score = 15;
    else if (pos >= 60) score = 12;
    else if (pos >= 40) score = 9;
    else if (pos >= 20) score = 5;
    else                score = 2;
    scores.push(score);
    details.push({ label: '연중 위치', value: pos.toFixed(0) + '%', score, max: 15 });
  }

  // 5. 나스닥 글로벌 심리 (0~15점)
  if (data.nasdaq && data.nasdaq.prev) {
    const pct = ((data.nasdaq.price - data.nasdaq.prev) / data.nasdaq.prev) * 100;
    let score;
    if (pct >= 1.5)     score = 15;
    else if (pct >= 0.5)score = 12;
    else if (pct >= 0)  score = 9;
    else if (pct >= -1) score = 5;
    else if (pct >= -2) score = 2;
    else                score = 0;
    scores.push(score);
    details.push({ label: '나스닥 등락', value: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', score, max: 15 });
  }

  const total = scores.reduce((a, b) => a + b, 0);
  const maxTotal = details.reduce((a, b) => a + b.max, 0);
  const index = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 50;

  let label, color, emoji;
  if (index >= 75)      { label = '극단적 탐욕'; color = '#e8001a'; emoji = '🔥'; }
  else if (index >= 55) { label = '탐욕';        color = '#ff6b35'; emoji = '😏'; }
  else if (index >= 45) { label = '중립';        color = '#f0a500'; emoji = '😐'; }
  else if (index >= 25) { label = '공포';        color = '#4a90d9'; emoji = '😨'; }
  else                  { label = '극단적 공포'; color = '#1a6ce8'; emoji = '😱'; }

  return { index, label, color, emoji, details };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900'); // 15분 캐시

  try {
    const [kospi, kosdaq, vix, nasdaq] = await Promise.all([
      fetchQuote('^KS11'),
      fetchQuote('^KQ11'),
      fetchQuote('^VIX'),
      fetchQuote('^IXIC'),
    ]);

    const result = calcScore({ kospi, kosdaq, vix, nasdaq });
    return res.status(200).json(result);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
