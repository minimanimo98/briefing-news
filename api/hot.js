// /api/hot.js
// 핫뉴스 조회 및 클릭 저장

const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // POST: 클릭 저장
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    const { url, title } = body || {};
    if (!url || !title) return res.status(400).json({ error: '파라미터 없음' });

    try {
      // upsert: 오늘 같은 URL이 있으면 clicks+1, 없으면 새로 삽입
      const r = await fetch(`${SUPABASE_URL}/rest/v1/news_clicks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ url, title, date: today, clicks: 1 }),
      });
      // 이미 있으면 RPC로 increment
      if (r.status === 409 || r.status === 200) {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_clicks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ p_url: url, p_date: today }),
        });
      }
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET: 오늘 핫뉴스 상위 5개
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/news_clicks?date=eq.${today}&order=clicks.desc&limit=5`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const data = await r.json();
    return res.status(200).json({ hot: data || [] });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
