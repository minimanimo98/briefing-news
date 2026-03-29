// /api/summarize.js
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
    const prompt = `다음은 오늘의 ETF·주식·펀드 관련 주요 뉴스 제목들입니다:

${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

위 뉴스들을 바탕으로 아래 3가지 항목을 각각 한 문장으로 요약해주세요.
- 이모지 없이 깔끔하게
- 각 항목은 반드시 아래 형식 그대로 출력

[주식시장] 오늘 주식시장 전반적인 흐름 한 문장
[주요뉴스] 가장 중요한 뉴스 한 문장
[ETF·펀드] ETF 및 펀드 시장 흐름 한 문장`;

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
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
