// ============================================================
// PoolApp Universal · api/_admin.js
// Módulo INTERNO compartilhado do painel administrativo.
// NÃO é um endpoint (prefixo "_" — a Vercel não cria rota).
//
// Oferece:
//  - JWT próprio (HMAC-SHA256, sessão de 2 h) — sem dependências
//  - "Banco" leve em JSON (/tmp) com semente das env ADMIN_*
//  - Bloqueio de 5 min após 3 tentativas de login erradas
//  - Tokens de recuperação de senha (30 min)
//  - Overrides de nome/e-mail dos pagamentos (corrige "--")
//  - Helper de resposta com CORS
// Credenciais iniciais (só usadas se o banco ainda não existe):
//  - admin@poolapp.com / pool2026 (ou env ADMIN_EMAIL / ADMIN_PASSWORD)
// ============================================================
const crypto = require('crypto');
const fs = require('fs');

const DB_PATH = '/tmp/poolapp-admin-db.json';
const JWT_HOURS = 2;
const MAX_FAILS = 3;
const LOCK_MINUTES = 5;
const SECRET = process.env.ADMIN_SECRET || ('poolapp-admin-v2-' + (process.env.MP_ACCESS_TOKEN || 'local'));

function seedAdmin(){
  return {
    nome: process.env.ADMIN_NAME || 'Elias',
    email: (process.env.ADMIN_EMAIL || 'admin@poolapp.com').toLowerCase(),
    senha: process.env.ADMIN_PASSWORD || 'pool2026'
  };
}

function readDB(){
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) { return null; }
}
function writeDB(d){
  try { fs.writeFileSync(DB_PATH, JSON.stringify(d)); } catch (e) {}
}
function getDB(){
  let d = readDB();
  if (!d || !d.admin) {
    d = { admin: seedAdmin(), fails: {}, reset: {}, overrides: {} };
    writeDB(d);
  }
  if (!d.fails) d.fails = {};
  if (!d.reset) d.reset = {};
  if (!d.overrides) d.overrides = {};
  return d;
}

/* ---------- JWT (HS256, sem dependências) ---------- */
function sign(payload, hours){
  const h = hours || JWT_HOURS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + h * 3600 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token){
  if (!token || typeof token !== 'string' || token.split('.').length !== 2) return null;
  const [body, sig] = token.split('.');
  const ok = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== ok) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch (e) { return null; }
}
/* extrai o token do header Authorization: Bearer xxx */
function bearer(req){
  const a = String(req.headers['authorization'] || '');
  return /^Bearer\s+/i.test(a) ? a.replace(/^Bearer\s+/i, '').trim() : '';
}

/* ---------- bloqueio por tentativas ---------- */
function isLocked(email){
  const f = getDB().fails[email] || {};
  return f.until && f.until > Date.now();
}
function lockMinutes(email){
  const f = getDB().fails[email] || {};
  return f.until ? Math.max(1, Math.ceil((f.until - Date.now()) / 60000)) : 0;
}
function registerFail(email){
  const d = getDB();
  const f = d.fails[email] || { n: 0, until: 0 };
  f.n++;
  if (f.n >= MAX_FAILS) { f.until = Date.now() + LOCK_MINUTES * 60000; f.n = 0; }
  d.fails[email] = f;
  writeDB(d);
  return f;
}
function clearFails(email){
  const d = getDB();
  delete d.fails[email];
  writeDB(d);
}

/* ---------- tokens de recuperação de senha ---------- */
function saveResetToken(email, minutes){
  const d = getDB();
  const token = crypto.randomBytes(24).toString('hex');
  d.reset[token] = { email, exp: Date.now() + (minutes || 30) * 60000 };
  writeDB(d);
  return token;
}
function takeResetToken(token){
  const d = getDB();
  const t = d.reset[token];
  if (!t || t.exp < Date.now()) return null;
  delete d.reset[token];
  writeDB(d);
  return t;
}

/* ---------- overrides de nome/e-mail dos pagamentos ---------- */
function setOverride(id, patch){
  const d = getDB();
  d.overrides[String(id)] = { ...(d.overrides[String(id)] || {}), ...patch, ts: Date.now() };
  writeDB(d);
  return d.overrides[String(id)];
}
function getOverrides(){ return getDB().overrides; }
function saveDB(d){ writeDB(d); }

/* ---------- resposta padrão com CORS ---------- */
function CORS(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    'Cache-Control': 'no-store'
  };
}
function end(res, code, obj){
  res.writeHead(code, { ...CORS(), 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function preflight(req, res){
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS()); res.end(); return true; }
  return false;
}

module.exports = {
  JWT_HOURS, MAX_FAILS, LOCK_MINUTES,
  getDB, saveDB, sign, verify, bearer,
  isLocked, lockMinutes, registerFail, clearFails,
  saveResetToken, takeResetToken,
  setOverride, getOverrides,
  end, preflight
};
