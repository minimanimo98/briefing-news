// /api/kakao-briefing.js
// 매일 오전 8시 카카오톡 채널 자동 브리핑 발송
// vercel.json cron: "0 23 * * *" (UTC 23시 = KST 08시)

const GOOGLE_RSS = "https://news.google.com/rss/search?q=ETF+한국+투자+코스피&hl=ko&gl=KR&ceid=KR:ko";

async function fetchTopNews() {
  try {
    const res = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(GOOGLE_RSS)}`);
    const text = await res.text();
    let titles = [...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(m => m[1]);
    if (titles.length <= 1) {
      titles = [...text.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
    }
    return titles.slice(1, 6).map(t => t.replace(/\s+-\s+.+$/, '').trim());
  } catch(e) {
    return [];
  }
}

async function getAISummary(titles) {
  try {
    const res = await fetch('https://etfradar.kr/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles }),
    });
    const data = await res.json();
    return data.summary || '';
  } catch(e) {
    return '';
  }
}

function parseSummary(text) {
  const stock = text.match(/\[주식시장\]\s*(.+)/)?.[1]?.trim() || '';
  const news  = text.match(/\[주요뉴스\]\s*(.+)/)?.[1]?.trim() || '';
  const etf   = text.match(/\[ETF\]\s*(.+)/)?.[1]?.trim() || '';
  return { stock, news, etf };
}

async function sendKakaoMessage(message) {
  const accessToken = process.env.KAKAO_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) throw new Error('KAKAO_CHANNEL_ACCESS_TOKEN 없음');

  const res = await fetch('https://kapi.kakao.com/v1/api/talk/channels/message/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: {
          web_url: 'https://etfradar.kr',
          mobile_web_url: 'https://etfradar.kr',
        },
        button_title: 'ETF레이더에서 더보기',
      }),
    }),
  });
  return await res.json();
}

module.exports = async function handler(req, res) {
  // cron 또는 수동 호출 모두 허용
  try {
    const today = new Date().toLocaleDateString('ko-KR', {
      month: 'long', day: 'numeric', weekday: 'short'
    });

    // 1. 뉴스 가져오기
    const titles = await fetchTopNews();
    if (!titles.length) {
      return res.status(200).json({ message: '뉴스 없음' });
    }

    // 2. AI 요약
    const summary = await getAISummary(titles);
    const { stock, news, etf } = parseSummary(summary);

    // 3. 메시지 구성
    const message = [
      `📊 ETF레이더 오전 브리핑`,
      `${today}`,
      ``,
      stock ? `📈 주식시장\n${stock}` : '',
      news  ? `📰 주요뉴스\n${news}` : '',
      etf   ? `💼 ETF\n${etf}` : '',
      ``,
      `🔍 오늘의 뉴스 더보기`,
      `👉 etfradar.kr`,
    ].filter(Boolean).join('\n');

    // 4. 카카오 채널 발송
    const result = await sendKakaoMessage(message);

    return res.status(200).json({ success: true, result, message });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
