// ============================================================
// PoolApp Universal · GET /api/check-license
// Duas funções em um endpoint:
//   ?payment_id=123   → consulta o pagamento Pix no Mercado Pago
//                       e responde { paid:true, expires:+30d } se aprovado.
//   ?code=POOL-XXXX   → valida código de ativação manual
//                       (lista na env POOL_CODES, ex.: "POOL-2026,POOL-ELIAS").
//                       Sem POOL_CODES configurada, aceita o formato POOL- + 4 caracteres.
// Requer: MERCADOPAGO_ACCESS_TOKEN (para consulta de pagamento)
// ============================================================
const DAY_MS = 86400 * 1000;
const LIC_DAYS = 30;

function end(res, code, obj) {
  res.writeHead(code, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  });
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return end(res, 204, {});
  if (req.method !== 'GET') return end(res, 405, { error: 'Use GET' });

  const url = new URL(req.url, 'http://x');
  const pid = url.searchParams.get('payment_id');
  const code = (url.searchParams.get('code') || '').trim().toUpperCase();
  const expires = Date.now() + LIC_DAYS * DAY_MS;

  // ---- 1) Consulta de pagamento Pix ----
  if (pid) {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) return end(res, 500, { error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' });
    try {
      const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(pid), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const j = await r.json();
      const approved = j && j.status === 'approved';
      const valorOk = Number(j && j.transaction_amount) >= 29.89; // licença fixa R$ 29,90
      const nosso = j && typeof j.external_reference === 'string' && j.external_reference.indexOf('poolapp') === 0;
      if (approved && valorOk && nosso) return end(res, 200, { paid: true, expires, status: j.status });
      return end(res, 200, { paid: false, status: (j && j.status) || 'unknown' });
    } catch (e) {
      return end(res, 500, { error: 'Falha ao consultar Mercado Pago', detail: String((e && e.message) || e) });
    }
  }

  // ---- 2) Código de ativação manual ----
  if (code) {
    const list = (process.env.POOL_CODES || '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const valid = list.length ? list.includes(code) : /^POOL-[A-Z0-9]{4}$/.test(code);
    return end(res, 200, { valid, expires });
  }

  return end(res, 400, { error: 'Informe payment_id ou code' });
};
