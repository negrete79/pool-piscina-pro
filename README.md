# PoolApp Universal — Piscina · Casa

PWA de manutenção de piscina (100% offline), versão limpa, com assinatura automática via **Pix do Mercado Pago**.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | O app inteiro (HTML + CSS + JS inline, instala como PWA) |
| `manifest.json` | Manifest PWA (start_url `/`, ícones `/icon-192.png` e `/icon-512.png`) |
| `sw.js` | Service Worker **v13** (`poolapp-v13`) — limpa caches antigos ao ativar |
| `icon-180.png` / `icon-192.png` / `icon-512.png` | Ícones do PWA (mesmo nome, sem espaços) |
| `api/criar-pix.js` | **POST /api/criar-pix** `{litros, device_id, nome, email}` → QR + copia e cola (R$ 29,90 fixo) |
| `api/check-status.js` | **GET /api/check-status** `?id=` (polling do pagamento) ou `?code=XXXX-XXXX-XXXX&nome=&email=` (ativação) |
| `api/webhook-mercadopago.js` | Webhook de notificações do Mercado Pago |
| `api/ativar-manual.js` | **Mantido intocado** no repositório de deploy (não alterado por esta versão) |

## Estrutura do app

Header (logo + Instalar app) · **6 abas** (Config · Válvula · Registro · Parâm. · Tratam. · Clima) trocadas por `display block/none` com **scroll suave ao topo** · **Aba Config**: Volume da água (campo único −/39900/+ de 56px, linha **C: Xm L: Ym P: Zm** alimentada pelos campos COMP/LARG/PROF + litragem rápida + botão "Aplicar volume acima"). Sem seção de hidro, sem cobrança por faixa de litros, sem medição duplicada, sem engrenagem.

## Licença — fluxo

1. **Teste de 15 dias**: salvo em `poolapp_install_date` na primeira abertura.
2. **Expirou sem licença**: abas Válvula, Registro, Parâmetros, Tratamento e Clima ficam bloqueadas; abre modal profissional de renovação. Os dados não são apagados.
3. **Assinar**: campos obrigatórios **Nome completo + E-mail** (validados com regex, erros vermelhos "Digite seu nome" / "E-mail inválido", botão só destrava com os dois OK) → botão "⚡ Assinar por R$ 29,90 - Pix (Mercado Pago)" → `POST /api/criar-pix` com nome e e-mail → QR + copia e cola → **polling a cada 4 s** em `GET /api/check-status?id=` → aprovado = salva `poolapp_license {expira: +30 dias, nome, email}` e recarrega liberado. Nome/e-mail também ficam em `poolapp_user`.
4. **Restaurar compra**: retoma a verificação de um pagamento pendente salvo no aparelho.
5. **Código de Ativação**: formato `XXXX-XXXX-XXXX`, validado em `GET /api/check-status?code=` (também exige nome/e-mail e salva junto).
6. **Suporte pós-Pix**: link "Paguei e não ativou?" na licença e no modal de renovação abre passo a passo de recuperação.

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
