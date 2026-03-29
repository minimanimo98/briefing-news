// /api/article.js - 뉴스 제목 기반 AI 요약
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { title, source } = body || {};
  if (!title) return res.status(400).json({ error: '제목 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  try {
    const prompt = `다음 뉴스 제목을 보고 투자자 관점에서 핵심 인사이트를 제공해주세요.

뉴스: "${title}"
출처: ${source || ''}

아래 형식으로 간결하게 작성해주세요:
- 이모지 없이 깔끔하게
- "~했다" 금지, 명사형/현재형 사용
- 말투: 단호하고 간결하게

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
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
