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
- 중학생도 이해할 수 있는 쉬운 단어 사용
- 전문용어는 괄호로 쉽게 설명 (예: 인버스ETF(시장 하락 시 수익나는 ETF))
- 숫자와 구체적 사실 포함으로 신뢰감 부여
- "~했다" 금지, 명사형 또는 단호한 현재형 사용
- 이모지 없이 깔끔하게
- 예시 좋음: "외국인 1.2조 팔자에 코스피 급락, 지수 따라가는 ETF도 동반 하락"
- 예시 나쁨: "분할 포지션 30% 인버스 헤징 전략 검토 필요"

반드시 아래 형식 그대로만 출력 (다른 말 금지):

[주식시장] 오늘 시장 상황을 쉽게 한 문장으로
[주요뉴스] 가장 중요한 뉴스와 ETF 투자자에게 미치는 영향
[ETF] 오늘 주목할 ETF 또는 투자 힌트 한 문장`;

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
