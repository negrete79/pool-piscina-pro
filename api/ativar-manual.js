// ============================================================
// PoolApp Universal · POST /api/ativar-manual
// Usado SOMENTE pelo painel do administrador (/admin.html).
// Recebe { email, dias? } e gera um código de ativação manual no
// formato XXXX-XXXX-XXXX.
//   dias = 30 (padrão) · 60 · 180 (6 meses) · 365 (1 ano) · 0 (vitalício)
//   — 30 dias: formato aleatório antigo (compatibilidade total);
//   — outras durações: código com o plano embutido (ver api/_admin.js),
//     que o /api/check-status reconhece e devolve o expira certo.
// O cliente usa o código no app em "Já tenho código"
// (a validação continua sendo feita por /api/check-status).
// Resposta: { ok, email, code, expira, dias, plano, msg }
//
// Proteção: header "x-admin-key" — valor da env ADMIN_KEY na
// Vercel ou, se não configurada, o padrão "SEJA".
// OBS: se a env POOL_CODES estiver configurada na Vercel,
//      o código gerado precisa ser adicionado à lista (aceita
//      também "CODIGO:dias", ex.: "ABCD-EFGH-JKLM:365").
// ============================================================
const ADMIN_KEY = process.env.ADMIN_KEY || 'SEJA';
const admin = require('./_admin.js');   /* aceita também Authorization: Bearer <JWT do painel> */
const LIC_DAYS = 30;
const DIAS_VALIDOS = [30, 60, 180, 365, 0];   /* 0 = vitalício */

function gerarCodigo(){
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1 (fáceis de confundir)
  const g = n => { let s = ''; for (let i = 0; i < n; i++) s += ABC[Math.floor(Math.random() * ABC.length)]; return s; };
  return g(4) + '-' + g(4) + '-' + g(4);
}

module.exports = async (req, res) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  const jwt = admin.verify(admin.bearer(req));          /* sessão nova do painel */
  const key = String(req.headers['x-admin-key'] || '');  /* chave legada (compatibilidade) */
  if (!jwt && (!key || key !== ADMIN_KEY)) {
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

  /* duração escolhida no painel (só ativação por código — o Pix segue com 30 dias fixos) */
  const pediu = Number(body.dias);
  const dias = DIAS_VALIDOS.indexOf(pediu) !== -1 ? pediu : LIC_DAYS;
  const rotulo = dias === 0 ? 'vitalícia (não expira)'
    : dias === 180 ? '6 meses'
    : dias === 365 ? '1 ano'
    : dias + ' dias';
  const code = (dias === LIC_DAYS ? gerarCodigo() : admin.gerarCodigoPlano(dias)) || gerarCodigo();
  const expira = dias === 0 ? null : Date.now() + dias * 86400 * 1000;
  try { console.log('[ativar-manual] código ' + rotulo + ' gerado para ' + email + ': ' + code); } catch (e) {}

  res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({
    ok: true,
    email,
    code,
    expira,
    dias,
    plano: rotulo,
    msg: 'Código gerado — licença ' + rotulo + '. Use "Reenviar código" para mandar por WhatsApp — o cliente digita em "Já tenho código".'
  }));
};
