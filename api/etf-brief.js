// /api/etf-brief.js - 속도 최적화 버전
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const ETF_KEYWORDS = {
  '091160.KS': '반도체 ETF', '471990.KS': 'AI반도체장비', '396500.KS': '반도체TOP10',
  '446770.KS': '글로벌반도체', '381180.KS': '미국반도체 필라델피아', '396520.KS': 'AI반도체소부장',
  '466950.KS': '글로벌AI', '485540.KS': '미국AI테크', '487290.KS': '미국AI반도체',
  '452340.KS': '미국빅테크', '484480.KS': 'AI반도체소부장', '466940.KS': 'AI인프라',
  '445290.KS': 'K로봇', '468380.KS': '로봇AI', '441680.KS': '글로벌로보틱스',
  '472160.KS': '글로벌로봇', '483440.KS': '미국로봇', '494820.KS': '물리AI로봇',
  '434730.KS': '원자력 ETF', '433500.KS': '원자력TOP10', '456080.KS': '원자력 KODEX',
  '442320.KS': '글로벌원자력', '480420.KS': '미국원자력SMR', '481060.KS': '미국SMR',
  '494670.KS': '조선TOP10', '466920.KS': '조선TOP3', '468260.KS': '조선해운',
  '489190.KS': 'K조선', '490080.KS': '조선기자재',
  '449450.KS': 'K방산', '463250.KS': 'K방산우주', '459870.KS': 'K방산우주',
  '480190.KS': 'K방산TOP10', '492760.KS': '글로벌방산', '492040.KS': '유럽방산',
  '305540.KS': '2차전지테마', '305720.KS': '2차전지산업', '371460.KS': '2차전지배터리',
  '480300.KS': '전고체배터리', '480310.KS': '전고체배터리',
  '457990.KS': '전력설비', '466400.KS': '전력설비KODEX', '478590.KS': '미국전력인프라',
  '478600.KS': '미국전력인프라', '491830.KS': '글로벌ESS',
  '0183J0.KS': '미국우주테크 스페이스X', '0180V0.KS': '미국우주테크',
  '0167Z0.KS': '미국우주항공', '0131V0.KS': '우주항공UAM',
  '465070.KS': '우주항공', '476040.KS': '미국우주항공방산',
  '360750.KS': '미국S&P500', '133690.KS': '나스닥100', '379800.KS': '미국S&P500',
  '367380.KS': '나스닥100', '391600.KS': '미국S&P500',
  '114800.KS': '코스피인버스', '252670.KS': '코스피인버스2배', '122630.KS': '코스피레버리지',
  '411060.KS': '금현물 ETF', '132030.KS': '골드선물', '319640.KS': '원유선물',
  '227540.KS': '바이오테크 ETF', '244580.KS': '바이오 ETF', '203780.KS': '헬스케어 ETF',
  '292190.KS': '미국배당ETF', '448290.KS': '미국배당프리미엄',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { etfName, etfCode, price, pct } = body;
  if (!etfName) return res.status(400).json({ error: 'ETF명 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  const today = new Date(Date.now() + 9*60*60*1000).toISOString().split('T')[0];
  const cacheKey = `etf_brief_${etfCode}_${today}`;

  try {
    // ✅ 캐시 체크 + 뉴스 fetch 병렬 실행
    const keyword = ETF_KEYWORDS[etfCode] ||
      etfName.replace(/TIGER|KODEX|ACE|PLUS|SOL|RISE|HANARO/gi, '').replace(/TOP\d+|액티브|플러스|TR/g, '').trim();

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`;

    const [cacheResult, newsResult] = await Promise.all([
      // 캐시 체크
      fetch(`${SUPABASE_URL}/rest/v1/etf_brief_cache?cache_key=eq.${cacheKey}&select=brief`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }).then(r => r.json()).catch(() => []),

      // 뉴스 fetch (3초 타임아웃)
      (async () => {
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 3000);
          const r = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(rssUrl)}`, { signal: controller.signal });
          const text = await r.text();
          const titles = [...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(m => m[1]);
          return titles.slice(1, 4).map(t => t.replace(/\s+-\s+.+$/, '').trim());
        } catch(e) { return []; }
      })()
    ]);

    // 캐시 히트
    if (cacheResult?.[0]?.brief) {
      return res.status(200).json({ brief: cacheResult[0].brief, cached: true });
    }

    // ✅ 짧은 프롬프트 + max_tokens 150
    const newsText = newsResult.length ? newsResult.map((t,i) => `${i+1}. ${t}`).join('\n') : '없음';
    const prompt = `주식 초보자에게 ETF를 쉽게 설명해주는 친절한 선생님입니다.

ETF: ${etfName} (오늘 ${pct})
관련 뉴스: ${newsText}

규칙:
- 중학생도 이해하는 쉬운 말
- 어려운 용어 금지 (변동성→가격 출렁임, 매수→사기, 매도→팔기)
- 20자 이내로 짧게
- 마침표 금지

형식 그대로 출력:
[지금상황] 오늘 왜 이런지 한마디
[핵심뉴스] 가장 중요한 뉴스 한마디
[투자힌트] 지금 어떻게 할지 한마디`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 150, // ✅ 300→150
        system: 'ETF 투자 전문가. 한국어로 간결하게 20자 이내로 답변.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const brief = data?.content?.[0]?.text || '브리핑 실패';

    // 캐시 저장 (비동기, 응답 기다리지 않음)
    if (brief !== '브리핑 실패' && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/etf_brief_cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ cache_key: cacheKey, brief, created_at: new Date().toISOString() }),
      }).catch(() => {});
    }

    return res.status(200).json({ brief });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
