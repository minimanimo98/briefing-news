// /api/econ-calendar.js
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const FMP_KEY = process.env.FMP_API_KEY;

const IMPORTANT_KEYWORDS = [
  'CPI', 'PPI', 'GDP', 'NFP', 'Nonfarm', 'FOMC', 'Federal Reserve',
  'Interest Rate', 'Unemployment', 'Retail Sales', 'PCE', 'ADP',
  'ISM', 'PMI', 'Consumer Price', 'Producer Price', 'Jobs',
  'Inflation', 'Trade Balance', 'Housing', 'Durable Goods',
];

const COUNTRY_MAP = {
  'US': '미국', 'EU': '유럽', 'UK': '영국', 'CN': '중국',
  'JP': '일본', 'KR': '한국', 'DE': '독일', 'FR': '프랑스',
};

async function fetchFMPCalendar(from, to) {
  // v4 신규 엔드포인트
  const url = `https://financialmodelingprep.com/api/v4/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .filter(e => {
      const imp = e.impact || '';
      if (imp === 'Low') return false;
      const name = e.event || '';
      return IMPORTANT_KEYWORDS.some(k => name.toLowerCase().includes(k.toLowerCase()));
    })
    .map(e => ({
      date: (e.date || '').split(' ')[0],
      name: e.event || '',
      country: COUNTRY_MAP[e.country] || e.country || '미국',
      importance: e.impact === 'High' ? 'high' : 'mid',
      actual: e.actual,
      estimate: e.estimate,
      previous: e.previous,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getDateRange(days = 14) {
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const end = new Date(now);
  end.setDate(now.getDate() + days);
  return { from: fmt(now), to: fmt(end) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, name, date } = req.query;

  // AI 해설 요청
  if (type === 'brief' && name) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const cacheKey = `econ_brief_${name.replace(/[\s/]/g,'_')}_${date || ''}`;

    try {
      const cacheRes = await fetch(
        `${SUPABASE_URL}/rest/v1/econ_brief_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=brief`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const cacheData = await cacheRes.json();
      if (cacheData?.[0]?.brief) {
        return res.status(200).json({ brief: cacheData[0].brief, cached: true });
      }
    } catch(e) {}

    const prompt = `당신은 ETF 투자 전문가입니다.
"${name}" 경제지표에 대해 ETF 개인투자자가 이해할 수 있게 설명해주세요.

아래 3가지를 각각 1~2문장으로 작성하세요:
- 중학생도 이해할 수 있는 쉬운 말
- 마침표로 끝내기
- 이모지 없이
- 관련 ETF 언급 (예: TIGER미국S&P500, 인버스ETF 등)

반드시 아래 형식 그대로만 출력:

[이게뭔가요] 이 지표가 무엇인지 쉽게 설명
[좋으면] 예상보다 좋게 나오면 시장/ETF에 어떤 영향
[나쁘면] 예상보다 나쁘게 나오면 시장/ETF에 어떤 영향`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      const brief = data?.content?.[0]?.text || '';

      if (brief) {
        await fetch(`${SUPABASE_URL}/rest/v1/econ_brief_cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ cache_key: cacheKey, brief, created_at: new Date().toISOString() }),
        });
      }

      return res.status(200).json({ brief });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 일정 목록 요청
  try {
    const { from, to } = getDateRange(14);
    const events = await fetchFMPCalendar(from, to);

    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    const thisWeek = events.filter(e => e.date <= endOfWeekStr);
    const upcoming = events.filter(e => e.date > endOfWeekStr);

    return res.status(200).json({ thisWeek, upcoming });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
