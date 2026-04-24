// Server-side Clover charge handler.
// Secrets (CLOVER_API_TOKEN, CLOVER_MERCHANT_ID) must be set as Netlify environment variables.

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function jsonResponse(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const CLOVER_API_TOKEN = process.env.CLOVER_API_TOKEN;
  const MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;
  const CLOVER_BASE = process.env.CLOVER_BASE_URL || 'https://scl-sandbox.dev.clover.com';

  if (!CLOVER_API_TOKEN || !MERCHANT_ID) {
    return jsonResponse(500, { error: 'Payment processor not configured.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid request body.' });
  }

  const { token, amount, currency = 'USD', description } = body;

  // Validate token: must be a string matching Clover's token format (clv_...)
  if (typeof token !== 'string' || token.length < 10 || token.length > 200) {
    return jsonResponse(400, { error: 'Invalid payment token.' });
  }
  // Validate amount: must be a positive integer (cents), cap at $10,000 to prevent abuse.
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0 || amt > 1000000) {
    return jsonResponse(400, { error: 'Invalid amount.' });
  }
  // Validate currency: must be a 3-letter code.
  const cur = typeof currency === 'string' ? currency.toUpperCase().slice(0, 3) : 'USD';
  if (!/^[A-Z]{3}$/.test(cur)) {
    return jsonResponse(400, { error: 'Invalid currency.' });
  }
  // Sanitize description: strip control chars, limit length.
  const safeDesc = typeof description === 'string'
    ? description.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200)
    : 'Biryani Temptations Order';

  try {
    const response = await fetch(`${CLOVER_BASE}/v1/charges`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOVER_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Clover-Merchant-Id': MERCHANT_ID,
      },
      body: JSON.stringify({
        amount: amt,
        currency: cur.toLowerCase(),
        source: token,
        description: safeDesc,
        capture: true,
      }),
    });

    let data = {};
    try { data = await response.json(); } catch { /* non-json response */ }

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: (data && (data.message || data.error)) || 'Payment failed.',
      });
    }

    return jsonResponse(200, {
      success: true,
      chargeId: data.id,
      status: data.status,
    });
  } catch (err) {
    console.error('Clover charge error:', err && err.message);
    return jsonResponse(500, { error: 'Payment server error.' });
  }
};
