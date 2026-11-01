# PoolApp Universal — Piscina · Casa

PWA de manutenção de piscina (100% offline), versão limpa, com assinatura automática via **Pix do Mercado Pago**.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | O app inteiro (HTML + CSS + JS inline, instala como PWA) |
| `manifest.json` | Manifest PWA (start_url `/`, ícones `/icon-192.png` e `/icon-512.png`) |
| `sw.js` | Service Worker **v11** (`poolapp-v11`) — limpa caches antigos ao ativar |
| `icon-180.png` / `icon-192.png` / `icon-512.png` | Ícones do PWA (mesmo nome, sem espaços) |
| `api/criar-pix.js` | **POST /api/criar-pix** `{litros, device_id}` → QR + copia e cola (R$ 29,90 fixo) |
| `api/check-status.js` | **GET /api/check-status** `?id=` (polling do pagamento) ou `?code=XXXX-XXXX-XXXX` (ativação) |
| `api/webhook-mercadopago.js` | Webhook de notificações do Mercado Pago |

## Estrutura do app

Header (logo + Instalar app) · **6 abas** (Config · Válvula · Registro · Parâm. · Tratam. · Clima) trocadas por `display block/none` · **Aba Config**: Volume da água (campo único −/45000/+ de 56px + litragem rápida de 3 campos + botão "Aplicar volume acima"). Sem seção de hidro, sem cobrança por faixa de litros, sem medição duplicada, sem engrenagem.

## Licença — fluxo

1. **Teste de 15 dias**: salvo em `poolapp_install_date` na primeira abertura.
2. **Expirou sem licença**: abas Válvula, Registro, Parâmetros, Tratamento e Clima ficam bloqueadas; abre modal profissional de renovação. Os dados não são apagados.
3. **Assinar**: botão "⚡ Assinar por R$ 29,90 - Pix (Mercado Pago)" → `POST /api/criar-pix` → QR + copia e cola → **polling a cada 4 s** em `GET /api/check-status?id=` → aprovado = salva `poolapp_license {expira: +30 dias}` e recarrega liberado.
4. **Restaurar compra**: retoma a verificação de um pagamento pendente salvo no aparelho.
5. **Código de Ativação**: formato `XXXX-XXXX-XXXX`, validado em `GET /api/check-status?code=`.

## Configuração na Vercel

1. Importe o repositório (a pasta `api/` vira serverless functions sozinha).
2. Environment Variables:
   - `MP_ACCESS_TOKEN` — token de produção do Mercado Pago (já configurado).
   - `POOL_CODES` (opcional) — códigos de ativação separados por vírgula, ex.: `A1B2-C3D4-E5F6`. Sem essa variável, aceita qualquer código no formato `XXXX-XXXX-XXXX`.
   - `PAYER_EMAIL` (opcional) — e-mail padrão do pagador.
3. Painel do Mercado Pago (**Suas integrações → Webhooks**):
   - URL: `https://SEU-PROJETO.vercel.app/api/webhook-mercadopago`
   - Evento: **Pagamentos**
4. Publique. O app funciona offline; pagamento e licença precisam de internet.

## PWA

- Android/Chrome: botão **Instalar app** no topo.
- iPhone/Safari: Compartilhar → **Adicionar à Tela de Início**.
