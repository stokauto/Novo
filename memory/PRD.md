# StockAuto — PRD

## Problema
Marketplace de veículos B2C com foco em Campo Grande/MS. Compradores chegam por SEO local e contatam revendedores direto via WhatsApp. Revendedores pagam plano (Avulso/Loja) para anunciar.

## Stack
- Backend: FastAPI + MongoDB (motor) + JWT (cookies httpOnly) + Emergent Object Storage + Pillow
- Frontend: React 19 + CRACO + Tailwind + Radix UI + Lucide + react-helmet-async
- Repositório: https://github.com/e4000548-ux/Autorepasse.git
- Produção: https://stockauto.com.br

## Personas
- **Visitante** — busca veículo, encontra anúncios via SEO local, fala no WhatsApp
- **Revendedor** — cadastra loja, paga via PIX, gerencia anúncios em /painel
- **Admin** — modera anúncios/lojistas, configura PIX/planos, gerencia banners

## Implementado

### 23/Fev/2026 — Seção Serviços + Landing de vendas (3 etapas)
- **ETAPA 1 — Seção Serviços** (isolada do classificados de veículos)
  - Backend: constante `SERVICE_CATEGORIES` (16 códigos: mecanica, funilaria, eletrica, ar-condicionado, vidracaria, estetica, pneus, escapamento, guincho, seguros, financiamento, despachante, rastreamento, som-acessorios, locadora, vistoria); coleção `db.services` independente de `vehicles`
  - Endpoints públicos: `GET /api/service-categories`, `GET /api/services` (com filtros category/q/city/uf/limit até 200), `GET /api/services/:slug_or_id`
  - Endpoints ADM: `GET/POST/PUT/DELETE /api/admin/services` (multipart, com logo/cover via `upload_image_to_storage`); slug único auto-gerado por `unique_slug(db.services, ...)` (duplicidade → `-2`, `-3`)
  - Frontend: nova rota `/servicos` (`Services.jsx`) com hero preto teal, busca, chips de 16 categorias; menu "SERVIÇOS" em `Layout.jsx` com destaque teal `#0E7C86` (desktop + mobile drawer) e ícone Wrench
  - Admin: nova tab "Serviços" em `AdminPanel.jsx` (`ServicesTab` + `ServiceFormModal`) com CRUD completo — criar/editar/ativar/desativar/excluir, upload de logo (400×400) e capa (1600×600)
- **ETAPA 2 — Mini-página `/servicos/:slug`** (SEO-ready client-side)
  - `ServiceProfile.jsx` reaproveitando padrão do `DealerProfile.jsx`: cover, logo, categoria badge, título, cidade/UF, telefone, CTA WhatsApp verde, botão "Copiar link", cards laterais (Localização + Contato)
  - SEO via Helmet: `title` dinâmico, `meta description`, canonical, `og:*`; JSON-LD `LocalBusiness` (@id, name, address, areaServed, knowsAbout, sameAs=WhatsApp) + `BreadcrumbList` (Início → Serviços → Categoria → Empresa)
  - Sitemap.xml agora inclui `/servicos`, `/servicos?category=<code>` (todas 16), e `/servicos/<slug>` (até 3000)
  - **Limitação SSR documentada**: ingress do preview roteia tudo não-`/api` diretamente ao SPA. Solução server-side bot-detector não é viável sem mudança de infra. Client-side (Helmet + JSON-LD) atende Google/Bing (renderizam JS). Preview de link em WhatsApp/Facebook usa fallback default do `index.html` — enhancement futuro: prerender estático via react-snap ou migração para Next.js
- **ETAPA 3 — Landing de vendas `/comece-agora`** (com alias `/planos-agora` → 302)
  - `LandingPlans.jsx` standalone (home intocada): hero preto com gradiente vermelho/dourado, strip factual (MS/PIX/24-7/0%), 6 benefícios, seção "planos" com 2 cards (Avulso + Loja) puxados de `/api/settings/public`, FAQ 4 itens `<details>`, CTA final. Todos os CTAs apontam para `/cadastro`
  - JSON-LD `Product` com `offers` de cada plano
- **Correções críticas pós-testing (iteration_4.json)**
  - `public/index.html`: removidos `meta description`, todo bloco `og:*` estático, `twitter:title/description/image` e JSON-LD `AutoDealer` (que era global e semanticamente errado em páginas de serviços). Mantido apenas: `title` fallback, keywords, robots, geo, `twitter:card`, JSON-LD `Organization` + `WebSite`. Resultado verificado: 1 meta description, 1 og:title, 1 og:description por página
  - Landing: substituídos stats hardcoded ("500+ anúncios") por dados factuais; CTA "grátis para testar" → "Cadastrar minha loja agora"
  - `ServiceFormModal`: removidos `required` HTML5 (tooltip em inglês) — validação PT-BR já existente via `setError`
  - Backend: `limit` do `GET /api/services` capado em 200
