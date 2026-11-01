// ============================================================
// PoolApp Universal · POST /api/admin-login
// Login do painel administrativo (/admin.html).
// Recebe: { email, senha }
// Devolve: { ok, token (JWT 2 h), nome, email, expira }
// Credenciais iniciais: admin@poolapp.com / pool2026
//   (ou env ADMIN_EMAIL / ADMIN_PASSWORD — mudáveis em
//    Painel → Configurações, via /api/admin-config).
// Segurança: 3 erros seguidos bloqueiam o e-mail por 5 minutos.
// ============================================================
const admin = require('./_admin.js');

module.exports = async (req, res) => {
  if (admin.preflight(req, res)) return;
  if (req.method !== 'POST') return admin.end(res, 405, { error: 'Use POST com { email, senha }' });

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}

  const email = String(body.email || '').trim().toLowerCase();
  const senha = String(body.senha || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !senha) {
    return admin.end(res, 400, { error: 'Informe e-mail e senha' });
  }

  if (admin.isLocked(email)) {
    return admin.end(res, 429, {
      error: 'Muitas tentativas. Painel bloqueado por ' + admin.lockMinutes(email) + ' minuto(s).',
      bloqueado: true,
      minutos: admin.lockMinutes(email)
    });
  }

  const creds = admin.getDB().admin;
  if (email !== creds.email || senha !== creds.senha) {
    const f = admin.registerFail(email);
    if (f.until > Date.now()) {
      return admin.end(res, 429, {
        error: '3 tentativas erradas. Painel bloqueado por ' + admin.lockMinutes(email) + ' minuto(s).',
        bloqueado: true, minutos: admin.lockMinutes(email)
      });
    }
    return admin.end(res, 401, { error: 'E-mail ou senha incorretos (' + f.n + '/3)' });
  }

  admin.clearFails(email);
  const token = admin.sign({ e: email, n: creds.nome }, admin.JWT_HOURS);
  try { console.log('[admin-login] ok: ' + email); } catch (e) {}
  admin.end(res, 200, {
    ok: true,
    token,
    nome: creds.nome,
    email,
    expira: Date.now() + admin.JWT_HOURS * 3600 * 1000
  });
};
