// ============================================================
// PoolApp Universal · POST /api/recuperar-senha
// "Esqueceu a senha?" do painel administrativo.
// Recebe: { email }
//  - Gera um token válido por 30 minutos e envia o link por
//    e-mail (Resend) se a env RESEND_API_KEY existir.
//  - Sem provedor de e-mail configurado, devolve o link direto
//    APENAS quando o e-mail é o do administrador (o link nunca
//    é exposto para e-mails desconhecidos).
// Resposta: { ok, msg, link? }
// ============================================================
const admin = require('./_admin.js');

function baseUrl(req){
  const host = String(req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost');
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  return proto + '://' + host;
}

module.exports = async (req, res) => {
  if (admin.preflight(req, res)) return;
  if (req.method !== 'POST') return admin.end(res, 405, { error: 'Use POST com { email }' });

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return admin.end(res, 400, { error: 'E-mail inválido' });

  const msgOk = 'Enviamos um link de recuperação para o seu e-mail. Ele vale por 30 minutos.';
  const creds = admin.getDB().admin;
  if (email !== creds.email) {
    /* resposta genérica: não revela se o e-mail existe */
    return admin.end(res, 200, { ok: true, msg: msgOk });
  }

  const token = admin.saveResetToken(email, 30);
  const link = baseUrl(req) + '/admin/reset.html?token=' + token;

  const KEY = process.env.RESEND_API_KEY || '';
  if (KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'PoolApp <onboarding@resend.dev>',
          to: [email],
          subject: 'PoolApp — Link de recuperação da senha',
          html: '<p>Olá, ' + creds.nome + '!</p><p>Use o botão abaixo para definir uma nova senha do painel PoolApp (válido por 30 minutos):</p>'
              + '<p><a href="' + link + '" style="background:#0F5C5C;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">Redefinir senha</a></p>'
              + '<p>Se não foi você, ignore este e-mail.</p>'
        })
      });
      if (r.ok) return admin.end(res, 200, { ok: true, msg: msgOk });
      console.log('[recuperar-senha] Resend recusou: ' + r.status);
    } catch (e) { console.log('[recuperar-senha] falha Resend: ' + e.message); }
  }

  /* Sem provedor de e-mail: devolve o link direto (só o admin conhece este e-mail) */
  admin.end(res, 200, {
    ok: true,
    msg: 'Envio automático de e-mail não configurado (defina RESEND_API_KEY na Vercel). Use o link direto abaixo — vale por 30 minutos.',
    link
  });
};
