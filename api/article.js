// /api/article.js - 뉴스 AI 요약 (Supabase 캐시)
const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const LOW_QUALITY_PATTERNS = [
  '주요공시', '전 거래일', '장 마감 후', '시간외 대량매매',
  '입찰공고', '주요 일정', '공시 목록', '주요 공시',
  '수시공시', '주주총회', '정기공시', '반기보고서', '사업보고서',
  '감사보고서', '분기보고서', '지분변동', '장외매매',
];

function isLowQuality(title) {
  if (LOW_QUALITY_PATTERNS.some(p => title.includes(p))) return true;
  if (/^\[.{2,10}\]/.test(title) && title.length < 20) return true;
  if (/\d+월\s*\d+일.*(공시|일정|브리핑)/.test(title)) return true;
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { title, source, url } = body || {};
  if (!title) return res.status(400).json({ error: '제목 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  if (isLowQuality(title)) {
    return res.status(200).json({
      summary: [
        '[한줄요약] 공시·일정 목록 기사로 개별 종목 분석이 어렵습니다.',
        '[투자포인트] 원문에서 관심 종목의 공시 내용을 직접 확인하세요.',
      ].join('\n'),
      lowQuality: true,
    });
  }

  try {
    // 1. 캐시 확인 (URL 기반, 24시간 유효)
    if (url && SUPABASE_KEY) {
      const cacheRes = await fetch(
        `${SUPABASE_URL}/rest/v1/article_cache?url=eq.${encodeURIComponent(url)}&select=summary,created_at`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const cached = await cacheRes.json();
      if (cached?.[0]?.summary) {
        const age = Date.now() - new Date(cached[0].created_at).getTime();
        if (age < 86400000) {
          return res.status(200).json({ summary: cached[0].summary, cached: true });
        }
      }
    }

    // 2. 새로 생성 (max_tokens 200으로 단축 → 30% 빠름)
    const prompt = `당신은 ETF·주식 투자 전문 애널리스트입니다.
아래 뉴스 제목을 읽고 반드시 투자 인사이트를 제공해야 합니다.

뉴스 제목: "${title}"
출처: ${source || ''}

규칙:
- 제목만 있어도 관련 업종·시장 흐름 기반으로 반드시 분석할 것
- "분석이 어렵습니다" 같은 회피 응답 금지
- 이모지 없이 간결하게
- "~했다" 금지, 현재형·명사형 사용
- 각 항목 한 줄씩

형식:
[한줄요약] 이 뉴스의 핵심을 한 문장으로
[투자포인트] 투자자가 주목할 포인트 2가지 (줄바꿈으로 구분)
[관련ETF] 관련 ETF 또는 섹터명 (없으면 생략)`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200, // ✅ 300 → 200 (응답 30% 빨라짐)
        system: 'ETF·주식 투자 분석 전문가로서, 제공된 뉴스 제목을 바탕으로 항상 실질적인 투자 인사이트를 제공합니다. 정보가 부족해 보여도 업종·시장 맥락을 활용해 분석합니다.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const summary = data?.content?.[0]?.text || '요약 실패';

    // 3. Supabase 캐시 저장
    if (url && SUPABASE_KEY && summary !== '요약 실패') {
      await fetch(`${SUPABASE_URL}/rest/v1/article_cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ url, summary, created_at: new Date().toISOString() }),
      });
    }

    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
