// ============================================================
// PoolApp Universal · POST /api/criar-pix
// Cria um pagamento Pix FIXO de R$ 29,90 (assinatura mensal, 30 dias).
// Recebe: { litros: 45000, device_id: "..." }  (email opcional)
// Devolve: { id, status, qr_code (copia e cola), qr_code_base64 (imagem QR) }
//
// Token: variável de ambiente MP_ACCESS_TOKEN configurada na Vercel
// (fallback: MERCADOPAGO_ACCESS_TOKEN, para compatibilidade).
// ============================================================
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || '';

const PRECO_MENSAL = 29.90;   // assinatura fixa do app (R$ 29,90 / 30 dias)
const LIC_DAYS = 30;

function fmtLitros(n) {
  return String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

module.exports = async (req, res) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method !== 'POST') {
    res.writeHead(405, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Use POST com { litros, device_id }' }));
  }
  if (!MP_ACCESS_TOKEN) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'MP_ACCESS_TOKEN não configurado na Vercel' }));
  }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}

  const litros    = Math.round(Number(body.litros ?? body.litragem ?? 0)) || 0;
  const device_id = String(body.device_id || 'desconhecido').slice(0, 64);
  const amount = PRECO_MENSAL; // fixo — a assinatura é R$ 29,90 independente da litragem
  const description = 'PoolApp Universal - Licença ' + LIC_DAYS + ' dias - ' + fmtLitros(litros) + 'L';

  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MP_ACCESS_TOKEN,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'poolapp-' + device_id + '-' + Date.now()
      },
      body: JSON.stringify({
        transaction_amount: Math.round(amount * 100) / 100,
        description,
        payment_method_id: 'pix',
        external_reference: 'poolapp-lic-30d',
        metadata: { device_id, litros, timestamp: Date.now(), nome: String(body.nome || '').slice(0, 80) },
        payer: {
          email: String(body.email || process.env.PAYER_EMAIL || 'poolapp@exemplo.com'),
          first_name: String(body.nome || '').trim().split(/\s+/)[0].slice(0, 60) || undefined
        }
      })
    });
    const j = await r.json();
    if (!r.ok) {
      res.writeHead(r.status, { ...CORS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Mercado Pago recusou a criação do Pix', detail: j }));
    }
    const td = (j.point_of_interaction && j.point_of_interaction.transaction_data) || {};
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: j.id,
      status: j.status,
      valor: amount,
      descricao: description,
      qr_code: td.qr_code || null,          // código copia e cola
      qr_code_base64: td.qr_code_base64 || null // imagem QR
    }));
  } catch (e) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Falha ao falar com o Mercado Pago', detail: String((e && e.message) || e) }));
  }
};
