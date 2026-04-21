// /api/summarize.js
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: 캐시만 즉시 반환 (프론트 초기 로딩용) ──
  if (req.method === 'GET') {
    try {
      const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const cacheData = await cacheRes.json();
      if (cacheData?.[0]?.summary && cacheData[0].summary.length > 10) {
        return res.status(200).json({ summary: cacheData[0].summary, cached: true });
      }
      return res.status(200).json({ summary: null });
    } catch(e) {
      return res.status(200).json({ summary: null });
    }
  }

  // ── POST: 뉴스 기반 새 브리핑 생성 ──
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const titles = body?.titles;
  if (!titles || !titles.length) return res.status(400).json({ error: '뉴스 제목 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  try {
    // 캐시 확인 (1시간 이내면 반환)
    const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const cacheData = await cacheRes.json();
    if (cacheData?.[0]?.summary && cacheData?.[0]?.created_at) {
      const age = Date.now() - new Date(cacheData[0].created_at).getTime();
      if (age < 3600000 && cacheData[0].summary.length > 10) {
        return res.status(200).json({ summary: cacheData[0].summary, cached: true });
      }
    }

    // 새로 생성
    const prompt = `당신은 10년 경력의 ETF 전문 애널리스트입니다.
오늘의 주요 뉴스 제목을 보고, 국내 ETF 투자자 입장에서 "지금 당장 어떻게 행동해야 하는가"를 핵심만 짚어주세요.

뉴스 목록:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

아래 3가지를 각각 딱 한 줄로 작성하세요.

작성 원칙:
- 반드시 20자 이내로 짧게
- 핵심 숫자 포함 (예: -4%, 2.2조)
- 마침표 금지
- "~했다" "~입니다" 금지, 명사형 종결
- 이모지 없이
- 좋은 예: "외국인 2.2조 매도, 코스피 5200선 붕괴"
- 나쁜 예: "낙폭장 헤징(손실 방어) 위해 인버스ETF 확대, 반도체ETF는 중기 수익성으로 관심 지속"

반드시 아래 형식 그대로만 출력:

[주식시장] 20자 이내 핵심
[주요뉴스] 20자 이내 핵심
[ETF] 20자 이내 ETF 힌트`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const summary = data?.content?.[0]?.text || '요약 실패';

    // Supabase 캐시 저장
    if (summary !== '요약 실패') {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ summary, created_at: new Date().toISOString() }),
      });
    }

    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
