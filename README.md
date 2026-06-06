# 💜 Lista de Presentes — Luciana & Wellington

Site completo de lista de presentes com:
- ✅ Sistema de cotas por presente
- ✅ Pagamento via Pix com QR Code real (Mercado Pago)
- ✅ Confirmação automática via webhook
- ✅ Banco de dados persistente (Supabase PostgreSQL)
- ✅ Mensagens dos convidados
- ✅ Hospedagem gratuita (Railway)

---

## 📁 Estrutura

```
casamento-lw/
├── server.js        ← Servidor Express + rotas da API
├── db.js            ← Queries do banco de dados (PostgreSQL)
├── public/
│   └── index.html   ← Frontend completo
├── .env.example     ← Modelo de variáveis de ambiente
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Passo a passo para colocar no ar

### PASSO 1 — Criar banco de dados no Supabase (gratuito)

1. Acesse **https://supabase.com** e crie uma conta (gratuito)
2. Clique em **"New project"**
3. Escolha um nome (ex: `casamento-lw`) e defina uma senha forte
4. Aguarde criar (leva ~2 minutos)
5. Vá em **Settings → Database → Connection string**
6. Copie a **URI** — vai ficar assim:
   ```
   postgresql://postgres:[SUA_SENHA]@db.xxxx.supabase.co:5432/postgres
   ```
7. Guarde esta string — você vai precisar no Passo 3

> O servidor cria as tabelas automaticamente na primeira vez que rodar.

---

### PASSO 2 — Configurar o Mercado Pago

1. Acesse **https://www.mercadopago.com.br/developers/panel**
2. Clique em **"Criar aplicação"** → dê um nome qualquer
3. Dentro do app, vá em **Credenciais de produção**
4. Copie o **Access Token** (começa com `APP_USR-...`)

> Para testar antes de usar dinheiro real, use o token de **Sandbox** (`TEST-...`)

---

### PASSO 3 — Subir no GitHub

```bash
# Entre na pasta do projeto
cd casamento-lw

# Instale as dependências
npm install

# Inicie o repositório Git
git init
git add .
git commit -m "Lista de presentes L&W"

# Crie um repositório no github.com/new (pode ser privado)
# Depois:
git remote add origin https://github.com/SEU_USUARIO/casamento-lw.git
git push -u origin main
```

---

### PASSO 4 — Deploy no Railway

1. Acesse **https://railway.app** e entre com sua conta GitHub
2. Clique em **"New Project" → "Deploy from GitHub repo"**
3. Selecione o repositório `casamento-lw`
4. Railway detecta Node.js e faz o deploy automaticamente
5. Aguarde o build terminar (~1 minuto)
6. Clique em **"Settings" → "Domains"** → gere o domínio público

---

### PASSO 5 — Configurar variáveis de ambiente no Railway

No painel do Railway, vá em **Variables** e adicione:

| Variável          | Valor                                           |
|-------------------|-------------------------------------------------|
| `MP_ACCESS_TOKEN` | `APP_USR-seu-token-aqui`                        |
| `DATABASE_URL`    | `postgresql://postgres:SENHA@HOST:5432/postgres`|
| `APP_URL`         | `https://casamento-lw.up.railway.app`           |
| `PORT`            | `3000`                                          |

> Após adicionar as variáveis, vá em **Deployments → Redeploy**

---

### PASSO 6 — Configurar Webhook no Mercado Pago

Para que o pagamento seja detectado automaticamente:

1. No painel do MP Developers, vá em **Webhooks**
2. Adicione a URL: `https://SEU-APP.up.railway.app/api/payment/webhook`
3. Evento: **payment**
4. Salve

---

### PASSO 7 — Atualizar a chave Pix no código

Abra `server.js` e localize no início do arquivo — a chave Pix é gerada
automaticamente pelo Mercado Pago a partir do token configurado.

Se quiser registrar sua chave telefone no MP:
1. Abra o app Mercado Pago
2. Vá em **Pix → Minhas chaves**
3. Cadastre seu número de telefone como chave

---

## 🧪 Testar localmente

```bash
# Crie o .env com suas credenciais reais
cp .env.example .env
# Edite o .env com token de SANDBOX e a DATABASE_URL do Supabase

npm install
npm start
# Acesse: http://localhost:3000
```

---

## 🎁 Personalizar os presentes

Abra `db.js`, função `seedGifts()`, e edite o array:

```js
[id, 'Nome do presente', 'categoria', 'emoji', 'Descrição', valorTotal, numCotas, valorPorCota]
```

Categorias: `casa`, `cozinha`, `cama-banho`, `experiencia`

> Se o banco já foi criado, delete os registros da tabela `gifts` no Supabase
> (Table Editor → gifts → Delete all) para o seed rodar novamente.

---

## 💰 Custos

| Item           | Custo         |
|----------------|---------------|
| Railway        | Gratuito      |
| Supabase       | Gratuito      |
| Domínio        | Gratuito (subdomínio Railway) |
| Mercado Pago   | ~0,99% por Pix aprovado |
| **Total fixo** | **R$ 0,00**   |

---

## 🔄 Fluxo do pagamento

```
Convidado escolhe cotas
        ↓
Frontend chama POST /api/payment/create
        ↓
Servidor cria pagamento no Mercado Pago
        ↓
MP retorna QR Code + código copia e cola
        ↓
Convidado paga via app do banco
        ↓
MP chama POST /api/payment/webhook (automático)
        ↓
Servidor confirma, atualiza banco, libera cotas
        ↓
Frontend detecta via polling e avança para mensagem
```
