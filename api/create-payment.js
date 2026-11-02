// ============================================================
// PoolApp Universal · POST /api/create-payment
// Cria um pagamento Pix de R$ 29,90 no Mercado Pago (legado — use /api/criar-pix).
// Requer variável de ambiente: MERCADOPAGO_ACCESS_TOKEN
// Opcional: PAYER_EMAIL (e-mail do pagador padrão)
// Deploy: Vercel — a pasta /api vira functions automaticamente.
// ============================================================
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "SEU_ACCESS_TOKEN";
const MP_PUBLIC_KEY   = process.env.MERCADOPAGO_PUBLIC_KEY   || "SEU_PUBLIC_KEY";
const PRECO_MENSAL = 29.90;

module.exports = async (req, res) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method !== 'POST') {
    res.writeHead(405, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Use POST' }));
  }
  const token = MP_ACCESS_TOKEN;
  if (!token || token === 'SEU_ACCESS_TOKEN') {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado na Vercel' }));
  }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}
  const amount = Math.max(1, Number(body.amount) || PRECO_MENSAL);
  const description = String(body.description || 'PoolApp Universal — licença mensal');

  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'poolapp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
      },
      body: JSON.stringify({
        transaction_amount: Math.round(amount * 100) / 100,
        description,
        payment_method_id: 'pix',
        external_reference: 'poolapp-lic-30d',
        payer: { email: process.env.PAYER_EMAIL || 'poolapp@exemplo.com' }
      })
    });
    const j = await r.json();
    if (!r.ok) {
      res.writeHead(r.status, { ...CORS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Mercado Pago recusou a criação', detail: j }));
    }
    const td = (j.point_of_interaction && j.point_of_interaction.transaction_data) || {};
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: j.id,
      status: j.status,
      qr_code: td.qr_code || null,          // código copia e cola
      qr_code_base64: td.qr_code_base64 || null // imagem QR
    }));
  } catch (e) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Falha ao falar com o Mercado Pago', detail: String((e && e.message) || e) }));
  }
};
