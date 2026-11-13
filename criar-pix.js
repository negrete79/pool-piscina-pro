// ============================================================
// api/criar-pix.js
// Endpoint: POST /api/criar-pix
//   body JSON: { "valor": 19.90, "cliente_id": "11912345678" }
//
// 1) Chama a API do Mercado Pago: POST /v1/payments
//    com payment_method_id: "pix" e transaction_amount.
// 2) Devolve para o frontend o que veio da API:
//    id, status, qr_code (copia e cola) e qr_code_base64 (imagem PNG).
//
// O Access Token fica SÓ AQUI (variável de ambiente da Vercel).
// ============================================================

import { fbPatch } from './_pix-lib.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'Use POST' });

  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ ok: false, erro: 'Servidor sem MERCADOPAGO_ACCESS_TOKEN configurada' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const clienteId = String(body.cliente_id || '').trim();
    const valor = Math.round(Number(body.valor) * 100) / 100;

    if (!clienteId) return res.status(400).json({ ok: false, erro: 'cliente_id é obrigatório' });
    if (!valor || valor < 0.5) return res.status(400).json({ ok: false, erro: 'valor inválido (mínimo R$ 0,50)' });

    // o Mercado Pago exige um e-mail no pagador
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteId)
      ? clienteId
      : (body.payer_email || ('cliente.' + clienteId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '@pix.negrets.app'));

    // ---------- cria a cobrança Pix no Mercado Pago ----------
    const resp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'negrets_' + Date.now() + '_' + Math.random().toString(36).slice(2)
      },
      body: JSON.stringify({
        transaction_amount: valor,
        description: body.descricao || "Assinatura NEGRET'S",
        payment_method_id: 'pix',
        external_reference: clienteId,   // <- o webhook usa isso para saber QUEM pagou
        payer: { email: email }
      })
    });

    const p = await resp.json();
    if (!resp.ok) {
      return res.status(502).json({ ok: false, erro: 'Mercado Pago recusou a cobrança', detalhe: p });
    }

    // ---------- registra o pedido no Firebase ----------
    // (o webhook e o status-pix usam esse registro para liberar o cliente certo)
    try {
      await fbPatch({
        ['pix_pagamentos/' + p.id]: {
          cliente_id: clienteId,
          valor: valor,
          status: p.status,
          criado_em: new Date().toISOString()
        }
      });
    } catch (e) {
      // não perde o QR por falha no Firebase; o status-pix consulta o Mercado Pago direto
      console.error('criar-pix: registro no Firebase falhou:', e.message);
    }

    // ---------- devolve ao frontend só o que ele precisa ----------
    const td = (p.point_of_interaction && p.point_of_interaction.transaction_data) || {};
    return res.status(200).json({
      ok: true,
      id: String(p.id),
      status: p.status,
      qr_code: td.qr_code || null,            // texto copia e cola
      qr_code_base64: td.qr_code_base64 || null // imagem PNG em base64 (mostrar direto no <img>)
    });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: 'Falha ao criar Pix: ' + e.message });
  }
}
