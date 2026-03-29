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

    // 2. 새로 생성
    const prompt = `다음은 오늘의 ETF·주식·펀드 관련 주요 뉴스 제목들입니다:\n\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n위 뉴스들을 바탕으로 아래 3가지 항목을 각각 한 문장으로 요약해주세요.\n- 말투: "~했다" 금지. 명사형 종결 또는 단호한 현재형 사용 (예: "700조 증발", "외국인 30조 매도", "코스피 1%대 하락")\n- 이모지 없이 깔끔하게\n- 각 항목은 반드시 아래 형식 그대로 출력\n\n[주식시장] 오늘 주식시장 핵심 한 문장\n[주요뉴스] 가장 중요한 뉴스 한 문장\n[ETF] ETF 시장 흐름 한 문장`;

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

