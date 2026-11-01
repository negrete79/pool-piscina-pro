// ============================================================
// PoolApp Universal · POST /api/editar-pagamento
// Painel admin: corrige nome/e-mail de um pagamento
// (resolve os "--" de pagamentos antigos do Mercado Pago).
// Recebe: { token (JWT), id, nome?, email? }
// Devolve: { ok, id, override }
// O /api/listar-pagamentos aplica automaticamente estes
// overrides quando listar de novo.
// ============================================================
const admin = require('./_admin.js');

module.exports = async (req, res) => {
  if (admin.preflight(req, res)) return;
  if (req.method !== 'POST') return admin.end(res, 405, { error: 'Use POST com { id, nome, email }' });

  const jwt = admin.verify(admin.bearer(req));
  if (!jwt) return admin.end(res, 401, { error: 'Sessão expirada — entre novamente' });

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}
  const id = String(body.id || '').trim();
  if (!id) return admin.end(res, 400, { error: 'Informe o id do pagamento' });

  const patch = {};
  const nome = String(body.nome || '').trim();
  if (nome) patch.nome = nome.slice(0, 80);
  const email = String(body.email || '').trim().toLowerCase();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return admin.end(res, 400, { error: 'E-mail inválido' });
    patch.email = email;
  }
  if (!patch.nome && !patch.email) return admin.end(res, 400, { error: 'Nada para salvar' });

  const ov = admin.setOverride(id, patch);
  try { console.log('[editar-pagamento] ' + id + ' por ' + (jwt.e || 'admin')); } catch (e) {}
  admin.end(res, 200, { ok: true, id, override: ov, msg: 'Dados salvos' });
};
