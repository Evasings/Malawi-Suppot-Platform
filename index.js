const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid').v4;
const db = require('./db');
const path = require('path');
const airtel = require('./airtel');

const app = express();
app.use(bodyParser.json());

// serve frontend
app.use('/', express.static(path.join(__dirname, '..', 'public')));

const PLATFORM_COMMISSION_PERCENT = 5;

function cents(amountKwacha) { return Math.round(amountKwacha); }

const PLATFORM_WALLET_ID = 'platform-wallet';
const POOL_WALLET_ID = 'support-pool-wallet';
try {
  db.prepare('INSERT OR IGNORE INTO wallets (id, ownerId, balance, type) VALUES (?, ?, ?, ?)').run(PLATFORM_WALLET_ID, 'platform', 0, 'platform');
  db.prepare('INSERT OR IGNORE INTO wallets (id, ownerId, balance, type) VALUES (?, ?, ?, ?)').run(POOL_WALLET_ID, 'platform', 0, 'pool');
} catch (e) { console.error(e); }

// Create user
app.post('/api/users', (req, res) => {
  const { name, type } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO users (id, name, type) VALUES (?,?,?)').run(id, name, type);
  db.prepare('INSERT INTO wallets (id, ownerId, balance, type) VALUES (?, ?, ?, ?)').run('w-' + id, id, 0, type === 'team' ? 'team' : 'creator');
  res.json({ id, name, type });
});

// Create campaign
app.post('/api/campaigns', (req, res) => {
  const { ownerId, title, targetAmount, durationDays } = req.body;
  const id = uuid();
  const deadline = Date.now() + (durationDays || 30) * 24*60*60*1000;
  db.prepare('INSERT INTO campaigns (id, ownerId, title, targetAmount, deadline) VALUES (?,?,?,?,?)').run(id, ownerId, title, targetAmount, deadline);
  res.json({ id });
});

// Donate endpoint
app.post('/api/donate', async (req, res) => {
  const { campaignId, donorPhone, amount } = req.body;
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'active') return res.status(400).json({ error: 'Campaign not active' });

  const airtelResp = await airtel.simulatePaymentInbound(donorPhone, amount);
  if (!airtelResp.success) return res.status(400).json({ error: 'Payment failed' });

  const commission = Math.floor(amount * PLATFORM_COMMISSION_PERCENT / 100);
  const net = amount - commission;

  if (campaign.currentAmount >= campaign.targetAmount) {
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(net, POOL_WALLET_ID);
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(commission, PLATFORM_WALLET_ID);
  } else {
    const newAmount = campaign.currentAmount + net;
    db.prepare('UPDATE campaigns SET currentAmount = ? WHERE id = ?').run(newAmount, campaignId);
    const ownerWallet = db.prepare('SELECT id FROM wallets WHERE ownerId = ?').get(campaign.ownerId);
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(net, ownerWallet.id);
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(commission, PLATFORM_WALLET_ID);
    if (newAmount > campaign.targetAmount) {
      const overflow = newAmount - campaign.targetAmount;
      db.prepare('UPDATE wallets SET balance = balance - ? WHERE id = ?').run(overflow, ownerWallet.id);
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(overflow, POOL_WALLET_ID);
      db.prepare('UPDATE campaigns SET currentAmount = ? WHERE id = ?').run(campaign.targetAmount, campaignId);
    }
  }

  db.prepare('INSERT INTO donations (id, campaignId, donorPhone, amount, commission, createdAt) VALUES (?,?,?,?,?)')
    .run(uuid(), campaignId, donorPhone, amount, commission, Date.now());

  res.json({ success: true });
});

// Resolve campaign
app.post('/api/resolveCampaign', (req, res) => {
  const { campaignId } = req.body;
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.currentAmount >= campaign.targetAmount) {
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('successful', campaignId);
    return res.json({ status: 'successful' });
  }
  const shortfall = campaign.targetAmount - campaign.currentAmount;
  const pool = db.prepare('SELECT balance FROM wallets WHERE id = ?').get(POOL_WALLET_ID);
  if (pool.balance >= shortfall) {
    db.prepare('UPDATE wallets SET balance = balance - ? WHERE id = ?').run(shortfall, POOL_WALLET_ID);
    const ownerWallet = db.prepare('SELECT id FROM wallets WHERE ownerId = ?').get(campaign.ownerId);
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(shortfall, ownerWallet.id);
    db.prepare('UPDATE campaigns SET currentAmount = ?, status = ? WHERE id = ?').run(campaign.targetAmount, 'successful', campaignId);
    return res.json({ status: 'topped', amount: shortfall });
  } else {
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('failed', campaignId);
    return res.json({ status: 'failed', reason: 'insufficient pool' });
  }
});

// Withdraw
app.post('/api/withdraw', async (req, res) => {
  const { ownerId, phone } = req.body;
  const wallet = db.prepare('SELECT * FROM wallets WHERE ownerId = ?').get(ownerId);
  if (!wallet) return res.status(404).json({ error: 'Owner wallet not found' });
  const amount = wallet.balance;
  if (amount <= 0) return res.status(400).json({ error: 'No funds to withdraw' });

  const resp = await airtel.sendPayout(phone, amount);
  if (!resp.success) return res.status(500).json({ error: 'Payout failed' });

  db.prepare('UPDATE wallets SET balance = 0 WHERE id = ?').run(wallet.id);
  res.json({ success: true, amount });
});

app.get('/api/wallets/:id', (req, res) => {
  const w = db.prepare('SELECT * FROM wallets WHERE id = ?').get(req.params.id);
  res.json(w);
});
app.get('/api/campaigns/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  res.json(c);
});

app.listen(3000, () => console.log('Backend running on http://localhost:3000'));
