// /api/summarize.js
// 최신 ETF 뉴스 5개를 클로드 API로 요약

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { titles } = req.body || {};
  if (!titles || !titles.length) {
    return res.status(400).json({ error: '뉴스 제목 없음' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  try {
    const prompt = `다음은 오늘의 ETF·주식·펀드 관련 주요 뉴스 제목들입니다:

${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

위 뉴스들을 바탕으로 오늘 금융시장의 핵심 이슈를 3줄로 요약해주세요.
- 각 줄은 한 문장으로 핵심만 간결하게
- 투자자 관점에서 중요한 내용 위주로
- 이모지 없이 깔끔하게
- 형식: "① ... ② ... ③ ..."`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const summary = data.content?.[0]?.text || '요약 실패';

    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
