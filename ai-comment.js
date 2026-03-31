// /api/ai-comment.js
// 댓글 없는 글에 AI가 자동으로 의미있는 댓글 달기
// Vercel Cron: 30분마다 실행

const SUPABASE_URL = 'https://aoqzohxljzghflkuuxhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const H = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation'
};

// AI 닉네임 풀 (다양하게 보이도록)
const AI_NICKS = [
  'ETF고수개구리A12', 'ETF분석판다B34', '투자고수코알라C56',
  '시장읽는여우D78', '데이터수달E90', '지수분석부엉이F11',
  '퀀트다람쥐G22', '배당왕햄스터H33', '인덱스펭귄I44',
];

function randomAINick() {
  return AI_NICKS[Math.floor(Math.random() * AI_NICKS.length)];
}

// 카테고리별 프롬프트 톤
function buildPrompt(post, briefing) {
  const category = post.category || '자유';
  const isETF = ['ETF', '펀드', '주식', '정보'].includes(category);

  if (isETF) {
    return `당신은 ETF 투자 커뮤니티의 경험 많은 개인투자자입니다.
아래 게시글에 투자 관점에서 공감하거나 인사이트를 더해주는 댓글을 달아주세요.

오늘의 시장 브리핑: ${briefing || '정보 없음'}

게시글 제목: ${post.title}
게시글 내용: ${post.content?.substring(0, 200) || ''}

규칙:
- 2~3문장 이내로 짧게
- 실제 시장 데이터나 ETF 관련 인사이트 포함
- 자연스러운 구어체 (~ 것 같아요, ~ 이네요, ~ 어떨까요?)
- 마치 실제 투자자가 쓴 것처럼 자연스럽게
- 절대 "AI입니다" 같은 말 금지
- 이모지 1~2개만
- 가끔 질문으로 끝내서 답글 유도

댓글만 출력:`;
  } else {
    return `당신은 ETF 투자 커뮤니티의 활발한 일반 회원입니다.
아래 게시글에 공감하거나 재미있게 반응하는 댓글을 달아주세요.

게시글 제목: ${post.title}
게시글 내용: ${post.content?.substring(0, 200) || ''}

규칙:
- 1~2문장으로 아주 짧게
- 친근하고 가벼운 톤
- 자연스러운 구어체
- 이모지 1~2개
- 가끔 질문으로 끝내기

댓글만 출력:`;
  }
}

async function addAIComment(postId, content, nickname) {
  // 댓글 추가
  await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ post_id: postId, content, nickname })
  });

  // comment_count 업데이트
  const r = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=comment_count`, { headers: H });
  const p = (await r.json())[0];
  await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ comment_count: (p.comment_count || 0) + 1 })
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // 오늘의 AI 브리핑 가져오기
    let briefing = '';
    try {
      const br = await fetch(`${SUPABASE_URL}/rest/v1/ai_summary_cache?id=eq.1&select=summary`, { headers: H });
      const bd = await br.json();
      briefing = bd?.[0]?.summary || '';
    } catch(e) {}

    // 댓글 0개인 최근 글 가져오기 (AI토론 제외, 24시간 이내)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?comment_count=eq.0&category=neq.AI토론&created_at=gte.${since}&order=created_at.desc&limit=5`,
      { headers: H }
    );
    const posts = await r.json();

    if (!posts.length) {
      return res.status(200).json({ message: '댓글 달 글 없음' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const results = [];

    // 최대 2개 글에만 댓글 달기 (너무 많으면 부자연스러움)
    const targets = posts.slice(0, 2);

    for (const post of targets) {
      // 30% 확률로 스킵 (모든 글에 달면 부자연스러움)
      if (Math.random() < 0.3) continue;

      const prompt = buildPrompt(post, briefing);

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const aiData = await aiRes.json();
      const comment = aiData?.content?.[0]?.text?.trim();

      if (comment && comment.length > 5) {
        const nick = randomAINick();
        await addAIComment(post.id, comment, nick);
        results.push({ postId: post.id, title: post.title, comment, nick });

        // 연속 호출 방지 (0.5초 간격)
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return res.status(200).json({ message: `${results.length}개 댓글 달림`, results });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
