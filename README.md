# PoolApp Universal — Piscina · Casa (v2 PRO FINAL CORRIGIDA)

PWA de manutenção de piscina (100% offline), reconstruído do zero com design profissional, **modo escuro**, hidromassagem opcional e assinatura automática via **Pix do Mercado Pago**.

> **v2.1 — correções dos prints (mobile 360 px):** navegação por âncora com scroll suave + IntersectionObserver (marca a aba ativa com offset do header) · inputs C×L×P nunca mais estouram (texto escuro, largura fixa) · grade de parâmetros sem corte lateral (`minmax(0,1fr)` + `overflow-x:clip`) · menu inferior fixo o tempo todo (`z-index:999` + `safe-area`) · ícone 🌙/☀️ no Clima e chip dia/noite nos Parâmetros · **erro de pagamento resolvido**: o domínio antigo `calculadora-piscina-1.vercel.app` responde 307 SEM CORS — o app agora tenta o próprio domínio e cai automaticamente para o canônico `pool-piscina-pro.vercel.app` (token MP confirmado funcionando), com mensagem de erro clara por causa + botão “Tentar de novo” · modais acima da tabbar.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | O app inteiro (Inter, paleta #0F5C5C/#0A3D3D, cards 20px, dark mode, PWA) |
| `admin.html` | **Painel Admin** — tela de login profissional + gestão de pagamentos (sem prompt/alert nativos) |
| `admin/forgot.html` | "Esqueceu a senha?" — envia link de recuperação |
| `admin/reset.html` | Redefinir senha a partir do link (`?token=XXX`) |
| `manifest.json` | Manifest PWA (theme #0F5C5C, ícones 192/512) |
| `sw.js` | Service Worker **v16** (`poolapp-v16`, navegação network-first, `/api/` nunca cacheado) |
| `icon-180/192/512.png` | Ícones do PWA |

## APIs (pasta `api/` — vira serverless na Vercel)

| Endpoint | Função |
| --- | --- |
| `criar-pix.js` | **POST** `{litros, device_id, nome, email}` → QR + copia e cola **R$ 29,90 fixo** |
| `check-status.js` | **GET** `?id=` (polling) ou `?code=XXXX-XXXX-XXXX` (valida código) |
| `webhook-mercadopago.js` | Notificações do MP |
| `ativar-manual.js` | **POST** `{email}` → código `XXXX-XXXX-XXXX` (30 dias). Aceita JWT **ou** `x-admin-key` |
| `listar-pagamentos.js` | **GET** → pagamentos dos últimos 90 dias (+ overrides de nome/e-mail) |
| `deletar-pagamento.js` | **POST** `{id}` → cancela no MP + marca desistente |
| `editar-pagamento.js` | **POST** `{id, nome, email}` → corrige os "--" |
| `admin-login.js` | **POST** `{email, senha}` → JWT 2 h · 3 erros = bloqueio 5 min |
| `admin-config.js` | **POST** → salva nome/e-mail/senha do admin |
| `recuperar-senha.js` | **POST** `{email}` → token 30 min (e-mail via Resend se `RESEND_API_KEY`; sem ela, devolve o link direto) |
| `admin-reset.js` | **POST** `{token, nova_senha}` → nova senha |
| `_admin.js` | Módulo interno compartilhado (JWT HS256, banco leve em /tmp, CORS) — não é rota |

**Credenciais iniciais:** `admin@poolapp.com` / `pool2026` (ou env `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME`). Troque em ⚙️ Configurações do painel.

## App — recursos

- **Topo glassmorphism** com gota pulsante, botão 🌙/☀️ (salva `theme=dark/light`) e chip de licença em 3 estados: 🟡 Teste ativo · ✅ Licença ativa (X dias, até DD/MM) · ❌ Vencida.
- **Config**: contador 39900 com −/+, unidades **L / m³ / galões**, C×L×P **com sliders** + Aplicar volume, **"Minha hidro tem?"** (switch que soma o volume da hidro: `Volume Total: Piscina + Hidro = X L`), botão Salvar configurações.
- **Válvula**: manopla 6 posições com arrasto 360° magnético — a info fica **dentro da mesma caixa** (sem descer a página). **Manual com SVG animado por posição** (Filtrar, Retrolavar, Enxaguar, Recircular, Drenar, Fechado) mostrando bomba, filtro e esgoto.
- **Registros**: 4 bolões redondos realistas (cinza fechado / verde aberto com risco indicador) + fluxo animado. **SEGURANÇA 1**: DRENO + SKIMMER/ASPIRAÇÃO = `vibrate([200,100,200])` + borda piscando + toast. **SEGURANÇA 2**: HIDRO + outro registro = vibra + toast. Aviso laranja "Desligue a bomba antes de girar".
- **Parâmetros**: pH/Cloro com slider, Metais (Fe/Cu), Dureza Cálcica e Cianúrico com **"Não sei"** → alerta vermelho "Omissão de parâmetro - cálculo pode não ser preciso" + tooltips (i).
- **Tratamento**: 3 etapas (pH/AT → cloro → sulfato) com doses pelo volume total e diagnóstico pós-sulfato.
- **Clima**: Open-Meteo + GPS opcional, horas de filtragem sugeridas.
- **Licença/Pix**: gate Nome + E-mail (regex), QR + copia e cola, polling 4 s, código XXXX-XXXX-XXXX. Após pagar: chip vira ✅ e o modal mostra "Ativo até DD/MM · e-mail".
- **Suporte**: "Paguei e não ativou? Clique aqui / Ajuda" → 4 passos + formulário (Nome, E-mail, ID Pix/comprovante, Data/Hora) + WhatsApp `wa.me` (constante `SUPORTE_WA` — **troque `55SEUNUMERO`**). Sem CPF (LGPD).

## Painel Admin (/admin.html)

- Login com e-mail/senha (👁️ ver/esconder, "Lembrar de mim", loading, JWT 2 h, bloqueio 5 min após 3 erros), `noindex`.
- Cards: Total faturado 30 dias · Total ativações · Pendentes · Expirados.
- Tabela com checkbox, badges (verde pago / amarelo pendente / vermelho cancelado / azul teste), paginação 20, busca instantânea (e-mail/nome/ID), filtros Todos / Só pendentes / Desistentes.
- Ações: **Ativar 30 dias** (gera código), **Reenviar código** (WhatsApp com mensagem pronta), **Copiar código**, **Editar nome/e-mail** (corrige "--"), **🗑️ Excluir** (modal de confirmação, cancela no MP), **Excluir selecionados**.
- Exportar CSV, log de atividades ("Ativado por admin em 01/11/26 14:07"), ⚙️ Configurações (nome, e-mail, troca de senha com olho).

## Configuração na Vercel

1. Importe o repositório (pasta `api/` vira functions).
2. Environment Variables: `MP_ACCESS_TOKEN` (produção), opcionais `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_SECRET`, `ADMIN_KEY` (legado), `RESEND_API_KEY` + `RESEND_FROM` (envio real de e-mail), `POOL_CODES`, `PAYER_EMAIL`.
3. Webhook MP: `https://SEU-PROJETO.vercel.app/api/webhook-mercadopago` (evento Pagamentos).
4. Painel: `/admin.html` · Recuperação: `/admin/forgot.html`.

## PWA

- Android/Chrome: **Instalar app** no topo (beforeinstallprompt).
- iPhone/Safari: Compartilhar → Adicionar à Tela de Início.
- Offline total (cache v16); só clima e pagamento usam internet.

## Domínio / deploy

- **Domínio canônico atual:** `https://pool-piscina-pro.vercel.app` (o antigo `calculadora-piscina-1.vercel.app` só redireciona 307 e **não serve para fetch da API** — o app já contorna sozinho, mas use o canônico para divulgar).
- Ao renomear o projeto na Vercel, atualize também o fallback `API_BASES` no `index.html` e o webhook no painel do MP.
- Depois de cada deploy, o SW v16 busca o HTML novo na rede (network-first) — não precisa mais limpar cache do celular.
