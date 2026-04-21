// /api/tweet.js - 시간대별 테마 자동 트윗
// 장중(09~15시): 변동성 큰 테마 / 장외: 글로벌·전망 테마

const SCHEDULE = {
  // 시간: { name, query, tags, template }
  8:  { name: '반도체', query: '반도체 ETF 주가', tags: '#ETF #반도체 #TIGER반도체', tpl: 'briefing' },
  9:  { name: 'AI',     query: 'AI ETF 주가 인공지능', tags: '#ETF #AI #TIGER글로벌AI', tpl: 'hot' },
  10: { name: '방산',   query: '방산 ETF 주가 K방산', tags: '#ETF #방산 #K방산 #TIGER방산', tpl: 'why' },
  11: { name: '2차전지',query: '2차전지 ETF 배터리 주가', tags: '#ETF #2차전지 #배터리', tpl: 'buy' },
  12: { name: '반도체', query: '반도체 ETF 삼성 SK하이닉스', tags: '#ETF #반도체 #SK하이닉스', tpl: 'hot' },
  13: { name: '조선',   query: '조선 ETF 주가 수주', tags: '#ETF #조선 #TIGER조선', tpl: 'why' },
  14: { name: 'AI',     query: 'AI ETF 엔비디아 주가', tags: '#ETF #AI #엔비디아', tpl: 'buy' },
  15: { name: '방산',   query: '방산 ETF 방위산업 주가', tags: '#ETF #방산 #K방산', tpl: 'hot' },
  16: { name: '전력인프라', query: '전력 ETF 인프라 주가', tags: '#ETF #전력 #TIGER전력', tpl: 'briefing' },
  17: { name: '원자력', query: '원자력 ETF SMR 주가', tags: '#ETF #원자력 #SMR', tpl: 'why' },
  18: { name: '우주항공',query: '우주항공 ETF 스페이스X', tags: '#ETF #우주항공 #스페이스X', tpl: 'buy' },
  19: { name: '미국',   query: '미국 ETF S&P500 나스닥', tags: '#ETF #미국 #나스닥 #SP500', tpl: 'briefing' },
  20: { name: '2차전지',query: '2차전지 ETF 전고체 배터리', tags: '#ETF #2차전지 #전고체', tpl: 'hot' },
  21: { name: 'AI',     query: 'AI ETF 미국장 주가', tags: '#ETF #AI #미국장', tpl: 'why' },
  22: { name: '반도체', query: '반도체 ETF 미국 필라델피아', tags: '#ETF #반도체 #필라델피아', tpl: 'buy' },
  23: { name: '우주항공',query: '우주항공 ETF 내일 전망', tags: '#ETF #우주항공 #내일전망', tpl: 'briefing' },
};

function buildTweet(tpl, theme, summary) {
  switch(tpl) {
    case 'why':
      return `📉 오늘 내 ${theme} ETF 하락한 이유\n\n${summary}..\n\n👉 전체 분석 → https://etfradar.kr\n\n`;
    case 'hot':
      return `🚨 ${theme} ETF 지금 난리났다\n\n${summary}..\n\n📊 실시간 확인 → https://etfradar.kr\n\n`;
    case 'buy':
      return `💡 ${theme} ETF 지금 사도 될까?\n\n${summary}..\n\n🔍 분석 보기 → https://etfradar.kr\n\n`;
    case 'briefing':
      return `📊 ${theme} ETF 오늘의 핵심 이슈\n\n${summary}..\n\n👉 더 보기 → https://etfradar.kr\n\n`;
    default:
      return `📈 ${theme} ETF 지금 주목!\n\n${summary}..\n\n→ https://etfradar.kr\n\n`;
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
    const prompt = `다음은 오늘의 ${themeName} ETF 관련 뉴스 헤드라인이야:
${headlines.map((h, i) => `${i+1}. ${h}`).join('\n')}

위 뉴스를 바탕으로 투자자 관점에서 핵심 이슈를 1~2줄로 요약해줘.
- 문장은 "~으로", "~하며", "~속에" 등으로 끝내
- 마침표(.)로 끝내지 마
- 20자 이상 40자 이하
- 요약문만 출력해`;

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

    const body = buildTweet(schedule.tpl, schedule.name, summary) + schedule.tags;
    const truncated = body.length > 280 ? body.substring(0, 277) + '...' : body;

    const result = await postTweet(truncated);
    return res.status(200).json({ success: true, hour, theme: schedule.name, summary, tweet: result });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
