// ============================================================
// PoolApp Universal · POST /api/webhook-mercadopago
// Recebe as notificações do Mercado Pago (webhook/IPN).
// O Mercado Pago exige resposta 200 rápida — nunca trave aqui.
// O app em si confirma o pagamento consultando /api/check-license,
// então este webhook serve para registrar/logar o status.
//
// Configuração no painel do Mercado Pago (Suas integrações → Webhooks):
//   URL: https://SEU-APP.vercel.app/api/webhook-mercadopago
//   Evento: Pagamentos
// ============================================================
module.exports = async (req, res) => {
  const ok = () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
  };
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method !== 'POST' && req.method !== 'GET') { res.writeHead(405); return res.end(); }

    let b = req.body || {};
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) {} }
    const pid = b && b.data && b.data.id;

    if (pid && (process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN)) {
      // Consulta o status real e registra no log da Vercel
      fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(pid), {
        headers: { 'Authorization': 'Bearer ' + (process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN) }
      })
        .then(r => r.json())
        .then(j => console.log('[webhook-mercadopago] pagamento', pid, 'status:', j && j.status, 'valor:', j && j.transaction_amount))
        .catch(e => console.log('[webhook-mercadopago] falha ao consultar', pid, String((e && e.message) || e)));
    }
  } catch (e) { /* nunca derrube o webhook */ }
  ok();
};
