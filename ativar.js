// ================= NEGRET'S v3.7 — api/ativar.js =================
// Cria o PIX DINÂMICO no Mercado Pago (QR do banco) para a ATIVAÇÃO do app — NÃO mexe no PIX de venda.
// Aceita { teste: true } para o QR de R$ 1,00 de teste — esse NUNCA ativa o app (webhook ignora).
// Também aceita GET ?dev=&pid= para o app consultar o status do pagamento (liberação na hora).
// Variáveis no Vercel: MP_TOKEN (token do Mercado Pago), SITE_URL (https://seusite.vercel.app),
// FIREBASE_URL (opcional — devolvido no cfg.fb para o app achar os comandos de liberação).

export default async function handler(req, res) {
  /* GET — consulta status do pagamento (o app pergunta a cada 5s enquanto o QR está aberto) */
  if (req.method === 'GET') {
    const { pid } = req.query || {};
    if (!pid) return res.status(400).json({ erro: 'sem pid' });
    try {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${pid}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_TOKEN}` }
      });
      const p = await r.json();
      if (!r.ok) return res.status(200).json({ status: 'erro' });
      return res.status(200).json({
        status: p.status, // pending | approved | rejected | cancelled
        exp: p.status === 'approved' ? Date.now() + 30 * 24 * 60 * 60 * 1000 : 0
      });
    } catch (e) {
      return res.status(200).json({ status: 'erro' });
    }
  }

  /* POST — cria o PIX (R$ 20 padrão; R$ 1 se teste) e devolve o QR para o app mostrar */
  if (req.method !== 'POST') return res.status(405).json({ erro: 'POST only' });
  const { dev, loja, email, valor, teste } = req.body || {};
  if (!dev) return res.status(400).json({ erro: 'sem dev' });

  const ehTeste = !!teste;
  const amount = ehTeste ? 1 : (Number(valor) > 0 ? Math.round(Number(valor) * 100) / 100 : 20);

  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MP_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${dev}-${Date.now()}`
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: ehTeste ? `NEGRET'S - TESTE PIX R$1 (nao ativa o app)` : `NEGRET'S - Ativação 30 dias - ${loja || dev}`,
      payment_method_id: 'pix',
      payer: { email: email || 'cliente@negrets.app' },
      // PIX de teste usa referência TESTE-... para o webhook NUNCA ativar o aparelho
      external_reference: ehTeste ? `TESTE-${dev}` : dev,
      notification_url: `${process.env.SITE_URL}/api/webhook`
    })
  });
  const data = await r.json();
  if (!r.ok) return res.status(400).json({ erro: data });
  return res.status(200).json({
    id: data.id,
    qr: data.point_of_interaction?.transaction_data?.qr_code,
    qr_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
    copia_cola: data.point_of_interaction?.transaction_data?.qr_code,
    valor: amount,
    teste: ehTeste,
    cfg: { fb: process.env.FIREBASE_URL || '' }
  });
}
