// /api/article.js - 뉴스 AI 요약 (Supabase 캐시)
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { title, source, url } = body || {};
  if (!title) return res.status(400).json({ error: '제목 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  try {
    // 1. 캐시 확인 (URL 기반, 24시간 유효)
    if (url && SUPABASE_KEY) {
      const cacheRes = await fetch(
        `${SUPABASE_URL}/rest/v1/article_cache?url=eq.${encodeURIComponent(url)}&select=summary,created_at`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const cached = await cacheRes.json();
      if (cached?.[0]?.summary) {
        const age = Date.now() - new Date(cached[0].created_at).getTime();
        if (age < 86400000) { // 24시간
          return res.status(200).json({ summary: cached[0].summary, cached: true });
        }
      }
    }

    // 2. 새로 생성
    const prompt = `다음 뉴스 제목을 보고 투자자 관점에서 핵심 인사이트를 제공해주세요.

뉴스: "${title}"
출처: ${source || ''}

아래 형식으로 간결하게 작성해주세요:
- 이모지 없이 깔끔하게
- "~했다" 금지, 명사형/현재형 사용

[한줄요약] 이 뉴스의 핵심을 한 문장으로
[투자포인트] 투자자가 주목해야 할 포인트 2~3가지 (각 한 줄)
[관련ETF] 이 뉴스와 관련된 ETF 또는 섹터 (없으면 생략)`;

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
    const summary = data?.content?.[0]?.text || '요약 실패';

    // 3. Supabase에 캐시 저장
    if (url && SUPABASE_KEY && summary !== '요약 실패') {
      await fetch(`${SUPABASE_URL}/rest/v1/article_cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ url, summary, created_at: new Date().toISOString() }),
      });
    }

    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
