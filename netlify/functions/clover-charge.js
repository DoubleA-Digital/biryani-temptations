exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const CLOVER_API_TOKEN = process.env.CLOVER_API_TOKEN;
  const MERCHANT_ID = process.env.CLOVER_MERCHANT_ID || '3RCRKAWHN6F41';
  const CLOVER_BASE = 'https://scl-sandbox.dev.clover.com';

  if (!CLOVER_API_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Payment processor not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { token, amount, currency = 'USD', description } = body;

  if (!token || !amount || amount <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing token or amount.' }) };
  }

  try {
    const response = await fetch(`${CLOVER_BASE}/v1/charges`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOVER_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Clover-Merchant-Id': MERCHANT_ID,
      },
      body: JSON.stringify({
        amount: Math.round(amount),
        currency: currency.toLowerCase(),
        source: token,
        description: description || 'Biryani Temptations Order',
        capture: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.message || data.error || 'Payment failed.' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, chargeId: data.id, status: data.status }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Payment server error.' }) };
  }
};
