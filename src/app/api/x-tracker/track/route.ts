const SCRAPE_ST_API_KEY = '72c4b6224bb8b92a39490134e69128621d5f68363529fd00c6c71c43428ef917';
const BASE_URL = 'https://scrape.st';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    if (!username) {
      return Response.json({ error: 'Missing username' }, { status: 400 });
    }

    const res = await fetch(`${BASE_URL}/track-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SCRAPE_ST_API_KEY,
      },
      body: JSON.stringify({ username }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }
    return Response.json(data);
  } catch (error) {
    console.error('[x-tracker/track] POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { username } = await request.json();
    if (!username) {
      return Response.json({ error: 'Missing username' }, { status: 400 });
    }

    const res = await fetch(`${BASE_URL}/track-user`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SCRAPE_ST_API_KEY,
      },
      body: JSON.stringify({ username }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }
    return Response.json(data);
  } catch (error) {
    console.error('[x-tracker/track] DELETE error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
