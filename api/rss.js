export default async function handler(req) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response('no url', { status: 400 });
  try {
    const r = await fetch(url);
    const text = await r.text();
    return new Response(text, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/xml; charset=utf-8'
      }
    });
  } catch(e) {
    return new Response(e.message, { status: 500 });
  }
}

