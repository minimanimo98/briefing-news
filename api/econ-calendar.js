// /api/econ-calendar.js
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// 4~6월 주요 경제지표 일정
const CALENDAR = [
  // 3월 (지난 지표 - 실제치 포함)
  { date: '2026-03-05', name: 'ADP 고용보고서', country: '미국', importance: 'high', estimate: '14.8만', actual: '7.7만' },
  { date: '2026-03-07', name: '미국 고용보고서(NFP)', country: '미국', importance: 'high', estimate: '16만', actual: '15.1만' },
  { date: '2026-03-12', name: '미국 CPI', country: '미국', importance: 'high', estimate: '2.9%', actual: '2.8%' },
  { date: '2026-03-13', name: '미국 PPI', country: '미국', importance: 'mid', estimate: '3.3%', actual: '3.2%' },
  { date: '2026-03-19', name: 'FOMC 금리결정', country: '미국', importance: 'high', estimate: '동결', actual: '동결(4.25~4.5%)' },
  { date: '2026-03-26', name: '미국 GDP 확정치(4분기)', country: '미국', importance: 'mid', estimate: '2.3%', actual: '2.4%' },
  { date: '2026-03-28', name: '미국 PCE', country: '미국', importance: 'high', estimate: '2.5%', actual: '2.5%' },
  // 4월
  { date: '2026-04-02', name: 'ADP 고용보고서', country: '미국', importance: 'high', estimate: '12만' },
  { date: '2026-04-03', name: '미국 실업수당청구', country: '미국', importance: 'mid', estimate: '22.5만' },
  { date: '2026-04-03', name: '미국 고용보고서(NFP)', country: '미국', importance: 'high', estimate: '13.5만' },
  { date: '2026-04-08', name: 'FOMC 의사록', country: '미국', importance: 'high' },
  { date: '2026-04-10', name: '미국 CPI', country: '미국', importance: 'high', estimate: '2.6%' },
  { date: '2026-04-11', name: '미국 PPI', country: '미국', importance: 'mid', estimate: '3.1%' },
  { date: '2026-04-14', name: '중국 무역수지', country: '중국', importance: 'mid' },
  { date: '2026-04-15', name: '중국 GDP(1분기)', country: '중국', importance: 'high', estimate: '5.1%' },
  { date: '2026-04-16', name: '미국 소매판매', country: '미국', importance: 'mid' },
  { date: '2026-04-17', name: '미국 실업수당청구', country: '미국', importance: 'mid' },
  { date: '2026-04-24', name: '미국 GDP 예비치(1분기)', country: '미국', importance: 'high', estimate: '1.8%' },
  { date: '2026-04-25', name: '미국 PCE', country: '미국', importance: 'high', estimate: '2.5%' },
  { date: '2026-04-28', name: '일본 BOJ 금리결정', country: '일본', importance: 'high' },
  { date: '2026-04-29', name: 'FOMC 금리결정', country: '미국', importance: 'high', estimate: '동결' },
  { date: '2026-04-30', name: '유로존 GDP(1분기)', country: '유럽', importance: 'mid' },
  // 5월
  { date: '2026-05-01', name: '미국 고용보고서(NFP)', country: '미국', importance: 'high' },
  { date: '2026-05-07', name: '영국 BOE 금리결정', country: '영국', importance: 'mid' },
  { date: '2026-05-13', name: '미국 CPI', country: '미국', importance: 'high' },
  { date: '2026-05-15', name: '미국 PPI', country: '미국', importance: 'mid' },
  { date: '2026-05-15', name: '미국 소매판매', country: '미국', importance: 'mid' },
  { date: '2026-05-20', name: 'FOMC 의사록', country: '미국', importance: 'high' },
  { date: '2026-05-29', name: '미국 PCE', country: '미국', importance: 'high' },
  // 6월
  { date: '2026-06-05', name: '미국 고용보고서(NFP)', country: '미국', importance: 'high' },
  { date: '2026-06-10', name: '미국 CPI', country: '미국', importance: 'high' },
  { date: '2026-06-11', name: '미국 PPI', country: '미국', importance: 'mid' },
  { date: '2026-06-17', name: 'FOMC 금리결정', country: '미국', importance: 'high' },
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

function getPastEvents() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0,0,0,0);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(now.getDate() - 30);
  return CALENDAR.filter(e => {
    const d = new Date(e.date);
    return d < monday && d >= oneMonthAgo && e.actual;
  }).reverse();
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
"${name}" 경제지표를 ETF 투자자에게 핵심만 설명해주세요.

규칙:
- 각 항목 반드시 한 줄, 20자 이내
- 마침표 금지
- 이모지 없이
- 관련 ETF 반드시 언급
- 3가지 항목 모두 빠짐없이 출력

반드시 아래 형식만 출력 (절대 생략 금지):

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
  const past = getPastEvents();
  return res.status(200).json({ thisWeek, upcoming, past });
};
