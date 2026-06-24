# Add-valiador
Portal de gestão de avaliações imobiliárias.

## Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS (Vite)
- **Backend/DB**: Supabase (PostgreSQL + Storage + Auth)
- **Deploy**: Vercel

---

## 1. Supabase — Setup inicial

### 1.1 Criar projecto
1. Vai a [supabase.com](https://supabase.com) → New project
2. Escolhe região `eu-central-1` (Frankfurt) para menor latência

### 1.2 Aplicar schema
No Supabase Dashboard → SQL Editor, cola e executa o conteúdo de:
```
supabase/migrations/001_initial_schema.sql
```

### 1.3 Criar Storage Buckets
Em Storage → New bucket, cria os seguintes (todos **Public** para MVP, tornar privado depois):

| Bucket      | Public | Allowed MIME                          | Max size  |
|-------------|--------|---------------------------------------|-----------|
| `photos`    | ✓      | image/jpeg, image/png, image/webp     | 1 048 576 |
| `templates` | ✗      | application/vnd.openxmlformats-*      | 10 MB     |
| `reports`   | ✗      | application/vnd.openxmlformats-*      | 10 MB     |
| `datatapes` | ✗      | application/vnd.openxmlformats-*      | 50 MB     |

### 1.4 Obter credenciais
Settings → API:
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public key` → `VITE_SUPABASE_ANON_KEY`

---

## 2. Repositório GitHub

```bash
git init
git add .
git commit -m "chore: initial Add-valiador setup"
gh repo create add-valiador --private --push --source=.
```

---

## 3. Deploy Vercel

### 3.1 Importar projecto
1. [vercel.com](https://vercel.com) → Add New Project → Import from GitHub
2. Selecciona o repositório `add-valiador`
3. Framework preset: **Vite**

### 3.2 Environment variables
Em Settings → Environment Variables, adiciona:

```
VITE_SUPABASE_URL        = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJ...
```

### 3.3 Deploy
Clica Deploy. O `vercel.json` já inclui o rewrite para SPA routing.

---

## 4. Desenvolvimento local

```bash
cp .env.example .env.local
# Preenche as variáveis em .env.local

npm install
npm run dev
```

---

## 5. Fluxo de trabalho

### Importar portfólio (data-tape)
1. Menu **Clientes** → criar cliente
2. Menu **Portfólios** → criar portfólio associado ao cliente
3. Menu **Importar data-tape** → carrega o Excel
4. Mapeia as colunas (muitas são detectadas automaticamente)
5. Confirma → imóveis criados com refs AV-0001, AV-0002, …

### Associar template Excel
_(Disponível após carregares o template do cliente)_
1. Clientes → abre o cliente → Adicionar template
2. Carrega o ficheiro .xlsx
3. Define o mapeamento campo → célula (ex: `B3` → `address`)
4. Na ficha do imóvel → "Gerar report Excel" usará esse template

### Gestão de visitas
- Imóveis → abre imóvel → tab Informação → actualiza estado
- Tab Fotos → arrasta fotos (comprimidas automaticamente ≤ 1 MB)
- Tab Comparáveis → regista anúncios de mercado
- Tab Faturação → actualiza estado financeiro, PO, fatura

### Gerar report
- Ficha do imóvel → botão "Gerar report Excel"
- Descarrega um `.xlsx` com dados do imóvel + comparáveis

--

## 6. Próximos passos (roadmap)

- [ ] Auth com Supabase (email/password)
- [ ] Template mapper visual (drag & drop célula ↔ campo)
- [ ] Inserção de fotos directamente nas células do Excel template
- [ ] Mapa com georreferenciação (Leaflet + PostGIS)
- [ ] Extensão Chrome para captura semi-automática de comparáveis
- [ ] Exportação de relatório financeiro (PDF)
- [ ] Multi-utilizador / equipas