- **Testing**: `iteration_4.json` — pytest 74/0 (backend), 100% frontend flows OK

### 12/Jan/2026 — Hub de Repasse B2B + Melhorias críticas
- **Bugs corrigidos:**
  - **Mensagem de erro em PT-BR**: handler global `RequestValidationError` traduz mensagens Pydantic comuns ("Input should be a valid integer..." → "Quilometragem: Este campo aceita apenas números inteiros (sem casas decimais).")
  - **Plano Loja com limite 1**: migration no startup + cascade no `PUT /admin/settings` sincronizam `plan_ad_limit` + `plan_offer_limit` de todos os dealers conforme settings dos planos
  - **Watermark path**: agora usa `Path(__file__).parent.resolve()` para path absoluto à prova de symlinks
- **Sistema de Ofertas em Destaque (P0):**
  - Backend: campo `offer_price: Optional[float]` no `VehicleIn`; `offer_limit` em `DEFAULT_PLANS` (avulso=0, loja=5); enforcement no `dealer_create_vehicle` (HTTP 400 se ultrapassar limite); migration garante campos em settings legadas
  - Frontend: campo "Valor da Oferta" no `VehicleForm` (só visível quando offer_limit > 0 e ad_type=public), com aviso do limite; `VehicleCard` mostra preço original riscado + valor da oferta destaque vermelho + selo "OFERTA -X%"
  - Admin: campo `offer_limit` editável por plano em `AdminPanel → Configurações`
- **Pagamento via WhatsApp:**
  - Removido todo fluxo PIX/QR do `Register.jsx` e `PendingApproval.jsx`
  - Tela `PendingApproval` reescrita: CTA grande "Falar com a equipe no WhatsApp" + mensagem pré-preenchida com loja, e-mail, plano, cidade
  - Após `auth/register`, frontend faz `window.location.href = https://wa.me/5567982132978?text=...` com dados do cadastro
- **Repasse B2B auto-publicado:** `POST /api/dealer/vehicles` com `ad_type=repasse` → `status="active"` direto (sem moderação). Públicos continuam `pending`.
- **Hub de Repasse implementado:** rotas `/repasse` e `/repasse/:slug` protegidas (dealer/admin), card amarelo com FIPE/Oferta/Margem, selo "MELHOR MARGEM" vermelho quando >20%, feed "Últimas 24h"
- **Novo modelo de dados** em `vehicles`:
  - `ad_type`: `"public"` (default) | `"repasse"` — separa anúncios públicos dos B2B
  - `fipe_price`: opcional, valor FIPE de referência (obrigatório quando ad_type=repasse)
  - `price` é reutilizado como valor de oferta/repasse quando ad_type=repasse
- **Endpoints novos**:
  - `GET /api/repasse/vehicles` — listagem com auth obrigatória (dealer/admin)
  - `GET /api/repasse/vehicles/{slug}` — detalhe com auth obrigatória
  - `GET /api/admin/vehicles?ad_type=repasse` — admin filtra por tipo
  - Stats `admin/stats` agora expõe `repasse_active` e `repasse_pending`
- **Isolamento público**:
  - `GET /api/vehicles` (lista pública) **exclui** ad_type=repasse
  - `GET /api/vehicles/{slug}` retorna 404 se repasse
  - Sitemap.xml também exclui repasse (não indexa)
