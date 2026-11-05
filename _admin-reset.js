// ============================================================
// PoolApp Universal · POST /api/admin-reset
// Redefinição de senha (passo 2 da recuperação).
// Recebe: { token, nova_senha }  — token gerado por
// /api/recuperar-senha (válido por 30 minutos, uso único).
// Devolve: { ok, msg }  → o painel volta para o login.
// ============================================================
const admin = require('./_admin.js');

module.exports = async (req, res) => {
  if (admin.preflight(req, res)) return;
  if (req.method !== 'POST') return admin.end(res, 405, { error: 'Use POST com { token, nova_senha }' });

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}

  const token = String(body.token || '').trim();
  const nova = String(body.nova_senha || '');
  if (!token) return admin.end(res, 400, { error: 'Token ausente' });
  if (nova.length < 6) return admin.end(res, 400, { error: 'A nova senha precisa de no mínimo 6 caracteres' });

  const t = admin.takeResetToken(token);
  if (!t) return admin.end(res, 400, { error: 'Link inválido ou expirado. Peça um novo em "Esqueceu a senha?"' });

  const d = admin.getDB();
  d.admin.senha = nova;
  admin.saveDB(d);
  try { console.log('[admin-reset] senha redefinida para ' + t.email); } catch (e) {}

  admin.end(res, 200, { ok: true, msg: 'Senha alterada com sucesso' });
};
