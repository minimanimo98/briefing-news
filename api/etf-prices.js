// /api/etf-prices.js
// 개인투자자 인기 ETF 시세 (Yahoo Finance .KS)

const ETF_LIST = [
  // 반도체
  { code: '091160.KS', name: 'KODEX반도체', theme: '반도체' },
  { code: '395160.KS', name: 'KODEX AI반도체핵심', theme: '반도체' },
  { code: '484480.KS', name: 'TIGER AI반도체소부장', theme: '반도체' },
  { code: '462900.KS', name: 'TIGER반도체TOP10', theme: '반도체' },
  { code: '396500.KS', name: 'ACE글로벌반도체TOP4', theme: '반도체' },
  // AI
  { code: '381170.KS', name: 'TIGER글로벌AI', theme: 'AI' },
  { code: '474220.KS', name: 'KODEX미국AI테크TOP10', theme: 'AI' },
  { code: '487290.KS', name: 'TIGER미국AI반도체나스닥', theme: 'AI' },
  { code: '452340.KS', name: 'ACE미국빅테크TOP7', theme: 'AI' },
  { code: '476820.KS', name: 'HANARO글로벌AI반도체', theme: 'AI' },
  // 로봇
  { code: '487270.KS', name: 'KODEX글로벌로봇', theme: '로봇' },
  { code: '468380.KS', name: 'TIGER로봇AI', theme: '로봇' },
  { code: '441680.KS', name: 'ACE글로벌로보틱스', theme: '로봇' },
  { code: '448510.KS', name: 'HANARO글로벌로봇', theme: '로봇' },
  { code: '445290.KS', name: 'KODEX로봇액티브', theme: '로봇' },
  // 원자력
  { code: '456080.KS', name: 'KODEX원자력', theme: '원자력' },
  { code: '447680.KS', name: 'TIGER원자력', theme: '원자력' },
  { code: '457170.KS', name: 'ACE원자력', theme: '원자력' },
  { code: '459580.KS', name: 'HANARO원자력', theme: '원자력' },
  { code: '463050.KS', name: 'KBSTAR원자력', theme: '원자력' },
  // 조선/방산
  { code: '457490.KS', name: 'TIGER방산', theme: '조선/방산' },
  { code: '466920.KS', name: 'KODEX조선', theme: '조선/방산' },
  { code: '466940.KS', name: 'TIGER조선TOP10', theme: '조선/방산' },
  { code: '471440.KS', name: 'KODEX글로벌방산', theme: '조선/방산' },
  { code: '459580.KS', name: 'ACE방산', theme: '조선/방산' },
  // 2차전지
  { code: '305540.KS', name: 'TIGER2차전지', theme: '2차전지' },
  { code: '305720.KS', name: 'KODEX2차전지', theme: '2차전지' },
  { code: '438330.KS', name: 'TIGER2차전지소부장', theme: '2차전지' },
  { code: '364980.KS', name: 'KBSTAR2차전지', theme: '2차전지' },
  { code: '371460.KS', name: 'ACE2차전지', theme: '2차전지' },
  // 미국
  { code: '360750.KS', name: 'TIGER미국S&P500', theme: '미국' },
  { code: '133690.KS', name: 'TIGER나스닥100', theme: '미국' },
  { code: '379800.KS', name: 'KODEX미국S&P500', theme: '미국' },
  { code: '133690.KS', name: 'KODEX나스닥100', theme: '미국' },
  { code: '278540.KS', name: 'KODEX미국S&P500TR', theme: '미국' },
  // 인버스/레버리지
  { code: '114800.KS', name: 'KODEX인버스', theme: '인버스/레버리지' },
  { code: '252670.KS', name: 'KODEX200선물인버스2X', theme: '인버스/레버리지' },
  { code: '122630.KS', name: 'KODEX레버리지', theme: '인버스/레버리지' },
  { code: '219905.KS', name: 'KODEX코스닥150레버리지', theme: '인버스/레버리지' },
  { code: '251340.KS', name: 'KODEX코스닥150인버스', theme: '인버스/레버리지' },
  // 금/원자재
  { code: '411060.KS', name: 'ACE KRX금현물', theme: '금/원자재' },
  { code: '319640.KS', name: 'TIGER원유선물', theme: '금/원자재' },
  { code: '132030.KS', name: 'KODEX골드선물', theme: '금/원자재' },
  { code: '261220.KS', name: 'KODEX WTI원유선물', theme: '금/원자재' },
  { code: '444580.KS', name: 'ACE구리실물', theme: '금/원자재' },
  // 바이오
  { code: '227540.KS', name: 'TIGER바이오', theme: '바이오' },
  { code: '203780.KS', name: 'TIGER헬스케어', theme: '바이오' },
  { code: '244580.KS', name: 'KODEX바이오', theme: '바이오' },
  { code: '385510.KS', name: 'TIGER글로벌헬스케어', theme: '바이오' },
  { code: '449190.KS', name: 'ACE바이오헬스케어', theme: '바이오' },
  // 배당/리츠
  { code: '292190.KS', name: 'TIGER미국배당다우존스', theme: '배당/리츠' },
  { code: '448290.KS', name: 'TIGER미국배당+3%프리미엄', theme: '배당/리츠' },
  { code: '360200.KS', name: 'KODEX배당가치', theme: '배당/리츠' },
  { code: '441640.KS', name: 'ACE미국배당다우존스', theme: '배당/리츠' },
  { code: '395160.KS', name: 'TIGER리츠부동산인프라', theme: '배당/리츠' },
];

async function fetchPrice(etf) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.code}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose;
    const change = price - prev;
    const pct = ((change / prev) * 100).toFixed(2);
    const up = change >= 0;

    return {
      code: etf.code,
      name: etf.name,
      theme: etf.theme,
      price: Math.round(price).toLocaleString(),
      change: (up ? '+' : '') + Math.round(change).toLocaleString(),
      pct: (up ? '+' : '') + pct + '%',
      up,
    };
  } catch(e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300'); // 5분 캐시

  try {
    const results = await Promise.all(ETF_LIST.map(fetchPrice));
    const etfs = results.filter(Boolean);

    // 테마별 그룹핑
    const themes = {};
    etfs.forEach(e => {
      if (!themes[e.theme]) themes[e.theme] = [];
      themes[e.theme].push(e);
    });

    return res.status(200).json({ etfs, themes });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
