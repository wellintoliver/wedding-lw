# 💜 Lista de Presentes — Luciana & Wellington

Site completo de lista de presentes com:
- ✅ Sistema de cotas por presente
- ✅ Pagamento via Pix com QR Code real (Mercado Pago)
- ✅ Confirmação automática via webhook
- ✅ Banco de dados persistente (Supabase PostgreSQL)
- ✅ Mensagens dos convidados
- ✅ Hospedagem gratuita (Render + UptimeRobot)

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

1. Acesse **https://supabase.com** e crie uma conta
2. Clique em **"New project"**
3. Escolha um nome (ex: `casamento-lw`) e defina uma senha forte
4. Aguarde criar (~2 minutos)
5. Vá em **Settings → Database → Connection string**
6. Copie a **URI** — vai ficar assim:
   ```
   postgresql://postgres:[SUA_SENHA]@db.xxxx.supabase.co:5432/postgres
   ```
7. Guarde esta string — você vai precisar no Passo 4

> O servidor cria as tabelas automaticamente na primeira execução.

---

### PASSO 2 — Configurar o Mercado Pago

1. Acesse **https://www.mercadopago.com.br/developers/panel**
2. Clique em **"Criar aplicação"** → dê um nome qualquer
3. Dentro do app, vá em **Credenciais de produção**
4. Copie o **Access Token** (começa com `APP_USR-...`)

> Para testar antes, use o token de **Sandbox** (`TEST-...`)

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

### PASSO 4 — Deploy no Render (gratuito)

1. Acesse **https://render.com** e entre com sua conta GitHub
2. Clique em **"New +" → "Web Service"**
3. Selecione o repositório `casamento-lw`
4. Configure:
   - **Name:** casamento-lw
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Clique em **"Create Web Service"**
6. Aguarde o build (~2 minutos)
7. Copie a URL gerada — ex: `https://casamento-lw.onrender.com`

---

### PASSO 5 — Configurar variáveis de ambiente no Render

No painel do Render, vá em **Environment** e adicione:

| Variável          | Valor                                            |
|-------------------|--------------------------------------------------|
| `MP_ACCESS_TOKEN` | `APP_USR-seu-token-aqui`                         |
| `DATABASE_URL`    | `postgresql://postgres:SENHA@HOST:5432/postgres` |
| `APP_URL`         | `https://casamento-lw.onrender.com`              |
| `PORT`            | `3000`                                           |

> Após adicionar, o Render faz o redeploy automaticamente.

---

### PASSO 6 — Configurar UptimeRobot (evita o servidor dormir)

O Render gratuito coloca o servidor para dormir após 15 minutos sem acesso.
O UptimeRobot faz um ping a cada 5 minutos para manter o servidor acordado.

1. Acesse **https://uptimerobot.com** e crie uma conta gratuita
2. Clique em **"Add New Monitor"**
3. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Casamento LW
   - **URL:** `https://casamento-lw.onrender.com/api/gifts`
   - **Monitoring Interval:** 5 minutes
4. Salve

> Bônus: o UptimeRobot também te avisa por e-mail se o site cair.

---

### PASSO 7 — Configurar Webhook no Mercado Pago

Para que pagamentos sejam confirmados automaticamente:

1. No painel do MP Developers, vá em **Webhooks**
2. Adicione a URL: `https://casamento-lw.onrender.com/api/payment/webhook`
3. Evento: **payment**
4. Salve

---

## 🧪 Testar localmente

```bash
cp .env.example .env
# Edite o .env com token Sandbox do MP e a DATABASE_URL do Supabase

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

Categorias disponíveis: `casa`, `cozinha`, `cama-banho`, `experiencia`

> Se o banco já foi populado e quiser resetar, vá no Supabase →
> Table Editor → gifts → selecione tudo → Delete. O seed roda
> automaticamente na próxima inicialização do servidor.

---

## 💰 Custos

| Item           | Custo                              |
|----------------|------------------------------------|
| Render         | Gratuito                           |
| Supabase       | Gratuito                           |
| UptimeRobot    | Gratuito                           |
| Domínio        | Gratuito (subdomínio do Render)    |
| Mercado Pago   | ~0,99% por Pix aprovado            |
| **Total fixo** | **R$ 0,00**                        |

---

## 🔄 Fluxo do pagamento

```
Convidado escolhe cotas
        ↓
Frontend → POST /api/payment/create
        ↓
Servidor cria pagamento no Mercado Pago
        ↓
MP retorna QR Code + código copia e cola
        ↓
Convidado paga via app do banco
        ↓
MP chama POST /api/payment/webhook  ← automático
        ↓
Servidor confirma, atualiza Supabase
        ↓
Frontend detecta via polling → avança para mensagem
```
