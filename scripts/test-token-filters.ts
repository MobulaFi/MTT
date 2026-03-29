/**
 * Test script for token/filters endpoint (REST + WSS)
 * Run: bun apps/mtt/scripts/test-token-filters.ts
 */

const API_KEY = 'a1ca9490-e255-42cd-96eb-9ddb5931c8fd';
const REST_URL = 'https://api-2.mobula.io/api/2/token/filters';
const WSS_URL = 'wss://api-2.mobula.io';

const payload = {
  mode: 'token',
  views: {
    trending: {
      sortBy: 'feesPaid1minUSD',
      sortOrder: 'desc',
      limit: 5,
      filters: {
        chainId: { in: ['solana:solana', 'evm:56', 'evm:8453'] },
      },
    },
  },
};

async function testRest() {
  console.log('=== REST TEST ===');
  console.log(`POST ${REST_URL}`);

  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify(payload),
  });

  console.log(`Status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    console.error('ERROR:', await res.text());
    return;
  }

  const data = await res.json();
  console.log('subscriptionId:', data.subscriptionId);

  const tokens = data?.views?.trending?.data;
  if (tokens && Array.isArray(tokens)) {
    console.log(`Got ${tokens.length} tokens:`);
    for (const t of tokens) {
      console.log(
        `  ${t.symbol || '(no symbol)'} | ${t.chainId} | $${t.priceUSD?.toFixed(8)} | MC $${t.marketCapUSD?.toFixed(0)} | 5min ${t.priceChange5minPercentage?.toFixed(2) ?? t.priceChangePercentage5min?.toFixed(2) ?? '?'}%`
      );
    }
  } else {
    console.log('No tokens in response. Full response:', JSON.stringify(data, null, 2).slice(0, 1000));
  }
}

function testWss(): Promise<void> {
  return new Promise((resolve) => {
    console.log('\n=== WSS TEST ===');
    console.log(`Connecting to ${WSS_URL}`);

    const ws = new WebSocket(WSS_URL);
    let messageCount = 0;

    ws.onopen = () => {
      console.log('Connected. Sending subscription...');
      ws.send(
        JSON.stringify({
          type: 'token-filters',
          authorization: API_KEY,
          payload,
        })
      );
    };

    ws.onmessage = (event) => {
      messageCount++;
      const msg = JSON.parse(event.data);

      if (msg.event === 'ping') {
        ws.send(JSON.stringify({ event: 'ping' }));
        console.log(`  [${messageCount}] ping/pong`);
        return;
      }

      if (msg.event === 'subscribed' || msg.type === 'init') {
        console.log(`  [${messageCount}] ${msg.event || msg.type}:`, JSON.stringify(msg).slice(0, 200));
        return;
      }

      const type = msg.type;
      const token = msg.payload?.token;
      if (token) {
        console.log(
          `  [${messageCount}] ${type} | ${msg.payload?.viewName} | ${token.symbol || '?'} (${token.chainId}) $${token.priceUSD?.toFixed(8) ?? '?'}`
        );
      } else {
        console.log(`  [${messageCount}] ${type}:`, JSON.stringify(msg).slice(0, 200));
      }

      // Stop after 20 messages
      if (messageCount >= 20) {
        console.log('\nGot 20 messages. Closing.');
        ws.close();
        resolve();
      }
    };

    ws.onerror = (e) => {
      console.error('WSS error:', e);
    };

    ws.onclose = () => {
      console.log('WSS closed.');
      resolve();
    };

    // Timeout after 30s
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`\nTimeout. Got ${messageCount} messages. Closing.`);
        ws.close();
      }
      resolve();
    }, 30000);
  });
}

async function main() {
  await testRest();
  await testWss();
}

main().catch(console.error);
