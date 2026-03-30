// /api/econ-calendar.js
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// 4~6월 주요 경제지표 일정
const CALENDAR = [
  // 4월
  { date: '2026-04-02', name: 'ADP 고용보고서', country: '미국', importance: 'high' },
  { date: '2026-04-03', name: '미국 실업수당청구', country: '미국', importance: 'mid' },
  { date: '2026-04-03', name: '미국 고용보고서(NFP)', country: '미국', importance: 'high' },
  { date: '2026-04-08', name: 'FOMC 의사록', country: '미국', importance: 'high' },
  { date: '2026-04-10', name: '미국 CPI', country: '미국', importance: 'high' },
  { date: '2026-04-11', name: '미국 PPI', country: '미국', importance: 'mid' },
  { date: '2026-04-14', name: '중국 무역수지', country: '중국', importance: 'mid' },
  { date: '2026-04-15', name: '중국 GDP(1분기)', country: '중국', importance: 'high' },
  { date: '2026-04-16', name: '미국 소매판매', country: '미국', importance: 'mid' },
  { date: '2026-04-17', name: '미국 실업수당청구', country: '미국', importance: 'mid' },
  { date: '2026-04-24', name: '미국 GDP 예비치(1분기)', country: '미국', importance: 'high' },
  { date: '2026-04-25', name: '미국 PCE', country: '미국', importance: 'high' },
  { date: '2026-04-28', name: '일본 BOJ 금리결정', country: '일본', importance: 'high' },
  { date: '2026-04-29', name: 'FOMC 금리결정', country: '미국', importance: 'high' },
  { date: '2026-04-30', name: '유로존 GDP(1분기)', country: '유럽', importance: 'mid' },
  // 5월
  { date: '2026-05-01', name: '미국 고용보고서(NFP)', country: '미국', importance: 'high' },
  { date: '2026-05-07', name: '영국 BOE 금리결정', country: '영국', importance: 'mid' },
  { date: '2026-05-08', name: '미국 실업수당청구', country: '미국', importance: 'mid' },
  { date: '2026-05-13', name: '미국 CPI', country: '미국', importance: 'high' },
  { date: '2026-05-15', name: '미국 PPI', country: '미국', importance: 'mid' },
  { date: '2026-05-15', name: '미국 소매판매', country: '미국', importance: 'mid' },
  { date: '2026-05-20', name: 'FOMC 의사록', country: '미국', importance: 'high' },
  { date: '2026-05-22', name: '미국 실업수당청구', country: '미국', importance: 'mid' },
  { date: '2026-05-28', name: '미국 GDP 확정치(1분기)', country: '미국', importance: 'mid' },
  { date: '2026-05-29', name: '미국 PCE', country: '미국', importance: 'high' },
  // 6월
  { date: '2026-06-03', name: 'ADP 고용보고서', country: '미국', importance: 'high' },
  { date: '2026-06-05', name: '미국 고용보고서(NFP)', country: '미국', importance: 'high' },
  { date: '2026-06-10', name: '미국 CPI', country: '미국', importance: 'high' },
  { date: '2026-06-11', name: '미국 PPI', country: '미국', importance: 'mid' },
  { date: '2026-06-17', name: 'FOMC 금리결정', country: '미국', importance: 'high' },
  { date: '2026-06-19', name: '미국 실업수당청구', country: '미국', importance: 'mid' },
  { date: '2026-06-25', name: '미국 GDP 확정치(1분기)', country: '미국', importance: 'mid' },
  { date: '2026-06-26', name: '미국 PCE', country: '미국', importance: 'high' },
];

function getThisWeekEvents() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  return CALENDAR.filter(e => {
    const d = new Date(e.date);
    return d >= monday && d <= sunday;
  });
}

function getUpcomingEvents() {
  const now = new Date();
  now.setHours(0,0,0,0);
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
  endOfWeek.setHours(23,59,59,999);
  const twoWeeksLater = new Date(now);
  twoWeeksLater.setDate(now.getDate() + 14);
  return CALENDAR.filter(e => {
    const d = new Date(e.date);
    return d > endOfWeek && d <= twoWeeksLater;
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, name, date } = req.query;

  // AI 해설 요청
  if (type === 'brief' && name) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const cacheKey = `econ_brief_${name.replace(/[\s/()]/g,'_')}`;

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
"${name}" 경제지표를 ETF 투자자에게 딱 핵심만 설명해주세요.

각 항목 20자 이내로 짧게:
- 마침표 금지
- 이모지 없이
- 쉬운 말

반드시 아래 형식만 출력:

[이게뭔가요] 한 줄 설명
[좋으면] ETF 영향 한 줄
[나쁘면] ETF 영향 한 줄`;

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

  // 일정 목록
  const thisWeek = getThisWeekEvents();
  const upcoming = getUpcomingEvents();
  return res.status(200).json({ thisWeek, upcoming });
};
