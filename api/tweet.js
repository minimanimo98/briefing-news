// /api/tweet.js - 하루 4회 테마 자동 트윗 (크레딧 절약)
// 8시(아침) / 12시(점심) / 18시(저녁) / 22시(미국장)

const SCHEDULE = {
  8:  { name: '반도체', query: '반도체 ETF 주가 삼성 SK하이닉스', tags: '#ETF #반도체 #TIGER반도체', tpl: 'briefing' },
  12: { name: 'AI',     query: 'AI ETF 주가 인공지능 엔비디아',  tags: '#ETF #AI #TIGER글로벌AI',  tpl: 'buy' },
  18: { name: '방산',   query: '방산 ETF 주가 K방산 한화',       tags: '#ETF #방산 #K방산',         tpl: 'hot' },
  22: { name: '미국',   query: '미국 ETF S&P500 나스닥 주가',    tags: '#ETF #미국 #나스닥 #SP500', tpl: 'why' },
};

function buildTweet(tpl, theme, summary, tags) {
  switch(tpl) {
    case 'briefing':
      return `오늘은 ${theme} 위주로 큰 변동성을 보임\n내 ${theme} ETF만 하락한 이유는...?\n\n${summary}\n\n🔍 etfradar.kr\n\n${tags}`;
    case 'hot':
      return `지금 ${theme} ETF 난리난 이유 알아?\n\n${summary}\n\n📊 etfradar.kr\n\n${tags}`;
    case 'buy':
      return `${theme} ETF 지금 사도 될까?\n\n${summary}\n\n💡 etfradar.kr\n\n${tags}`;
    case 'why':
      return `${theme} ETF 오늘 왜 이러는 거야?\n\n${summary}\n\n👉 etfradar.kr\n\n${tags}`;
    default:
      return `${theme} ETF 오늘의 핵심\n\n${summary}\n\n→ etfradar.kr\n\n${tags}`;
  }
}

async function fetchThemeNews(item) {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(item.query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const res = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(rssUrl)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await res.text();
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
    const headlines = [];
    for (const item of items.slice(0, 5)) {
      const t = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      if (t && t[1]) {
        const title = t[1].replace(/\s+-\s+.+$/, '').replace(/<[^>]+>/g, '').trim();
        if (title && title.length > 5 && !title.includes('Google')) headlines.push(title);
      }
    }
    return headlines;
  } catch(e) { return []; }
}

async function generateSummary(themeName, headlines) {
  if (!headlines.length) return null;
  try {
    const prompt = `다음은 오늘의 ${themeName} ETF 관련 뉴스야:
${headlines.map((h, i) => `${i+1}. ${h}`).join('\n')}

위 뉴스를 바탕으로 일반인이 읽기 쉽게 1~2줄로 요약해줘.
- 친구한테 말하듯 자연스러운 말투
- 어려운 금융용어 금지
- 25자~40자 사이
- 마침표 금지
- 요약문만 출력`;

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
  } catch(e) { return null; }
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
    // 한국 시간 기준 현재 시간
    const hour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
    const schedule = SCHEDULE[hour];
    if (!schedule) return res.status(200).json({ message: `${hour}시는 트윗 없음` });

    const headlines = await fetchThemeNews(schedule);
    if (!headlines.length) return res.status(200).json({ message: '뉴스 없음' });

    const summary = await generateSummary(schedule.name, headlines);
    if (!summary) return res.status(200).json({ message: '요약 실패' });

    const body = buildTweet(schedule.tpl, schedule.name, summary, schedule.tags);
    const truncated = body.length > 280 ? body.substring(0, 277) + '...' : body;

    const result = await postTweet(truncated);
    return res.status(200).json({ success: true, hour, theme: schedule.name, summary, tweet: result });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
