// ============================================================
// PoolApp Universal · /api/admin-config
// Configurações do administrador (modal do painel).
// GET  (público): devolve SÓ o WhatsApp de suporte — { ok, whatsapp }
//       (dado público por natureza: o app usa para montar o link wa.me)
// POST (com token): Recebe: { token, nome?, email?, senha_atual?, nova_senha?, whatsapp? }
//  - nome / email: atualiza a identificação exibida no painel
//  - nova_senha: exige senha_atual correta (mínimo 6 caracteres)
//  - whatsapp: número do suporte (55 + DDD + número, só dígitos) — usado pelo botão
//       "Enviar pro WhatsApp" do app; fallback via env WHATSAPP_NUMERO na Vercel
// Devolve: { ok, nome, email, whatsapp, msg }
// Grava no "banco" leve (/tmp) — na Vercel a env ADMIN_NAME,
// ADMIN_EMAIL e ADMIN_PASSWORD continua sendo a semente do
// primeiro acesso de cada instância.
// ============================================================
const admin = require('./_admin.js');

module.exports = async (req, res) => {
  if (admin.preflight(req, res)) return;

  /* GET público — apenas o WhatsApp de suporte (nunca nome/e-mail/senha) */
  if (req.method === 'GET') {
    const db = admin.getDB();
    const wa = String((db.admin && db.admin.whatsapp) || '').replace(/\D/g, '')
          || String(process.env.WHATSAPP_NUMERO || '').replace(/\D/g, '')
          || '5531999999999';
    return admin.end(res, 200, { ok: true, whatsapp: wa });
  }

  if (req.method !== 'POST') return admin.end(res, 405, { error: 'Use POST' });

  const jwt = admin.verify(admin.bearer(req) || String((req.body && req.body.token) || ''));
  if (!jwt) return admin.end(res, 401, { error: 'Sessão expirada — entre novamente' });

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}

  const d = admin.getDB();
  const a = d.admin;
  const out = {};

  const nome = String(body.nome || '').trim();
  if (nome) { a.nome = nome.slice(0, 60); out.nome = true; }

  const email = String(body.email || '').trim().toLowerCase();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return admin.end(res, 400, { error: 'E-mail inválido' });
    a.email = email; out.email = true;
  }

  const wa = String(body.whatsapp || '').replace(/\D/g, '');
  if (wa) {
    if (wa.length < 10 || wa.length > 15) {
      return admin.end(res, 400, { error: 'Número de WhatsApp inválido — use 55 + DDD + número' });
    }
    a.whatsapp = wa; out.whatsapp = true;
  }

  const nova = String(body.nova_senha || '');
  if (nova) {
    const atual = String(body.senha_atual || '');
    if (atual !== a.senha) return admin.end(res, 400, { error: 'Senha atual incorreta' });
    if (nova.length < 6) return admin.end(res, 400, { error: 'A nova senha precisa de no mínimo 6 caracteres' });
    a.senha = nova; out.senha = true;
  }

  admin.saveDB(d);

  try { console.log('[admin-config] atualizado: ' + Object.keys(out).join(',')); } catch (e) {}
  admin.end(res, 200, { ok: true, nome: a.nome, email: a.email, whatsapp: a.whatsapp || '', alterado: out, msg: 'Configurações salvas' });
};
