// /api/community.js
// auto-post + ai-comment 통합
// ?type=post → 매일 토론 게시글 생성 (cron: 0 23 * * *)
// ?type=comment → AI 댓글 달기 (cron: */30 * * * *)

const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const H = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation'
};

const ANIMALS=['고양이','개구리','판다','여우','코알라','수달','너구리','다람쥐','부엉이','펭귄'];
const AI_NICKS = [
  'ETF고수개구리A12','ETF분석판다B34','투자고수코알라C56',
  '시장읽는여우D78','데이터수달E90','지수분석부엉이F11',
  '퀀트다람쥐G22','배당왕햄스터H33','인덱스펭귄I44',
];

const DISCUSSION_TEMPLATES = [
  { title: '오늘 시장 급락에 당신의 ETF 전략은?', content: '코스피 급락입니다. 여러분은 지금 어떻게 대응하고 계신가요?\n\n추가매수? 현금 보유? 아니면 인버스 진입?\n\n자유롭게 의견 나눠요 👇', poll: ['추가매수 기회!', '일단 현금 확보', '인버스 진입', '아무것도 안 함'] },
  { title: '이번 주 가장 주목하는 ETF는?', content: '이번 주 경제지표 발표가 많습니다.\n\nCPI, FOMC, 고용보고서... 여러분은 어떤 ETF를 주목하고 계신가요?', poll: ['반도체ETF', '방산ETF', '미국S&P500', '인버스ETF'] },
  { title: '지금 가장 매력적인 국내 테마 ETF는?', content: '국내 ETF 중 지금 가장 투자하고 싶은 테마가 뭔가요?', poll: ['반도체', '조선/방산', '원자력', '2차전지'] },
  { title: 'ETF 투자, 장기 보유 vs 단기 매매 어떻게 하세요?', content: 'ETF 투자 방식에 대해 이야기해봐요.', poll: ['장기 적립식', '테마 단기 매매', '반반', '모르겠음'] },
  { title: '연금저축/IRP에서 ETF 어떻게 굴리세요?', content: '연금계좌에서 ETF 투자하시는 분들 포트폴리오 공유해요!', poll: ['미국지수 위주', '국내 테마 위주', '배당/커버드콜', '기타'] },
];

// ── AI 댓글 ──
function buildCommentPrompt(post, briefing) {
  const category = post.category || '자유';
  const isETF = ['ETF', '펀드', '주식', '정보'].includes(category);
  if (isETF) {
    return `당신은 ETF 투자 커뮤니티의 경험 많은 개인투자자입니다.
아래 게시글에 투자 관점에서 공감하거나 인사이트를 더해주는 댓글을 달아주세요.

오늘의 시장 브리핑: ${briefing || '정보 없음'}
게시글 제목: ${post.title}
게시글 내용: ${post.content?.substring(0, 200) || ''}

규칙: 2~3문장 이내, 실제 시장 데이터나 ETF 관련 인사이트 포함, 자연스러운 구어체, 이모지 1~2개, 가끔 질문으로 끝내기, "AI입니다" 같은 말 금지

댓글만 출력:`;
  } else {
    return `당신은 ETF 투자 커뮤니티의 활발한 일반 회원입니다.
아래 게시글에 공감하거나 재미있게 반응하는 댓글을 달아주세요.

게시글 제목: ${post.title}
게시글 내용: ${post.content?.substring(0, 200) || ''}

규칙: 1~2문장으로 아주 짧게, 친근하고 가벼운 톤, 이모지 1~2개, 가끔 질문으로 끝내기

댓글만 출력:`;
  }
}

async function handleComment() {
  let briefing = '';
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1&select=summary`, { headers: H });
    const bd = await br.json();
    briefing = bd?.[0]?.summary || '';
  } catch(e) {}

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?comment_count=eq.0&category=neq.AI토론&created_at=gte.${since}&order=created_at.desc&limit=5`,
    { headers: H }
  );
  const posts = await r.json();
  if (!posts.length) return { message: '댓글 달 글 없음' };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const results = [];
  const targets = posts.slice(0, 2);

  for (const post of targets) {
    if (Math.random() < 0.3) continue;
    const prompt = buildCommentPrompt(post, briefing);
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    });
    const aiData = await aiRes.json();
    const comment = aiData?.content?.[0]?.text?.trim();
    if (comment && comment.length > 5) {
      const nick = AI_NICKS[Math.floor(Math.random() * AI_NICKS.length)];
      await fetch(`${SUPABASE_URL}/rest/v1/comments`, { method: 'POST', headers: H, body: JSON.stringify({ post_id: post.id, content: comment, nickname: nick }) });
      const rp = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post.id}&select=comment_count`, { headers: H });
      const p = (await rp.json())[0];
      await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ comment_count: (p.comment_count || 0) + 1 }) });
      results.push({ postId: post.id, comment, nick });
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return { message: `${results.length}개 댓글 달림`, results };
}

// ── 자동 토론 게시글 ──
async function handlePost() {
  const today = new Date().toISOString().split('T')[0];
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?category=eq.AI토론&created_at=gte.${today}T00:00:00&limit=1`,
    { headers: H }
  );
  const existing = await checkRes.json();
  if (existing.length > 0) return { message: '오늘 이미 게시글 있음' };

  let briefing = '';
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1&select=summary`, { headers: H });
    const bd = await br.json();
    briefing = bd?.[0]?.summary || '';
  } catch(e) {}

  let template = DISCUSSION_TEMPLATES[new Date().getDay() % DISCUSSION_TEMPLATES.length];
  if (briefing.includes('급락') || briefing.includes('폭락')) template = DISCUSSION_TEMPLATES[0];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && briefing) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5', max_tokens: 300,
          messages: [{ role: 'user', content: `오늘의 AI 시장 브리핑:\n${briefing}\n\n위 브리핑을 바탕으로 ETF 투자자들이 토론할 수 있는 게시글을 작성해주세요.\n\n반드시 아래 형식만 출력:\n[제목] 30자 이내 토론 유도 제목\n[내용] 3~4줄 토론 유도 내용 (친근한 말투)\n[투표1] 선택지1 (15자 이내)\n[투표2] 선택지2\n[투표3] 선택지3\n[투표4] 선택지4` }]
        })
      });
      const aiData = await aiRes.json();
      const text = aiData?.content?.[0]?.text || '';
      const title = text.match(/\[제목\]\s*(.+)/)?.[1]?.trim();
      const content = text.match(/\[내용\]\s*([\s\S]*?)(?=\[|$)/)?.[1]?.trim();
      const opts = [1,2,3,4].map(i => text.match(new RegExp(`\\[투표${i}\\]\\s*(.+)`))?.[1]?.trim()).filter(Boolean);
      if (title && content && opts.length >= 2) template = { title, content, poll: opts };
    } catch(e) {}
  }

  const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ title: template.title, content: template.content, category: 'AI토론', nickname: 'ETF레이더Bot', likes: 0, dislikes: 0, views: 0, comment_count: 0, poll_options: template.poll, poll_votes: new Array(template.poll.length).fill(0) })
  });
  const post = await postRes.json();
  return { message: '게시글 생성 완료', post: post[0] };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { type } = req.query;
  try {
    if (type === 'post') return res.status(200).json(await handlePost());
    if (type === 'comment') return res.status(200).json(await handleComment());
    return res.status(400).json({ error: 'type 파라미터 필요 (post 또는 comment)' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