- **Validações backend**: ad_type=repasse exige `fipe_price > 0` e `price > 0` (HTTP 400 se faltar)
- **Frontend**:
  - Nova rota `/repasse` (lista) + `/repasse/:slug` (detalhe), ambas com `ProtectedRoute roles=["dealer","admin"]`
  - `ProtectedRoute` agora aceita `roles` (array) além do `role` legado
  - Novo componente `RepasseCard.jsx`: borda dourada (#F5A623), selo "REPASSE B2B", FIPE riscado vs Oferta destacada, margem calculada (R$ + %)
  - Página `Repasse.jsx`: hero preto+dourado com tag "ÁREA RESTRITA", filtros, listagem
  - Página `RepasseDetail.jsx`: galeria, box dourado FIPE/Oferta/Margem, **botão WhatsApp** com mensagem exata "Olá, vi seu veículo no Repasse do StockAuto e tenho interesse na parceria."
  - `VehicleForm.jsx`: toggle visual no topo "Classificado Público" vs "Repasse B2B"; quando Repasse, mostra campo "Valor Tabela FIPE" obrigatório
  - `DealerPanel.jsx`: badge "Repasse B2B" nas linhas + atalho "Ver Hub de Repasse" no header
  - `AdminPanel.jsx`: novo filtro `ad_type`, borda dourada nas linhas repasse, badge "Repasse B2B", botão **Excluir definitivo** disponível para todos os anúncios (admin)
  - `Layout.jsx`: link "REPASSE" em dourado no nav, visível apenas para dealer/admin (desktop + mobile)
  - SEO: páginas repasse com `noindex` (não vão pra Google)

### 11/Jan/2026 — Desligamento do seed automático
- `SEED_DEMO_DATA` env var (default `false`) controla criação de dados fictícios no startup
- Em produção, restart não recria dealers/veículos fictícios — apenas admin é garantido

### 10/Jan/2026 — SEO Local Campo Grande/MS completo
- **robots.txt** estático em `/robots.txt` + dinâmico em `/api/robots.txt`. Disallow para `/painel`, `/admin`, `/api/dealer/`, `/api/admin/`
- **sitemap.xml** em `/sitemap.xml` (índice) → aponta para `/api/sitemap.xml` (dinâmico, 32+ URLs)
  - Inclui home, listagens, categorias, todos os veículos ativos, todos os revendedores ativos
  - Com `lastmod`, `changefreq`, `priority` adequados
- **Open Graph + Twitter Cards** padrão em `index.html` + dinâmicos por página via `react-helmet-async`
- **JSON-LD Schema.org**:
  - `AutoDealer` + `WebSite` com `SearchAction` (caixa de busca no Google)
  - `LocalBusiness` com geo Campo Grande (-20.4697, -54.6201)
  - `Vehicle` + `Offer` (preço, disponibilidade, condição) em cada página de detalhe de anúncio
  - `AutoDealer` em cada página de revendedor (com address, telephone, areaServed)
  - `BreadcrumbList` em páginas de detalhe
- **Meta tags geo** (`geo.region=BR-MS`, `geo.placename=Campo Grande`, `geo.position`, `ICBM`)
- **Canonical URLs** dinâmicas por página (helmet gerencia)
- **Page titles** otimizados:
  - Home: "StockAuto — Comprar carros, motos e camionetes em Campo Grande, MS"
  - Listing: "{Categoria} à venda em Campo Grande - MS"
  - Vehicle: "{Marca} {Modelo} {Ano} em {Cidade} - {UF} | StockAuto"
  - Dealer: "{Loja} — Revendedor em {Cidade}/{UF} | StockAuto"
- **Keywords locais** em meta keywords (carros usados Campo Grande, etc.)
- **OG image padrão** (1200×630) gerada em `/og-default.jpg` com a logo + texto "Campo Grande, MS"
- **Componente `<SEO />`** reutilizável em `/app/frontend/src/components/SEO.jsx`
- **Verification placeholder** para Google Search Console (comentado, basta descomentar e preencher código)
- **SITE_URL** env var em `backend/.env` (https://stockauto.com.br)

### 09/Jan/2026 — Marca d'água em fotos de veículos
- Logo PNG transparente em `/app/backend/assets/watermark.png`
- Função `apply_watermark()` em Pillow: 15% largura, opacidade 60%, canto inferior direito, JPEG q88
- Aplicada apenas em `POST /api/dealer/uploads`. Logo/capa/banner não recebem marca
- Suporte a orientação EXIF (auto-rotate de fotos de celular)
- Fallback gracioso se algo falhar

### 08/Jan/2026 — Setup do ambiente
- Repo clonado, .env recriados, deps instaladas, supervisor RUNNING
- Seed: 1 admin, 5 revendedores (3 nacionais + 2 Campo Grande), 18+ veículos ativos

## Backlog priorizado

### O usuário precisa fazer manualmente (fora do código)
- **P0** — Cadastrar no [Google Search Console](https://search.google.com/search-console), verificar domínio e submeter sitemap (`https://stockauto.com.br/api/sitemap.xml`)
- **P0** — Cadastrar no [Google Meu Negócio](https://business.google.com) com endereço, telefone, fotos (essencial para SEO local Campo Grande)
- **P1** — Cadastrar no Bing Webmaster Tools
- **P1** — Forçar indexação inicial via "Inspeção de URL" no Search Console para home + 5-10 anúncios top
- **P2** — Após criar conta no Search Console, descomentar `<meta name="google-site-verification">` no `index.html` e preencher o código

### Próximas tarefas de código
- **P0** — Finalização do Painel ADM (aguardando escopo do usuário)
- **P1** — Backlinks: configurar Sociais (Instagram, Facebook) e adicionar à propriedade JSON-LD `sameAs`
- **P1** — OG image dinâmica por veículo (pegar foto principal do anúncio em vez da default)
- **P2** — Drag-and-drop nativo para reorder de banners
- **P2** — Stats reais nos cards do hero
- **P2** — Pre-rendering (Puppeteer/Prerender.io) para crawlers sem JS (Facebook, WhatsApp)

## Credenciais
Ver `/app/memory/test_credentials.md`
