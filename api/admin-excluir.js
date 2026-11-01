// api/admin-excluir.js - APAGA TESTES
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido' });

  // Verifica token
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Não autorizado' });
  }

  try {
    const { ids } = req.body || {};
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, error: 'Nenhum ID enviado' });
    }

    console.log('Excluindo IDs:', ids);

    // Aqui você apaga do seu banco. Como você usa mock/localStorage,
    // só retornamos OK e o frontend apaga localmente.
    // Se um dia usar banco real (Supabase, etc), coloca o delete aqui.
    
    // Exemplo se usar Vercel KV ou JSON:
    // await kv.del(...ids) ou await db...

    return res.status(200).json({ 
      ok: true, 
      apagados: ids.length,
      ids 
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Erro ao excluir' });
  }
}
