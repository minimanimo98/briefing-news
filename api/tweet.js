// /api/tweet.js
const THEMES = [
  { name: '반도체', query: '반도체 ETF 주가', tags: '#ETF #반도체 #TIGER반도체 #KODEX반도체' },
  { name: 'AI', query: 'AI ETF 주가 인공지능', tags: '#ETF #AI #인공지능 #TIGER글로벌AI' },
  { name: '우주항공', query: '우주항공 ETF 주가', tags: '#ETF #우주항공 #스페이스X #TIGER우주' },
  { name: '방산', query: '방산 ETF 주가 방위산업', tags: '#ETF #방산 #K방산 #TIGER방산' },
  { name: '2차전지', query: '2차전지 ETF 주가 배터리', tags: '#ETF #2차전지 #배터리 #TIGER2차전지' },
  { name: '원자력', query: '원자력 ETF 주가 SMR', tags: '#ETF #원자력 #SMR #KODEX원자력' },
  { name: '전력인프라', query: '전력 ETF 주가 인프라', tags: '#ETF #전력 #전력인프라 #TIGER전력' },
  { name: '조선', query: '조선 ETF 주가', tags: '#ETF #조선 #TIGER조선 #KODEX조선' },
];

const TEMPLATES = [
  (theme, summary) => `📉 오늘 내 ${theme} ETF 하락한 이유\n\n${summary}..\n\n👉 전체 분석 → https://etfradar.kr\n\n`,
  (theme, summary) => `🤔 ${theme} ETF 나만 떨어지나?\n\n${summary}..\n\n📊 지금 확인 → https://etfradar.kr\n\n`,
  (theme, summary) => `🚨 ${theme} ETF 투자자 주목!\n\n${summary}..\n\n👉 더 보기 → https://etfradar.kr\n\n`,
  (theme, summary) => `📊 오늘 ${theme} ETF 무슨 일?\n\n${summary}..\n\n🔍 원인 분석 → https://etfradar.kr\n\n`,
  (theme, summary) => `💡 ${theme} ETF 지금 사도 될까?\n\n${summary}..\n\n👉 분석 보기 → https://etfradar.kr\n\n`,
];

async function fetchThemeNews(theme) {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(theme.query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const res = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(rssUrl)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await res.text();
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

    const headlines = [];
    for (const item of items.slice(0, 5)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         item.match(/<title>(.*?)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        const title = titleMatch[1]
          .replace(/\s+-\s+.+$/, '')
          .replace(/<[^>]+>/g, '')
          .trim();
        if (title && title.length > 5 && !title.includes('Google')) {
          headlines.push(title);
        }
      }
    }
    return headlines;
  } catch(e) {
    return [];
  }
}

async function generateSummary(theme, headlines) {
  if (!headlines.length) return null;
  try {
    const prompt = `다음은 오늘의 ${theme.name} ETF 관련 뉴스 헤드라인이야:
${headlines.map((h, i) => `${i+1}. ${h}`).join('\n')}

위 뉴스를 바탕으로 "${theme.name} ETF 관련 핵심 이슈"를 한국어로 1~2줄로 요약해줘.
- 반드시 투자자 관점에서 써줘
- 문장은 "~으로", "~하며", "~속에" 등으로 자연스럽게 끝내
- 절대 마침표(.)로 끝내지 마
- 20자 이상 40자 이하로 써줘
- 요약문만 출력해, 다른 말 하지 마`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch(e) {
    return null;
  }
}

async function postTweet(text) {
  const apiKey       = process.env.TWITTER_API_KEY;
  const apiSecret    = process.env.TWITTER_API_SECRET;
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const oauth = await buildOAuthHeader('POST', 'https://api.twitter.com/2/tweets', {}, apiKey, apiSecret, accessToken, accessSecret);
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { 'Authorization': oauth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return await res.json();
}

async function buildOAuthHeader(method, url, params, apiKey, apiSecret, token, tokenSecret) {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const allParams = { ...params, ...oauthParams };
  const sortedParams = Object.keys(allParams).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`
  ).join('&');
  const baseString = [method, encodeURIComponent(url), encodeURIComponent(sortedParams)].join('&');
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(tokenSecret)}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const msgData = encoder.encode(baseString);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  oauthParams.oauth_signature = b64;
  const headerVal = 'OAuth ' + Object.keys(oauthParams).sort().map(k =>
    `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
  ).join(', ');
  return headerVal;
}

module.exports = async function handler(req, res) {
  try {
    // 오늘 날짜 기반으로 테마/템플릿 순환
    const dayIndex = Math.floor(Date.now() / 86400000);
    const theme = THEMES[dayIndex % THEMES.length];
    const template = TEMPLATES[dayIndex % TEMPLATES.length];

    const headlines = await fetchThemeNews(theme);
    if (!headlines.length) return res.status(200).json({ message: '뉴스 없음' });

    const summary = await generateSummary(theme, headlines);
    if (!summary) return res.status(200).json({ message: '요약 실패' });

    const body = template(theme.name, summary) + theme.tags;
    const truncated = body.length > 280 ? body.substring(0, 277) + '...' : body;

    const result = await postTweet(truncated);
    return res.status(200).json({ success: true, theme: theme.name, summary, tweet: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
