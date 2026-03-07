import { NextRequest } from 'next/server';

const SCRAPE_ST_API_KEY = '72c4b6224bb8b92a39490134e69128621d5f68363529fd00c6c71c43428ef917';

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');
    if (!username) {
      return Response.json({ error: 'Missing username query param' }, { status: 400 });
    }

    const res = await fetch(
      `https://scrape.st/x/user?username=${encodeURIComponent(username)}`,
      {
        headers: { 'x-api-key': SCRAPE_ST_API_KEY },
        cache: 'no-store',
      },
    );

    const data = await res.json();
    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }
    return Response.json(data);
  } catch (error) {
    console.error('[x-tracker/user] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
