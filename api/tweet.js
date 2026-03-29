// /api/tweet.js
// Vercel Cron Job으로 자동 실행 — 하루 3회 ETF 뉴스 트윗

const GOOGLE_RSS = "https://news.google.com/rss/search?q=ETF+한국+투자&hl=ko&gl=KR&ceid=KR:ko";

async function fetchLatestNews() {
  const res = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(GOOGLE_RSS)}`);
  const text = await res.text();

  // XML 파싱
  const titles = [...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(m => m[1]);
  const links  = [...text.matchAll(/<link>(.*?)<\/link>/g)].map(m => m[1]);

  // 첫 번째 뉴스 반환 (최신)
  if (titles.length > 1) {
    const title = titles[1].replace(/\s+-\s+.+$/, '').trim(); // 언론사명 제거
    const link  = links[1] || 'https://etfradar.kr';
    return { title, link };
  }
  return null;
}

async function postTweet(text) {
  const apiKey       = process.env.TWITTER_API_KEY;
  const apiSecret    = process.env.TWITTER_API_SECRET;
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  // OAuth 1.0a 서명 생성
  const oauth = await buildOAuthHeader('POST', 'https://api.twitter.com/2/tweets', {}, apiKey, apiSecret, accessToken, accessSecret);

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': oauth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = await res.json();
  return data;
}

// OAuth 1.0a 서명 빌더
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

  // HMAC-SHA1
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

export default async function handler(req, res) {
  // Cron 보안: Vercel Cron 요청만 허용
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const news = await fetchLatestNews();
    if (!news) return res.status(200).json({ message: '뉴스 없음' });

    // 280자 제한 맞게 트윗 작성
    const tweetText = `📊 ${news.title}\n\n👉 ${news.link}\n\n#ETF #주식 #투자 #etfradar`;
    const truncated = tweetText.length > 280 ? tweetText.substring(0, 277) + '...' : tweetText;

    const result = await postTweet(truncated);
    return res.status(200).json({ success: true, tweet: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
