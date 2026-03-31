// /api/etf-prices.js
// TIGER(미래에셋), KODEX(삼성), ACE(한국투자) 3대 운용사 ETF
// 총 ~150개, 17개 테마

const ETF_LIST = [
  // 반도체
  { code: '091160.KS', name: 'KODEX반도체', theme: '반도체' },
  { code: '471990.KS', name: 'KODEX AI반도체핵심장비', theme: '반도체' },
  { code: '462900.KS', name: 'TIGER반도체TOP10', theme: '반도체' },
  { code: '396500.KS', name: 'ACE글로벌반도체TOP4Plus', theme: '반도체' },
  { code: '289040.KS', name: 'TIGER미국필라델피아반도체나스닥', theme: '반도체' },
  { code: '396520.KS', name: 'ACE AI반도체핵심소부장', theme: '반도체' },
  { code: '494800.KS', name: 'TIGER반도체소부장', theme: '반도체' },

  // AI
  { code: '381170.KS', name: 'TIGER글로벌AI', theme: 'AI' },
  { code: '474220.KS', name: 'KODEX미국AI테크TOP10', theme: 'AI' },
  { code: '487290.KS', name: 'TIGER미국AI반도체나스닥', theme: 'AI' },
  { code: '452340.KS', name: 'ACE미국빅테크TOP7', theme: 'AI' },
  { code: '489560.KS', name: 'KODEX미국AI소프트웨어', theme: 'AI' },
  { code: '484480.KS', name: 'TIGER AI반도체소부장', theme: 'AI' },
  { code: '466940.KS', name: 'ACE AI인프라', theme: 'AI' },

  // 로봇
  { code: '445290.KS', name: 'KODEX K-로봇액티브', theme: '로봇' },
  { code: '468380.KS', name: 'TIGER로봇AI', theme: '로봇' },
  { code: '441680.KS', name: 'ACE글로벌로보틱스', theme: '로봇' },
  { code: '472160.KS', name: 'KODEX글로벌로봇', theme: '로봇' },
  { code: '483440.KS', name: 'TIGER미국로봇산업액티브', theme: '로봇' },
  { code: '494820.KS', name: 'ACE글로벌물리AI로봇', theme: '로봇' },
  { code: '486250.KS', name: 'KODEX미국로봇AI', theme: '로봇' },

  // 원자력
  { code: '434730.KS', name: 'HANARO원자력iSelect', theme: '원자력' },
  { code: '433500.KS', name: 'ACE원자력TOP10', theme: '원자력' },
  { code: '456080.KS', name: 'KODEX원자력', theme: '원자력' },
  { code: '447680.KS', name: 'TIGER원자력', theme: '원자력' },
  { code: '442320.KS', name: 'RISE글로벌원자력', theme: '원자력' },
  { code: '480420.KS', name: 'KODEX미국원자력SMR', theme: '원자력' },
  { code: '481060.KS', name: 'ACE미국원자력SMR', theme: '원자력' },

  // 조선
  { code: '494670.KS', name: 'TIGER조선TOP10', theme: '조선' },
  { code: '466920.KS', name: 'SOL조선TOP3플러스', theme: '조선' },
  { code: '468260.KS', name: 'ACE조선해운', theme: '조선' },
  { code: '489190.KS', name: 'KODEX K조선TOP10', theme: '조선' },
  { code: '490080.KS', name: 'TIGER조선기자재', theme: '조선' },

  // 방산
  { code: '449450.KS', name: 'PLUS K방산', theme: '방산' },
  { code: '463250.KS', name: 'TIGER K방산&우주', theme: '방산' },
  { code: '459870.KS', name: 'ACE K방산&우주TOP10', theme: '방산' },
  { code: '480190.KS', name: 'KODEX K방산TOP10', theme: '방산' },
  { code: '492760.KS', name: 'TIGER글로벌방산', theme: '방산' },
  { code: '492040.KS', name: 'ACE유럽방산TOP10', theme: '방산' },
  { code: '489230.KS', name: 'KODEX글로벌방산', theme: '방산' },

  // 2차전지
  { code: '305540.KS', name: 'TIGER2차전지테마', theme: '2차전지' },
  { code: '305720.KS', name: 'KODEX2차전지산업', theme: '2차전지' },
  { code: '438330.KS', name: 'TIGER2차전지소재Fn', theme: '2차전지' },
  { code: '371460.KS', name: 'ACE2차전지&배터리', theme: '2차전지' },
  { code: '473680.KS', name: 'KODEX2차전지소재', theme: '2차전지' },
  { code: '480300.KS', name: 'TIGER전고체배터리', theme: '2차전지' },
  { code: '480310.KS', name: 'ACE전고체배터리', theme: '2차전지' },

  // 전력인프라
  { code: '457990.KS', name: 'TIGER전력설비', theme: '전력인프라' },
  { code: '466400.KS', name: 'KODEX전력설비', theme: '전력인프라' },
  { code: '466410.KS', name: 'ACE전력인프라', theme: '전력인프라' },
  { code: '478590.KS', name: 'TIGER미국전력인프라', theme: '전력인프라' },
  { code: '478600.KS', name: 'KODEX미국전력인프라', theme: '전력인프라' },
  { code: '478610.KS', name: 'ACE미국전력핵심인프라', theme: '전력인프라' },
  { code: '491830.KS', name: 'TIGER글로벌ESS', theme: '전력인프라' },

  // 우주항공/드론
  { code: '463250.KS', name: 'TIGER K방산&우주', theme: '우주항공' },
  { code: '465070.KS', name: 'KODEX우주항공', theme: '우주항공' },
  { code: '465080.KS', name: 'ACE우주항공&UAM', theme: '우주항공' },
  { code: '476040.KS', name: 'TIGER미국우주항공방산', theme: '우주항공' },
  { code: '480050.KS', name: 'KODEX미국드론UAM', theme: '우주항공' },
  { code: '480060.KS', name: 'ACE글로벌드론항공', theme: '우주항공' },

  // 미국
  { code: '360750.KS', name: 'TIGER미국S&P500', theme: '미국' },
  { code: '133690.KS', name: 'TIGER나스닥100', theme: '미국' },
  { code: '379800.KS', name: 'KODEX미국S&P500TR', theme: '미국' },
  { code: '367380.KS', name: 'KODEX나스닥100TR', theme: '미국' },
  { code: '391600.KS', name: 'ACE미국S&P500', theme: '미국' },
  { code: '429000.KS', name: 'TIGER미국S&P500배당귀족', theme: '미국' },
  { code: '452340.KS', name: 'ACE미국빅테크TOP7', theme: '미국' },

  // 글로벌(중국/인도/일본 등)
  { code: '371160.KS', name: 'TIGER차이나전기차SOLACTIVE', theme: '글로벌' },
  { code: '302430.KS', name: 'KODEX차이나항셍테크', theme: '글로벌' },
  { code: '200250.KS', name: 'KODEX차이나H레버리지', theme: '글로벌' },
  { code: '441800.KS', name: 'TIGER인도니프티50', theme: '글로벌' },
  { code: '441810.KS', name: 'KODEX인도Nifty50', theme: '글로벌' },
  { code: '241180.KS', name: 'TIGER일본니케이225', theme: '글로벌' },
  { code: '452990.KS', name: 'ACE인도시장대표BOM30', theme: '글로벌' },

  // 바이오
  { code: '227540.KS', name: 'TIGER바이오테크', theme: '바이오' },
  { code: '261070.KS', name: 'TIGER코스닥150바이오테크', theme: '바이오' },
  { code: '244580.KS', name: 'KODEX바이오', theme: '바이오' },
  { code: '203780.KS', name: 'TIGER헬스케어', theme: '바이오' },
  { code: '385510.KS', name: 'TIGER글로벌헬스케어', theme: '바이오' },
  { code: '462640.KS', name: 'ACE글로벌바이오', theme: '바이오' },
  { code: '487030.KS', name: 'KODEX바이오액티브', theme: '바이오' },

  // 인버스/레버리지
  { code: '114800.KS', name: 'KODEX인버스', theme: '인버스/레버리지' },
  { code: '252670.KS', name: 'KODEX200선물인버스2X', theme: '인버스/레버리지' },
  { code: '122630.KS', name: 'KODEX레버리지', theme: '인버스/레버리지' },
  { code: '219905.KS', name: 'KODEX코스닥150레버리지', theme: '인버스/레버리지' },
  { code: '251340.KS', name: 'KODEX코스닥150인버스', theme: '인버스/레버리지' },
  { code: '275290.KS', name: 'TIGER미국S&P500선물인버스', theme: '인버스/레버리지' },
  { code: '233740.KS', name: 'KODEX나스닥100레버리지', theme: '인버스/레버리지' },

  // 금/원자재
  { code: '411060.KS', name: 'ACE KRX금현물', theme: '금/원자재' },
  { code: '319640.KS', name: 'TIGER원유선물Enhanced', theme: '금/원자재' },
  { code: '132030.KS', name: 'KODEX골드선물(H)', theme: '금/원자재' },
  { code: '261220.KS', name: 'KODEX WTI원유선물(H)', theme: '금/원자재' },
  { code: '444580.KS', name: 'ACE구리실물', theme: '금/원자재' },
  { code: '411070.KS', name: 'TIGER금은선물', theme: '금/원자재' },
  { code: '475080.KS', name: 'ACE미국원자재', theme: '금/원자재' },

  // 배당/커버드콜
  { code: '292190.KS', name: 'TIGER미국배당다우존스', theme: '배당/커버드콜' },
  { code: '448290.KS', name: 'TIGER미국배당+3%프리미엄', theme: '배당/커버드콜' },
  { code: '441640.KS', name: 'KODEX미국배당프리미엄액티브', theme: '배당/커버드콜' },
  { code: '360200.KS', name: 'KODEX배당가치', theme: '배당/커버드콜' },
  { code: '429000.KS', name: 'TIGER미국S&P500배당귀족', theme: '배당/커버드콜' },
  { code: '480930.KS', name: 'TIGER나스닥100커버드콜', theme: '배당/커버드콜' },
  { code: '480940.KS', name: 'ACE미국500커버드콜', theme: '배당/커버드콜' },
];

async function fetchPrice(etf) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.code}?interval=1d&range=2d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose;
    if (!price || !prev) return null;
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
  res.setHeader('Cache-Control', 's-maxage=300');
  try {
    const results = await Promise.all(ETF_LIST.map(fetchPrice));
    const etfs = results.filter(Boolean);
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
