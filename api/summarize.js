// /api/summarize.js
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const titles = body?.titles;
  if (!titles || !titles.length) return res.status(400).json({ error: '뉴스 제목 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  try {
    // 1. 캐시 확인 (1시간 이내면 반환)
    const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });
    const cacheData = await cacheRes.json();
    if (cacheData?.[0]?.summary && cacheData?.[0]?.created_at) {
      const age = Date.now() - new Date(cacheData[0].created_at).getTime();
      if (age < 3600000 && cacheData[0].summary.length > 10) {
        return res.status(200).json({ summary: cacheData[0].summary, cached: true });
      }
    }

    // 2. 새로 생성 - ETF 투자자 관점 특화 프롬프트
    const prompt = `당신은 10년 경력의 ETF 전문 애널리스트입니다.
오늘의 주요 뉴스 제목을 보고, 국내 ETF 투자자 입장에서 "지금 당장 어떻게 행동해야 하는가"를 핵심만 짚어주세요.

뉴스 목록:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

아래 3가지를 각각 한 문장으로 작성하세요.

작성 원칙:
- 투자자가 "아, 오늘 시장이 이렇구나"를 즉시 느낄 수 있게
- 단순 사실 나열 금지 → 반드시 ETF 투자 관점의 해석 포함
- "~했다" 금지, 명사형 또는 단호한 현재형 사용
- 이모지 없이, 숫자와 구체적 근거 포함
- 예시 좋음: "외국인 1.2조 매도에 코스피 붕괴, 인버스ETF 수혜"
- 예시 나쁨: "오늘 주식시장이 하락했습니다"

반드시 아래 형식 그대로만 출력 (다른 말 금지):

[주식시장] 오늘 시장 핵심 + ETF 투자자에게 미치는 영향
[주요뉴스] 가장 중요한 뉴스 + 관련 ETF 섹터 언급
[ETF] 오늘 주목할 ETF 흐름 또는 투자 포인트`;

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

    // 3. Supabase에 캐시 저장
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
