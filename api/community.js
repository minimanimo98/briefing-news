// /api/community.js
// ?type=post              → 오늘의 AI 토론 게시글 생성 (vercel cron: 하루 1회)
// ?type=comment&post_id=X → 특정 게시글에 AI 댓글 1개
// ?type=telegram          → 텔레그램 시간대별 브리핑 (cron-job.org: 매시간)

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

// 시간대별 브리핑 설정
const TELEGRAM_SCHEDULE = {
  8:  { title: '📊 ETF레이더 아침 브리핑', theme: '오늘 주목할 ETF 테마와 시장 전망', prompt: '아침 시작 전 오늘 주목할 ETF 테마와 시장 전망을 3~4줄로 요약해줘.' },
  9:  { title: '🔔 장 시작! 주목 ETF', theme: '장 시작 직후 주목할 ETF와 테마', prompt: '장 시작 직후 주목할 ETF와 테마를 2~3줄로 짧게 알려줘. 활기찬 톤으로.' },
  11: { title: '📈 오전 장중 이슈', theme: '오전 장중 핵심 이슈와 ETF 흐름', prompt: '오전 장중 핵심 이슈와 ETF 흐름을 2~3줄로 요약해줘.' },
  13: { title: '🍱 점심 ETF 뉴스', theme: '오늘 점심 꼭 알아야 할 ETF 뉴스', prompt: '오늘 점심 꼭 알아야 할 ETF 뉴스를 2~3줄로 캐주얼하게 요약해줘.' },
  14: { title: '⚡ 오후 장중 테마', theme: '오후 장중 급등락 테마 ETF', prompt: '오후 장중 주목할 테마 ETF를 2~3줄로 알려줘. 변동성 중심으로.' },
  15: { title: '🔔 장 마감 임박!', theme: '장 마감 전 막판 체크포인트', prompt: '장 마감 전 투자자가 체크해야 할 포인트를 2~3줄로 알려줘.' },
  16: { title: '📉 오늘 장 마감 결산', theme: '오늘 장 마감 ETF 결산', prompt: '오늘 장 마감 ETF 결산을 3~4줄로 요약해줘. 핵심 등락 테마 중심으로.' },
  18: { title: '🌇 오늘 ETF 정리', theme: '오늘 하루 ETF 시장 총정리', prompt: '오늘 하루 ETF 시장을 3~4줄로 총정리해줘. 내일 전략 힌트도 한 줄 추가.' },
  20: { title: '🌙 내일 ETF 전망', theme: '내일 ETF 시장 전망과 주목 테마', prompt: '내일 ETF 시장 전망과 주목 테마를 3~4줄로 알려줘. 미국장 흐름도 포함.' },
  22: { title: '🇺🇸 미국장 시작 브리핑', theme: '미국장 시작 ETF 투자자 체크포인트', prompt: '미국장 시작 ETF 투자자가 체크할 포인트를 3~4줄로 알려줘.' },
};

// ── 텔레그램 브리핑 발송 ──
async function handleTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!botToken || !channelId) return { message: '텔레그램 환경변수 없음' };

  // 한국 시간 기준 현재 시간
  const hour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  const schedule = TELEGRAM_SCHEDULE[hour];
  if (!schedule) return { message: `${hour}시는 브리핑 없음` };

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // 1. 브리핑 + 뉴스 가져오기
  let briefing = '';
  let headlines = [];
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?select=summary&limit=1`, { headers: H });
    const bd = await br.json();
    briefing = bd?.[0]?.summary || '';
  } catch(e) {}

  try {
    const rssUrl = `https://news.google.com/rss/search?q=ETF+${encodeURIComponent(schedule.theme)}&hl=ko&gl=KR&ceid=KR:ko`;
    const res = await fetch(`https://etfradar.kr/api/rss?url=${encodeURIComponent(rssUrl)}`);
    const text = await res.text();
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
    for (const item of items.slice(0, 4)) {
      const t = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      if (t && t[1]) {
        const title = t[1].replace(/\s+-\s+.+$/, '').replace(/<[^>]+>/g, '').trim();
        if (title && title.length > 5 && !title.includes('Google')) headlines.push(title);
      }
    }
  } catch(e) {}

  // 2. AI 메시지 생성
  let aiMessage = '';
  if (apiKey) {
    try {
      const prompt = `${briefing ? `오늘 시장 브리핑: ${briefing}\n\n` : ''}${headlines.length ? `관련 뉴스:\n${headlines.slice(0,3).map((h,i) => `${i+1}. ${h}`).join('\n')}\n\n` : ''}${schedule.prompt}
- 친근하고 간결한 톤
- 이모지 1~2개 활용
- 마지막에 마침표 없이
- 텍스트만 출력`;

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const aiData = await aiRes.json();
      aiMessage = aiData?.content?.[0]?.text?.trim() || '';
    } catch(e) {}
  }

  // 3. 최종 메시지
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString().split('T')[0].replace(/-/g, '.');

  const message = `${schedule.title} (${today})

${aiMessage || schedule.theme}

🔍 ETF 실시간 분석 → https://etfradar.kr`;

  // 4. 발송
  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: message,
      disable_web_page_preview: false
    })
  });
  const tgData = await tgRes.json();
  if (!tgData.ok) return { message: '텔레그램 발송 실패', error: tgData };
  return { message: '텔레그램 브리핑 발송 완료', hour, title: schedule.title };
}

// ── AI 댓글 ──
async function handleComment(postId) {
  if (!postId || isNaN(postId)) return { message: 'post_id 필요' };

  const checkR = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=id,title,content,category,comment_count`,
    { headers: H }
  );
  const posts = await checkR.json();
  const post = posts[0];
  if (!post) return { message: '게시글 없음' };
  if ((post.comment_count || 0) > 0) return { message: '이미 댓글 있음 - 스킵' };

  let briefing = '';
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?select=summary&limit=1`, { headers: H });
    const bd = await br.json();
    briefing = bd?.[0]?.summary?.substring(0, 200) || '';
  } catch(e) {}

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

  const nick = AI_NICKS[Math.floor(Math.random() * AI_NICKS.length)];
  await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ post_id: postId, content: comment, nickname: nick })
  });
  await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ comment_count: 1 })
  });

  return { message: 'AI 댓글 달림', comment, nick };
}

// ── 오늘의 AI 토론 게시글 ──
async function handlePost() {
  const today = new Date().toISOString().split('T')[0];

  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?category=eq.AI토론&created_at=gte.${today}T00:00:00&limit=1`,
    { headers: H }
  );
  const existing = await checkRes.json();
  if (existing.length > 0) return { message: '오늘 이미 생성됨' };

  let briefing = '';
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?select=summary&limit=1`, { headers: H });
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
    if (type === 'post')     return res.status(200).json(await handlePost());
    if (type === 'comment')  return res.status(200).json(await handleComment(parseInt(post_id)));
    if (type === 'telegram') return res.status(200).json(await handleTelegram());
    return res.status(400).json({ error: 'type 파라미터 필요 (post / comment / telegram)' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
