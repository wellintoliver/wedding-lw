require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const { v4: uuid } = require('uuid');
const mp           = require('mercadopago');
const db           = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Mercado Pago ─────────────────────────────────────────────────
mp.configure({ access_token: process.env.MP_ACCESS_TOKEN || '' });

// ── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API: Presentes ───────────────────────────────────────────────
app.get('/api/gifts', async (req, res) => {
  try {
    res.json(await db.getGifts());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar presentes' });
  }
});

// ── API: Mensagens ───────────────────────────────────────────────
app.get('/api/messages', async (req, res) => {
  try {
    res.json(await db.getMessages());
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

app.post('/api/messages', async (req, res) => {
  const { name, text } = req.body;
  if (!name?.trim() || !text?.trim())
    return res.status(400).json({ error: 'name e text são obrigatórios' });
  try {
    await db.addMessage({ name: name.trim(), text: text.trim() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao salvar mensagem' });
  }
});

// ── API: Criar preferência Checkout Pro ─────────────────────────
app.post('/api/payment/create', async (req, res) => {
  const { giftId, qty, name, email } = req.body;
  if (!giftId || !qty || !name)
    return res.status(400).json({ error: 'giftId, qty e name são obrigatórios' });

  const gifts = await db.getGifts();
  const gift  = gifts.find(g => g.id === giftId);
  if (!gift) return res.status(404).json({ error: 'Presente não encontrado' });

  const avail = gift.quotas - gift.resQuotas;
  if (qty > avail) return res.status(400).json({ error: 'Cotas insuficientes' });

  const amount      = qty * gift.vpq;
  const externalRef = uuid();
  const payerEmail  = email?.trim() || 'convidado@casamento.com';

  // Salva pagamento pendente no banco
  await db.createPayment({ externalRef, giftId, qty, amount, payerName: name.trim(), payerEmail });

  // Modo demo sem token
  if (!process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN === 'SEU_TOKEN_AQUI') {
    return res.json({ externalRef, amount, checkoutUrl: null, demo: true });
  }

  try {
    const appUrl = process.env.APP_URL;

    const preference = await mp.preferences.create({
      items: [{
        title:      `${qty} cota(s) — ${gift.name}`,
        description:`Casamento Luciana & Wellington · ${qty} cota${qty > 1 ? 's' : ''} de ${gift.name}`,
        quantity:   1,
        currency_id:'BRL',
        unit_price: amount,
      }],
      payer: {
        name:    name.trim().split(' ')[0],
        surname: name.trim().split(' ').slice(1).join(' ') || 'Convidado',
        email:   payerEmail,
      },
      payment_methods: {
        // Aceita todos os métodos: cartão, Pix, boleto
        excluded_payment_types: [],
        installments: 12, // permite até 12x no cartão
      },
      back_urls: {
        success: `${appUrl}/sucesso.html?ref=${externalRef}`,
        failure: `${appUrl}/`,
        pending: `${appUrl}/pendente.html?ref=${externalRef}`,
      },
      auto_return:        'approved',
      external_reference: externalRef,
      notification_url:   `${appUrl}/api/payment/webhook`,
      statement_descriptor: 'CASAMENTO LW',
    });

    const pref = preference.body;
    await db.updatePaymentMpId(externalRef, pref.id);

    res.json({
      externalRef,
      amount,
      // sandbox_init_point para testes, init_point para produção
      checkoutUrl: process.env.MP_ACCESS_TOKEN.startsWith('TEST')
        ? pref.sandbox_init_point
        : pref.init_point,
      demo: false,
    });
  } catch (err) {
    console.error('MP checkout error:', err?.message || err);
    res.status(500).json({ error: 'Erro ao criar checkout no Mercado Pago' });
  }
});

// ── API: Retorno após pagamento (back_url success) ───────────────
// O MP redireciona o convidado para cá após pagar com cartão
app.get('/api/payment/return', async (req, res) => {
  const { external_reference, status } = req.query;
  if (status === 'approved' && external_reference) {
    await db.confirmPayment(external_reference, null).catch(() => {});
  }
  res.redirect('/');
});

// ── API: Webhook Mercado Pago ────────────────────────────────────
// MP chama esta rota automaticamente quando o pagamento é aprovado
app.post('/api/payment/webhook', async (req, res) => {
  res.sendStatus(200); // responde rápido pro MP não retentar
  try {
    const { type, data } = req.body;
    if (type !== 'payment' || !data?.id) return;

    const info    = await mp.payment.get(data.id);
    const payment = info.body;

    if (payment.status !== 'approved') return;

    const pending = await db.getPaymentByMpId(String(data.id));
    if (!pending) {
      // tenta pelo external_reference como fallback
      const byRef = await db.getPaymentByRef(payment.external_reference);
      if (byRef) await db.confirmPayment(payment.external_reference, null);
      return;
    }

    await db.confirmPayment(pending.external_ref, null);
    console.log(`✅ Webhook: pagamento ${data.id} aprovado automaticamente`);
  } catch (err) {
    console.error('Webhook error:', err?.message || err);
  }
});

// ── API: Status do pagamento (polling do frontend) ───────────────
app.get('/api/payment/status/:externalRef', async (req, res) => {
  try {
    const p = await db.getPaymentByRef(req.params.externalRef);
    if (!p) return res.json({ status: 'not_found' });
    res.json({ status: p.status });
  } catch (e) {
    res.json({ status: 'error' });
  }
});

// ── API: Confirmar manualmente (fallback "Já paguei!") ───────────
app.post('/api/payment/confirm', async (req, res) => {
  const { externalRef, message } = req.body;
  if (!externalRef) return res.status(400).json({ error: 'externalRef obrigatório' });
  try {
    const ok = await db.confirmPayment(externalRef, message || null);
    ok ? res.json({ ok: true }) : res.status(400).json({ error: 'Pagamento não encontrado ou já confirmado' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao confirmar' });
  }
});

// ── Start ────────────────────────────────────────────────────────
db.initDB()
  .then(() => app.listen(PORT, () => console.log(`🌸 Servidor rodando na porta ${PORT}`)))
  .catch(err => { console.error('Erro ao iniciar banco:', err); process.exit(1); });
