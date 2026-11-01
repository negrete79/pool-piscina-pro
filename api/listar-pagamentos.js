// ============================================================
// PoolApp Universal · GET /api/listar-pagamentos
// Usado SOMENTE pelo painel do administrador (/admin.html).
// Consulta o Mercado Pago (endpoint /v1/payments/search) e
// devolve os pagamentos Pix criados pelo app nos últimos 90
// dias, mais recentes primeiro.
// Resposta: { ok, total, pagamentos: [{ id, data, nome, email,
//            valor, status, device_id }] }
//
// Proteção: header "x-admin-key" — valor da env ADMIN_KEY na
// Vercel ou, se não configurada, o padrão "SEJA".
// Token: MP_ACCESS_TOKEN na Vercel (fallback MERCADOPAGO_ACCESS_TOKEN).
// ============================================================
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const ADMIN_KEY = process.env.ADMIN_KEY || 'SEJA';
const admin = require('./_admin.js');   /* aceita também Authorization: Bearer <JWT do painel> */
const DIAS_HISTORICO = 90;
const LIMITE = 50;

function end(res, code, obj) {
  res.writeHead(code, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  });
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return end(res, 204, {});
  const jwt = admin.verify(admin.bearer(req));          /* sessão nova do painel */
  const key = String(req.headers['x-admin-key'] || '');  /* chave legada (compatibilidade) */
  if (!jwt && (!key || key !== ADMIN_KEY)) return end(res, 401, { error: 'Senha admin incorreta' });
  if (req.method !== 'GET') return end(res, 405, { error: 'Use GET' });
  if (!MP_ACCESS_TOKEN) return end(res, 500, { error: 'MP_ACCESS_TOKEN não configurado na Vercel' });

  const ini = new Date(Date.now() - DIAS_HISTORICO * 86400 * 1000);
  const qs = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    range: 'date_created',
    begin_date: ini.toISOString(),
    end_date: new Date().toISOString(),
    limit: String(LIMITE)
  });

  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments/search?' + qs.toString(), {
      headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN }
    });
    const j = await r.json();
    if (!r.ok) return end(res, r.status, { error: 'Mercado Pago recusou a consulta', detail: j });

    const resultados = (j && j.results) || [];
    const nossos = resultados.filter(p =>
      (typeof p.external_reference === 'string' && p.external_reference.indexOf('poolapp') === 0) ||
      (typeof p.description === 'string' && p.description.indexOf('PoolApp') !== -1)
    );
    const pagamentos = nossos.map(p => {
      const base = {
        id: p.id,
        data: p.date_created,
        nome: (p.metadata && p.metadata.nome)
              || [p.payer && p.payer.first_name, p.payer && p.payer.last_name].filter(Boolean).join(' ')
              || '',
        email: (p.payer && p.payer.email) || '',
        valor: p.transaction_amount,
        status: p.status,
        device_id: (p.metadata && p.metadata.device_id) || ''
      };
      /* overrides salvos pelo painel (Editar nome/e-mail / Excluir) corrigem os "--" */
      const ov = admin.getOverrides()[String(p.id)];
      if (ov) {
        if (ov.nome)  base.nome = ov.nome;
        if (ov.email) base.email = ov.email;
        if (ov.excluido) base.status = 'cancelled';
      }
      return base;
    });
    return end(res, 200, { ok: true, total: pagamentos.length, pagamentos });
  } catch (e) {
    return end(res, 500, { error: 'Falha ao falar com o Mercado Pago', detail: String((e && e.message) || e) });
  }
};
