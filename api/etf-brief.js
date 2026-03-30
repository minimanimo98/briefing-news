// /api/etf-brief.js
// ETF 클릭 시 해당 ETF 관련 뉴스 기반 AI 브리핑

const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const ETF_KEYWORDS = {
  '091160.KS': 'KODEX 반도체 ETF',
  '395160.KS': 'AI 반도체 ETF',
  '484480.KS': 'AI 반도체 소부장 ETF',
  '472160.KS': '글로벌 로봇 ETF',
  '468380.KS': '로봇 AI ETF',
  '441680.KS': '로보틱스 ETF',
  '456080.KS': '원자력 ETF KODEX',
  '447680.KS': '원자력 ETF TIGER',
  '457170.KS': '원자력 ETF ACE',
  '457490.KS': '방산 ETF 한국',
  '466920.KS': '조선 ETF',
  '466940.KS': '조선 ETF TOP10',
  '305540.KS': '2차전지 ETF TIGER',
  '305720.KS': '2차전지 ETF KODEX',
  '360750.KS': '미국 S&P500 ETF',
  '133690.KS': '나스닥 ETF 한국',
  '379800.KS': '미국 S&P500 ETF KODEX',
  '487290.KS': '미국 AI 반도체 나스닥 ETF',
  '114800.KS': '코스피 인버스 ETF',
  '252670.KS': '코스피 인버스 2배 ETF',
  '122630.KS': '코스피 레버리지 ETF',
  '411060.KS': '금 ETF 한국',
  '319640.KS': '원유 ETF 한국',
  '227540.KS': '바이오 ETF 한국',
  '203780.KS': '헬스케어 ETF 한국',
  '292190.KS': '미국 배당 ETF',
  '448290.KS': '미국 배당 프리미엄 ETF',
};

async function fetchETFNews(etfCode, etfName) {
  const keyword = ETF_KEYWORDS[etfCode] || etfName.replace('TIGER','').replace('KODEX','').replace('ACE','').trim();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(url)}`);
    const text = await res.text();
    let titles = [...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(m => m[1]);
    if (titles.length <= 1) {
      titles = [...text.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
    }
    return titles.slice(1, 6).map(t => t.replace(/\s+-\s+.+$/, '').trim());
  } catch(e) {
    return [];
  }
}

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

  // 캐시 키 (ETF코드 + 날짜)
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `etf_brief_${etfCode}_${today}`;

  try {
    // Supabase 캐시 확인
    const cacheRes = await fetch(
      `${SUPABASE_URL}/rest/v1/etf_brief_cache?cache_key=eq.${cacheKey}&select=brief`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      }
    );
    const cacheData = await cacheRes.json();
    if (cacheData?.[0]?.brief) {
      return res.status(200).json({ brief: cacheData[0].brief, cached: true });
    }

    // 뉴스 가져오기
    const titles = await fetchETFNews(etfCode, etfName);

    const newsText = titles.length
      ? titles.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : '관련 뉴스 없음';

    const prompt = `당신은 ETF 투자 전문가입니다.
아래 ETF의 현재 시세와 관련 뉴스를 보고, 개인투자자에게 쉽게 설명해주세요.

ETF: ${etfName}
현재가: ${price}원 (${pct})

관련 뉴스:
${newsText}

아래 3가지를 각각 한 줄로 작성하세요:
- 20자 이내로 짧고 명확하게
- 마침표 금지, 명사형 종결
- 중학생도 이해할 수 있는 쉬운 말
- 이모지 없이

반드시 아래 형식 그대로만 출력:

[지금상황] 이 ETF 오늘 왜 이러는지 한 줄
[핵심뉴스] 가장 관련 높은 뉴스 한 줄
[투자힌트] 지금 이 ETF 어떻게 볼지 한 줄`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const brief = data?.content?.[0]?.text || '브리핑 실패';

    // 캐시 저장
    if (brief !== '브리핑 실패') {
      await fetch(`${SUPABASE_URL}/rest/v1/etf_brief_cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          cache_key: cacheKey,
          brief,
          created_at: new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json({ brief });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
