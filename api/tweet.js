
// /api/tweet.js
const GOOGLE_RSS = "https://news.google.com/rss/search?q=ETF+한국+투자&hl=ko&gl=KR&ceid=KR:ko";

async function fetchLatestNews() {
  const res = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(GOOGLE_RSS)}`);
  const text = await res.text();

  // CDATA 방식과 일반 방식 둘 다 시도
  let titles = [...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(m => m[1]);
  let links = [...text.matchAll(/<link>(.*?)<\/link>/g)].map(m => m[1]);

  // CDATA 없으면 일반 title 태그로 시도
  if (titles.length <= 1) {
    titles = [...text.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
  }

  if (titles.length > 1) {
    const title = titles[1].replace(/\s+-\s+.+$/, '').trim();
    const link = links[1] || 'https://etfradar.kr';
    return { title, link };
  }
  return null;
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
    const news = await fetchLatestNews();
    if (!news) return res.status(200).json({ message: '뉴스 없음' });
    const tweetText = `📊 ${news.title}\n\n👉 ${news.link}\n\n#ETF #주식 #투자 #etfradar`;
    const truncated = tweetText.length > 280 ? tweetText.substring(0, 277) + '...' : tweetText;
    const result = await postTweet(truncated);
    return res.status(200).json({ success: true, tweet: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
