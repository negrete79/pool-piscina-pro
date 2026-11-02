// ============================================================
// PoolApp Universal · GET /api/check-status
// Duas funções em um endpoint:
//   ?id=123456789        → consulta o pagamento Pix no Mercado Pago.
//                          Se approved (e valor ok), responde
//                          { paid:true, status:'approved', expira:+30d }.
//   ?code=XXXX-XXXX-XXXX → valida código de ativação manual.
//                          1) Lista na env POOL_CODES (separados por vírgula;
//                             aceita "CODIGO:dias", ex.: "ABCD-EFGH-JKLM:365",
//                             ":0" = vitalício; sem ":dias" vale 30 dias).
//                          2) Código com plano embutido gerado pelo painel
//                             (60 d, 6 meses, 1 ano, vitalício — ver _admin.js).
//                          3) Sem POOL_CODES, aceita o formato 4-4-4
//                             (grupos de 4 caracteres alfanuméricos) → 30 dias.
// Token: MP_ACCESS_TOKEN na Vercel (fallback MERCADOPAGO_ACCESS_TOKEN).
// ============================================================
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const admin = require('./_admin.js');   /* plano embutido nos códigos gerados pelo painel */
const LIC_DAYS = 30;
const VALOR_MINIMO = 29.89; // assinatura fixa R$ 29,90 (tolerância de 1 centavo)

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
  const pid = url.searchParams.get('id');
  const code = (url.searchParams.get('code') || '').trim().toUpperCase();
  const expira = Date.now() + LIC_DAYS * 86400 * 1000;   /* usado na consulta de Pix (30 dias) */

  // ---- 1) Consulta de pagamento Pix (polling do app, a cada 4 s) ----
  if (pid) {
    if (!MP_ACCESS_TOKEN) return end(res, 500, { error: 'MP_ACCESS_TOKEN não configurado' });
    try {
      const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(pid), {
        headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }
      });
      const j = await r.json();
      const approved = j && j.status === 'approved';
      const valorOk = Number(j && j.transaction_amount) >= VALOR_MINIMO;
      const nosso = j && typeof j.external_reference === 'string' && j.external_reference.indexOf('poolapp') === 0;
      if (approved && valorOk && nosso) return end(res, 200, { paid: true, status: 'approved', expira });
      return end(res, 200, { paid: false, status: (j && j.status) || 'unknown' });
    } catch (e) {
      return end(res, 500, { error: 'Falha ao consultar Mercado Pago', detail: String((e && e.message) || e) });
    }
  }

  // ---- 2) Código de ativação manual ----
  if (code) {
    const expiraDe = dias => dias === 0
      ? Date.now() + admin.COD_VITAL_DIAS * 86400 * 1000     /* vitalício: 10 anos na prática */
      : Date.now() + dias * 86400 * 1000;

    // 2a) lista POOL_CODES (com suporte a "CODIGO:dias"; ":0" = vitalício)
    const list = (process.env.POOL_CODES || '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    for (const item of list) {
      const sep = item.indexOf(':');
      const cd = sep === -1 ? item : item.slice(0, sep);
      if (cd !== code) continue;
      const dd = sep === -1 ? '' : Number(item.slice(sep + 1));
      const dias = (sep === -1 || isNaN(dd)) ? LIC_DAYS : Math.max(0, dd);
      return end(res, 200, { valid: true, dias, expira: expiraDe(dias) });
    }

    // 2b) código com plano embutido (gerado pelo painel: 60 d, 6 meses, 1 ano, vitalício)
    const plano = admin.planoDeCodigo(code);
    if (plano) return end(res, 200, { valid: true, dias: plano.dias, expira: expiraDe(plano.dias) });

    // 2c) formato antigo (4-4-4) — códigos aleatórios de 30 dias (compatibilidade)
    const formatoOk = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
    return end(res, 200, { valid: formatoOk, dias: LIC_DAYS, expira: expiraDe(LIC_DAYS) });
  }

  return end(res, 400, { error: 'Informe id ou code' });
};
