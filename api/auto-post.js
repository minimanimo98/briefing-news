// /api/auto-post.js
// 매일 자동 토론 게시글 생성 (Vercel Cron: 0 23 * * * = 한국시간 오전 8시)

const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const ANIMALS=['고양이','개구리','판다','여우','코알라','수달','너구리','다람쥐','부엉이','펭귄'];
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ';
function randomNick(){const a=ANIMALS[Math.floor(Math.random()*ANIMALS.length)];const l=ALPHA[Math.floor(Math.random()*ALPHA.length)];const n=Math.floor(Math.random()*90)+10;return`ETF레이더Bot`;}

const DISCUSSION_TEMPLATES = [
  { title: '오늘 시장 급락에 당신의 ETF 전략은?', content: '코스피 급락입니다. 여러분은 지금 어떻게 대응하고 계신가요?\n\n추가매수? 현금 보유? 아니면 인버스 진입?\n\n자유롭게 의견 나눠요 👇', poll: ['추가매수 기회!', '일단 현금 확보', '인버스 진입', '아무것도 안 함'] },
  { title: '이번 주 가장 주목하는 ETF는?', content: '이번 주 경제지표 발표가 많습니다.\n\nCPI, FOMC, 고용보고서... 여러분은 어떤 ETF를 주목하고 계신가요?\n\n의견 공유해요!', poll: ['반도체ETF', '방산ETF', '미국S&P500', '인버스ETF'] },
  { title: '지금 가장 매력적인 국내 테마 ETF는?', content: '국내 ETF 중 지금 가장 투자하고 싶은 테마가 뭔가요?\n\n최근 시장 흐름 보면 조선/방산이 강세인데...\n\n여러분 생각은?', poll: ['반도체', '조선/방산', '원자력', '2차전지'] },
  { title: 'ETF 투자, 장기 보유 vs 단기 매매 어떻게 하세요?', content: 'ETF 투자 방식에 대해 이야기해봐요.\n\n저는 개인적으로 테마ETF는 단기, S&P500은 장기로 나눠서 투자하는데\n여러분은 어떤 방식을 선호하시나요?', poll: ['장기 적립식', '테마 단기 매매', '반반', '모르겠음'] },
  { title: '연금저축/IRP에서 ETF 어떻게 굴리세요?', content: '요즘 연금계좌에서 ETF 투자하시는 분들 많죠?\n\n저는 미국S&P500 70% + 국내채권 30% 비율로 가고 있는데\n여러분의 포트폴리오 구성이 궁금해요!', poll: ['미국지수 위주', '국내 테마 위주', '배당/커버드콜', '기타'] },
];

module.exports = async function handler(req, res) {
  // 보안: GET 요청 또는 Vercel Cron 헤더 확인
  const authHeader = req.headers['authorization'];
  if (req.method !== 'GET' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 오늘 이미 AI토론 게시글이 있는지 확인
    const today = new Date().toISOString().split('T')[0];
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?category=eq.AI토론&created_at=gte.${today}T00:00:00&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const existing = await checkRes.json();
    if (existing.length > 0) {
      return res.status(200).json({ message: '오늘 이미 게시글 있음', id: existing[0].id });
    }

    // AI 브리핑 가져오기
    let briefing = '';
    try {
      const briefRes = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1&select=summary`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const briefData = await briefRes.json();
      briefing = briefData?.[0]?.summary || '';
    } catch(e) {}

    // 공포/탐욕 지수 기반 토론 주제 선택
    let template;
    const dayOfWeek = new Date().getDay();
    if (briefing.includes('급락') || briefing.includes('폭락') || briefing.includes('하락')) {
      template = DISCUSSION_TEMPLATES[0]; // 급락 대응
    } else if (dayOfWeek === 1) {
      template = DISCUSSION_TEMPLATES[1]; // 월요일: 이번 주 주목 ETF
    } else if (dayOfWeek === 3) {
      template = DISCUSSION_TEMPLATES[2]; // 수요일: 테마 ETF
    } else {
      template = DISCUSSION_TEMPLATES[Math.floor(Math.random() * DISCUSSION_TEMPLATES.length)];
    }

    // Claude로 오늘의 토론 주제 생성
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && briefing) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `오늘의 AI 시장 브리핑:
${briefing}

위 브리핑을 바탕으로 ETF 투자자들이 토론할 수 있는 게시글을 작성해주세요.

아래 형식으로만 출력:
[제목] 30자 이내 토론 유도 제목
[내용] 3~4줄 토론 유도 내용 (친근한 말투)
[투표1] 선택지1 (15자 이내)
[투표2] 선택지2 (15자 이내)
[투표3] 선택지3 (15자 이내)
[투표4] 선택지4 (15자 이내)`
            }]
          })
        });
        const aiData = await aiRes.json();
        const text = aiData?.content?.[0]?.text || '';
        if (text) {
          const title = text.match(/\[제목\]\s*(.+)/)?.[1]?.trim();
          const content = text.match(/\[내용\]\s*([\s\S]*?)(?=\[|$)/)?.[1]?.trim();
          const p1 = text.match(/\[투표1\]\s*(.+)/)?.[1]?.trim();
          const p2 = text.match(/\[투표2\]\s*(.+)/)?.[1]?.trim();
          const p3 = text.match(/\[투표3\]\s*(.+)/)?.[1]?.trim();
          const p4 = text.match(/\[투표4\]\s*(.+)/)?.[1]?.trim();
          if (title && content) {
            template = {
              title,
              content,
              poll: [p1, p2, p3, p4].filter(Boolean)
            };
          }
        }
      } catch(e) {}
    }

    // 게시글 등록
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        title: template.title,
        content: template.content,
        category: 'AI토론',
        nickname: 'ETF레이더Bot',
        likes: 0, dislikes: 0, views: 0, comment_count: 0,
        poll_options: template.poll,
        poll_votes: new Array(template.poll.length).fill(0)
      })
    });

    const post = await postRes.json();
    return res.status(200).json({ message: '게시글 생성 완료', post: post[0] });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
