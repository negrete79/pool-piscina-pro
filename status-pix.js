// ============================================================
// api/status-pix.js
// Endpoint: GET /api/status-pix?id=123456789
//
// O frontend chama isto a cada 5 segundos até virar "pago".
// Se o webhook do Mercado Pago ainda não chegou, pergunta direto
// na API do Mercado Pago (auto-cura) e ativa o cliente na hora.
// ============================================================

import { fbGet, fbPatch, mpGetPayment, ativarAcesso } from './_pix-lib.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, erro: 'Use GET com ?id=' });

  try {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, erro: 'Parâmetro ?id= é obrigatório' });

    // 1) olha o registro local no Firebase
    let rec = null;
    try { rec = await fbGet('pix_pagamentos/' + id); } catch (e) { rec = null; }

    if (rec && rec.status === 'pago') {
      return res.status(200).json({ ok: true, status: 'pago', cliente_id: rec.cliente_id || null });
    }

    // 2) ainda pendente: confere direto no Mercado Pago
    const p = await mpGetPayment(id);
    if (!p) {
      return res.status(200).json({ ok: true, status: (rec && rec.status) || 'desconhecido' });
    }

    if (p.status === 'approved') {
      // pago e o webhook ainda não processou: ativa agora mesmo
      const r = await ativarAcesso(p);
      return res.status(200).json({ ok: true, status: 'pago', cliente_id: r.cliente_id });
    }

    // 3) atualiza o status local (pending / rejected / cancelled ...)
    const st = (p.status === 'pending' || p.status === 'in_process')
      ? 'pendente'
      : (p.status === 'rejected' ? 'recusado' : (p.status === 'cancelled' ? 'cancelado' : p.status));
    try {
      await fbPatch({ ['pix_pagamentos/' + id + '/status']: st });
    } catch (e) { /* registro local falhou: não travar a consulta */ }

    return res.status(200).json({ ok: true, status: st });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
}
