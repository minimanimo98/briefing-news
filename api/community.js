// /api/community.js
// ?type=post              → 오늘의 AI 토론 게시글 생성 (vercel cron: 하루 1회)
// ?type=comment&post_id=X → 특정 게시글에 AI 댓글 1개 (게시글 작성 직후 1회)

const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const H = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation'
};

const AI_NICKS = [
  'ETF고수개구리A12', 'ETF분석판다B34', '투자고수코알라C56',
  '시장읽는여우D78',  '데이터수달E90',  '지수분석부엉이F11',
  '퀀트다람쥐G22',   '배당왕햄스터H33', '인덱스펭귄I44',
];

const DISCUSSION_TEMPLATES = [
  { title: '오늘 시장 급락에 당신의 ETF 전략은?',       content: '코스피 급락입니다. 추가매수? 현금 보유? 인버스 진입?\n\n자유롭게 의견 나눠요 👇' },
  { title: '이번 주 가장 주목하는 ETF는?',              content: '이번 주 경제지표 발표가 많습니다. 어떤 ETF를 주목하고 계신가요? 👇' },
  { title: '지금 가장 매력적인 국내 테마 ETF는?',        content: '반도체, 방산, 원자력, 2차전지… 지금 어디가 가장 매력적인가요? 👇' },
  { title: 'ETF 투자, 장기 보유 vs 단기 매매 어떻게 하세요?', content: '여러분만의 ETF 투자 방식이 궁금해요! 👇' },
  { title: '연금저축/IRP에서 ETF 어떻게 굴리세요?',      content: '연금계좌에서 ETF 투자하시는 분들 포트폴리오 공유해요! 👇' },
];

// ── AI 댓글: 특정 게시글에 1회만 ──
async function handleComment(postId) {
  if (!postId || isNaN(postId)) return { message: 'post_id 필요' };

  // 1. 게시글 조회 + 이미 댓글 있으면 즉시 스킵 (중복 방지 핵심)
  const checkR = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=id,title,content,category,comment_count`,
    { headers: H }
  );
  const posts = await checkR.json();
  const post = posts[0];
  if (!post) return { message: '게시글 없음' };
  if ((post.comment_count || 0) > 0) return { message: '이미 댓글 있음 - 스킵' };

  // 2. 오늘 브리핑 (없어도 진행)
  let briefing = '';
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?select=summary&limit=1`, { headers: H });
    const bd = await br.json();
    briefing = bd?.[0]?.summary?.substring(0, 200) || '';
  } catch(e) {}

  // 3. 카테고리별 프롬프트
  const isInvestment = ['ETF','펀드','주식','정보','토론','AI토론'].includes(post.category || '자유');
  const prompt = isInvestment
    ? `당신은 ETF 투자 커뮤니티의 경험 많은 개인투자자입니다.
${briefing ? `오늘 시장: ${briefing}\n` : ''}
게시글 제목: ${post.title}
게시글 내용: ${(post.content || '').substring(0, 200)}

투자 관점에서 공감하거나 인사이트를 더해주는 댓글을 달아주세요.
- 2~3문장 이내, 자연스러운 구어체, 이모지 1~2개
- "AI입니다" 금지, 댓글 텍스트만 출력`
    : `당신은 ETF 투자 커뮤니티의 활발한 일반 회원입니다.
게시글 제목: ${post.title}
게시글 내용: ${(post.content || '').substring(0, 200)}

공감하거나 재미있게 반응하는 짧은 댓글을 달아주세요.
- 1~2문장, 친근하고 가벼운 톤, 이모지 1~2개
- "AI입니다" 금지, 댓글 텍스트만 출력`;

  // 4. AI 생성
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { message: 'API 키 없음' };

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const aiData = await aiRes.json();
  const comment = aiData?.content?.[0]?.text?.trim();
  if (!comment || comment.length < 5) return { message: 'AI 댓글 생성 실패' };

  // 5. 댓글 저장
  const nick = AI_NICKS[Math.floor(Math.random() * AI_NICKS.length)];
  await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ post_id: postId, content: comment, nickname: nick })
  });

  // 6. comment_count 업데이트
  await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ comment_count: 1 })
  });

  return { message: 'AI 댓글 달림', comment, nick };
}

// ── 오늘의 AI 토론 게시글 (하루 1회 cron) ──
async function handlePost() {
  const today = new Date().toISOString().split('T')[0];

  // 오늘 이미 있으면 스킵
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?category=eq.AI토론&created_at=gte.${today}T00:00:00&limit=1`,
    { headers: H }
  );
  const existing = await checkRes.json();
  if (existing.length > 0) return { message: '오늘 이미 생성됨' };

  // 브리핑 가져오기
  let briefing = '';
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?select=summary&limit=1`, { headers: H });
    const bd = await br.json();
    briefing = bd?.[0]?.summary || '';
  } catch(e) {}

  // 기본 템플릿 (요일 기반)
  let template = DISCUSSION_TEMPLATES[new Date().getDay() % DISCUSSION_TEMPLATES.length];
  if (briefing.includes('급락') || briefing.includes('폭락')) template = DISCUSSION_TEMPLATES[0];

  // AI로 브리핑 기반 토론 주제 생성
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && briefing) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 250,
          messages: [{
            role: 'user',
            content: `오늘의 시장 브리핑:\n${briefing}\n\n위 브리핑을 바탕으로 ETF 투자자들이 토론할 수 있는 게시글을 작성해주세요.\n\n형식 (이것만 출력):\n[제목] 30자 이내\n[내용] 2~3줄 친근한 말투`
          }]
        })
      });
      const aiData = await aiRes.json();
      const text = aiData?.content?.[0]?.text || '';
      const title = text.match(/\[제목\]\s*(.+)/)?.[1]?.trim();
      const content = text.match(/\[내용\]\s*([\s\S]*?)(?=\[|$)/)?.[1]?.trim();
      if (title && content) template = { title, content };
    } catch(e) {}
  }

  // 게시글 생성
  const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      title: template.title,
      content: template.content + '\n\n여러분의 의견을 자유롭게 남겨주세요! 👇',
      category: 'AI토론',
      nickname: 'ETF레이더',
      likes: 0, dislikes: 0, views: 0, comment_count: 0
    })
  });
  const post = await postRes.json();
  return { message: '게시글 생성 완료', post: post[0] };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, post_id } = req.query;
  try {
    if (type === 'post')    return res.status(200).json(await handlePost());
    if (type === 'comment') return res.status(200).json(await handleComment(parseInt(post_id)));
    return res.status(400).json({ error: 'type 파라미터 필요 (post 또는 comment)' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
