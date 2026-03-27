export default async function handler(req) {
  const symbols = '^KS11,^KQ11,KRW=X,GC=F,^TNX';
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=60'
      }
    });
  } catch(e) {
    return new Response(e.message, { status: 500 });
  }
}
