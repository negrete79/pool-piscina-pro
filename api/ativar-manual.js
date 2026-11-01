// ============================================================
// PoolApp Universal · POST /api/ativar-manual
// Usado SOMENTE pelo painel do administrador (/admin.html).
// Recebe { email } e gera um código de ativação manual no
// formato XXXX-XXXX-XXXX que libera 30 dias de licença.
// O cliente usa o código no app em "Já tenho código"
// (a validação continua sendo feita por /api/check-status).
// Resposta: { ok, email, code, expira, dias, msg }
//
// Proteção: header "x-admin-key" — valor da env ADMIN_KEY na
// Vercel ou, se não configurada, o padrão "SEJA".
// OBS: se a env POOL_CODES estiver configurada na Vercel,
//      o código gerado precisa ser adicionado à lista.
// ============================================================
const ADMIN_KEY = process.env.ADMIN_KEY || 'SEJA';
const LIC_DAYS = 30;

function gerarCodigo(){
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1 (fáceis de confundir)
  const g = n => { let s = ''; for (let i = 0; i < n; i++) s += ABC[Math.floor(Math.random() * ABC.length)]; return s; };
  return g(4) + '-' + g(4) + '-' + g(4);
}

module.exports = async (req, res) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  const key = String(req.headers['x-admin-key'] || '');
  if (!key || key !== ADMIN_KEY) {
    res.writeHead(401, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ error: 'Senha admin incorreta' }));
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Use POST com { email }' }));
  }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'E-mail inválido' }));
  }

  const code = gerarCodigo();
  const expira = Date.now() + LIC_DAYS * 86400 * 1000;
  try { console.log('[ativar-manual] código gerado para ' + email + ': ' + code); } catch (e) {}

  res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({
    ok: true,
    email,
    code,
    expira,
    dias: LIC_DAYS,
    msg: 'Código gerado. Use "Reenviar código" para mandar por WhatsApp — o cliente digita em "Já tenho código".'
  }));
};
