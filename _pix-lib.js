// ============================================================
// api/_pix-lib.js — biblioteca compartilhada do Pix dinâmico
// (arquivo com "_" na frente: a Vercel NÃO cria endpoint para ele)
//
// Usado por: criar-pix.js, status-pix.js, webhook-mercadopago.js
// Sem dependências: só fetch nativo (Node 18+, padrão na Vercel).
// O Access Token do Mercado Pago fica SOMENTE em variável de ambiente
// no backend. Nunca no frontend.
// ============================================================

// ---------- Firebase Realtime Database (REST, sem SDK) ----------
const FB_URL = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
const FB_SECRET = process.env.FIREBASE_DB_SECRET || '';

function fbUrl(caminho) {
  if (!FB_URL) {
    throw new Error('FIREBASE_DATABASE_URL não configurada (Vercel > Settings > Environment Variables)');
  }
  let url = FB_URL + '/' + String(caminho || '').replace(/^\/+/, '');
  if (!url.endsWith('.json')) url += '.json';
  if (FB_SECRET) url += '?auth=' + encodeURIComponent(FB_SECRET);
  return url;
}

// Lê um caminho (ex.: fbGet('pix_pagamentos/123')). Retorna null se não existe.
export async function fbGet(caminho) {
  const r = await fetch(fbUrl(caminho));
  if (!r.ok) throw new Error('Firebase GET ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return await r.json();
}

// Grava vários caminhos de uma vez (atualização multi-local do RTDB)
export async function fbPatch(dados) {
  const r = await fetch(fbUrl(''), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (!r.ok) throw new Error('Firebase PATCH ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return await r.json();
}

// Chaves do Firebase não aceitam . # $ [ ] /
export function limparChave(s) {
  return String(s || '').replace(/[.#$\/\[\]]/g, '_');
}

// ---------- Mercado Pago ----------
// Consulta um pagamento na API oficial. Sempre re-consultar: nunca
// confiar no conteúdo que chega no corpo do webhook.
export async function mpGetPayment(id) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurada (Vercel > Settings > Environment Variables)');
  }
  const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(String(id)), {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!r.ok) return null;
  return await r.json();
}

// ============================================================
// Chamar quando o pagamento vem "approved":
//   1) marca o pedido como pago em pix_pagamentos/{id}
//   2) ativa o cliente: clientes/{cliente_id}/ativo = true
//   3) cria o comando de liberação que o app lê
// Tudo automático, sem confirmação manual.
// ============================================================
export async function ativarAcesso(pagamento) {
  const pid = String(pagamento.id);
  const clienteId = String(pagamento.external_reference || '').trim();
  const iso = new Date().toISOString();

  const dados = {
    ['pix_pagamentos/' + pid + '/status']: 'pago',
    ['pix_pagamentos/' + pid + '/pago_em']: iso,
    ['pix_pagamentos/' + pid + '/valor_pago']: pagamento.transaction_amount
  };

  if (!clienteId) {
    // pagamento sem external_reference: registra e não ativa ninguém
    await fbPatch(dados);
    return { cliente_id: null };
  }

  // proteção: o cliente do pedido criado no /criar-pix tem que bater
  const rec = await fbGet('pix_pagamentos/' + pid).catch(() => null);
  if (rec && rec.cliente_id && rec.cliente_id !== clienteId) {
    throw new Error('Pedido ' + pid + ': external_reference (' + clienteId + ') não confere com o registro (' + rec.cliente_id + ')');
  }

  const c = limparChave(clienteId);
  dados['clientes/' + c + '/ativo'] = true;
  dados['clientes/' + c + '/ativado_em'] = iso;
  dados['clientes/' + c + '/pagamento_id'] = pid;
  // >>> AJUSTE AQUI (se precisar): se o seu app libera por outro campo,
  // mude/adicione abaixo. Ex.:
  //   dados['clientes/' + c + '/plano_ativo'] = true;
  //   dados['clientes/' + c + '/licenca_ate'] = novaData;  (30 dias etc.)
  dados['comandos/' + c] = { tipo: 'ativar', pagamento_id: pid, ts: Date.now() };

  await fbPatch(dados);
  return { cliente_id: clienteId };
}
