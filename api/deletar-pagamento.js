// ============================================================
// PoolApp Universal · POST /api/deletar-pagamento
// Painel admin: excluir/cancelar pagamento de quem desistiu.
// Recebe: { token (JWT), id }  — id do pagamento no MP.
//  1) tenta cancelar no Mercado Pago (status "cancelled");
//  2) marca o override local `excluido` (aparece como
//     "Cancelado" e entra no filtro "Desistentes").
// Resposta: { ok, id, status_mp, msg }
// ============================================================
const admin = require('./_admin.js');
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || '';

module.exports = async (req, res) => {
  if (admin.preflight(req, res)) return;
  if (req.method !== 'POST') return admin.end(res, 405, { error: 'Use POST com { id }' });

  const jwt = admin.verify(admin.bearer(req));
  if (!jwt) return admin.end(res, 401, { error: 'Sessão expirada — entre novamente' });

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}
  const id = String(body.id || '').trim();
  if (!id) return admin.end(res, 400, { error: 'Informe o id do pagamento' });

  let statusMp = 'local';
  if (MP_ACCESS_TOKEN) {
    try {
      const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + MP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      const j = await r.json().catch(() => ({}));
      statusMp = (j && j.status) || (r.ok ? 'cancelled' : 'mp-' + r.status);
      if (!r.ok) console.log('[deletar-pagamento] MP recusou ' + id + ': ' + r.status);
    } catch (e) {
      console.log('[deletar-pagamento] falha MP: ' + e.message);
    }
  }

  admin.setOverride(id, { excluido: true });
  try { console.log('[deletar-pagamento] ' + id + ' por ' + (jwt.e || 'admin')); } catch (e) {}

  admin.end(res, 200, {
    ok: true,
    id,
    status_mp: statusMp,
    msg: 'Pagamento marcado como cancelado/desistente.'
  });
};
