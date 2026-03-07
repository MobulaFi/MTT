const SCRAPE_ST_API_KEY = '72c4b6224bb8b92a39490134e69128621d5f68363529fd00c6c71c43428ef917';

export async function GET() {
  try {
    const res = await fetch('https://scrape.st/tracked-users', {
      headers: { 'x-api-key': SCRAPE_ST_API_KEY },
      cache: 'no-store',
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }
    return Response.json(data);
  } catch (error) {
    console.error('[x-tracker/tracked-users] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
