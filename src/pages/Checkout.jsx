import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ShieldCheck, LockKeyhole, Info, CheckCircle2, Wallet, QrCode, Copy,
  ArrowRight, ShoppingCart, Tag, Loader2, Plus,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { usd, khr } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import { ProductArt, Price, PageHead, CopyButton } from '../components/ui.jsx';

export default function Checkout() {
  const { t, L, cart, cartSubtotal, promo, rate, user, refreshUser, clearCart, notify, lang, boot } = useStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', email: user?.email || '',
    telegram: user?.telegram || '', note: '', transactionId: '',
  });
  const [method, setMethod] = useState('aba');
  const [terms, setTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name, phone: f.phone || user.phone, email: f.email || user.email }));
  }, [user]);

  const discount = promo ? (promo.type === 'percent' ? cartSubtotal * promo.value / 100 : Math.min(promo.value, cartSubtotal)) : 0;
  const total = Math.max(0, cartSubtotal - discount);
  const methodData = boot.paymentMethods.find((m) => m.id === method);
  const insufficient = method === 'wallet' && (user?.balance || 0) < total;

  const qrPayload = useMemo(() => {
    const m = methodData || {};
    return [
      'VC TOPUP PAYMENT',
      `BILLER: ${m.account || 'VC TOPUP'}`,
      `ACCOUNT: ${m.number || 'N/A'}`,
      `AMOUNT: ${usd(total)} / ${khr(total, rate)}`,
      `CURRENCY: USD`,
      `REF: VC${Date.now().toString().slice(-8)}`,
    ].join('\n');
  }, [methodData, total, rate]);

  useEffect(() => {
    let cancelled = false;
    if (!methodData || method === 'wallet') { setQr(''); return; }
    QRCode.toDataURL(qrPayload, { width: 320, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1020', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => setQr(''));
    return () => { cancelled = true; };
  }, [qrPayload, method, methodData]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (cart.length === 0) return setError(t('cart.empty'));
    if (!terms) return setError(t('co.terms'));
    if (insufficient) return setError(t('co.insufficient'));
    setSubmitting(true);
    try {
      const res = await api.post('/orders', {
        items: cart,
        customer: { name: form.name, phone: form.phone, email: form.email, telegram: form.telegram },
        payment: { method, transactionId: form.transactionId },
        promoCode: promo?.code || '',
        note: form.note,
      });
      clearCart();
      refreshUser();
      notify(lang === 'kh' ? 'ការបញ្ជាទិញបានបង្កើតដោយជោគជ័យ!' : 'Order placed successfully!', 'success');
      navigate(`/order/${res.data.code}`, { state: { order: res.data } });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 200, behavior: 'smooth' });
    } finally { setSubmitting(false); }
  };

  if (cart.length === 0) return (
    <>
      <PageHead title={t('co.title')} crumbs={[]} />
      <div className="container" style={{ padding: '60px 0 100px' }}>
        <div className="empty-state card">
          <div className="empty-icon"><ShoppingCart size={32} /></div>
          <h3>{t('cart.empty')}</h3><p>{t('cart.emptyDesc')}</p>
          <Link to="/shop" className="btn btn-primary btn-sm">{t('cart.start')} <ArrowRight size={15} /></Link>
        </div>
      </div>
    </>
  );

  return (
    <>
      <PageHead title={t('co.title')} subtitle={t('co.subtitle')} crumbs={[{ label: t('cart.title'), to: '/cart' }]} />
      <form className="container checkout-layout" onSubmit={submit}>
        <div className="stack gap-20">
          {/* --------------------------------------------------- contact info */}
          <div className="panel">
            <div className="panel-head"><h2><span className="step" style={{ width: 25, height: 25, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--grad-btn)', color: '#fff', fontSize: '.75rem' }}>1</span> {t('co.contact')}</h2>
              {!user && <Link to="/login" className="btn btn-outline btn-xs">{t('nav.login')}</Link>}
            </div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="field-label">{t('co.name')} *</label>
                  <input className="input" placeholder={t('co.namePh')} value={form.name} onChange={(e) => set('name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="field-label">{t('co.phone')} *</label>
                  <input className="input" placeholder={t('co.phonePh')} value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="field-label">{t('co.email')} <span className="opt">({t('c.optional')})</span></label>
                  <input className="input" type="email" placeholder={t('co.emailPh')} value={form.email} onChange={(e) => set('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="field-label">{t('co.telegram')}</label>
                  <input className="input" placeholder="@username" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------- payment */}
          <div className="panel">
            <div className="panel-head"><h2><span className="step" style={{ width: 25, height: 25, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--grad-btn)', color: '#fff', fontSize: '.75rem' }}>2</span> {t('co.payment')}</h2></div>
            <div className="panel-body">
              <div className="payment-options">
                {boot.paymentMethods.map((m) => (
                  <label key={m.id} className={`payment-option ${method === m.id ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value={m.id} checked={method === m.id}
                      onChange={() => setMethod(m.id)} style={{ display: 'none' }} />
                    <span className="pay-logo" style={{ background: `linear-gradient(140deg, ${m.colors[0]}, ${m.colors[1]})` }}><Icon name={m.icon} size={20} /></span>
                    <span className="grow">
                      <span className="po-name">{m.name}</span>
                      <span className="po-sub" style={{ display: 'block' }}>
                        {m.id === 'wallet' ? `${t('co.walletBalance')} ${usd(user?.balance || 0)}` : m.kind === 'khqr' ? 'KHQR · Scan & pay' : 'E-Wallet transfer'}
                      </span>
                    </span>
                    <span className="radio" />
                  </label>
                ))}
              </div>

              {methodData && method !== 'wallet' && (
                <div className="payment-detail">
                  <div className="row gap-8" style={{ marginBottom: 14, fontWeight: 700, fontSize: '.88rem' }}>
                    <QrCode size={17} className="text-violet" /> {t('co.scanQr')}
                  </div>
                  <div className="qr-wrap">
                    <div className="qr-box">
                      {qr ? <img src={qr} alt="KHQR payment code" /> : <Loader2 size={24} className="spinner" style={{ border: 0 }} />}
                    </div>
                    <div className="qr-info">
                      <div className="kv"><span>{t('co.accountName')}</span><span>{methodData.account}</span></div>
                      <div className="kv"><span>{t('co.accountNumber')}</span><span>{methodData.number}</span></div>
                      <div className="kv"><span>{t('co.amountToPay')}</span><span style={{ color: '#a78bfa' }}>{usd(total)} · {khr(total, rate)}</span></div>
                      <div className="row gap-8 wrap">
                        <CopyButton text={methodData.number || ''} label={t('c.copy')} className="btn btn-outline btn-xs" />
                        <CopyButton text={String(total.toFixed(2))} label={t('co.amountToPay')} className="btn btn-outline btn-xs" />
                      </div>
                      <span className="tiny text-dim">{t('co.qrNote')}</span>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 18 }}>
                    <label className="field-label">{t('co.txId')} <span className="opt">({t('c.optional')})</span></label>
                    <input className="input" placeholder={t('co.txIdPh')} value={form.transactionId} onChange={(e) => set('transactionId', e.target.value)} />
                  </div>
                  <p className="form-hint">{t('co.afterPay')}</p>
                </div>
              )}

              {method === 'wallet' && (
                <div className="payment-detail">
                  {user ? (
                    <>
                      <div className="row between gap-12 wrap">
                        <div><div className="tiny text-dim">{t('co.walletBalance')}</div><div className="fw-800" style={{ fontSize: '1.6rem' }}>{usd(user.balance || 0)}</div></div>
                        <Link to="/account?tab=wallet" className="btn btn-outline btn-sm"><Plus size={14} /> {t('co.addFunds')}</Link>
                      </div>
                      <div className="divider" style={{ margin: '16px 0' }} />
                      <div className="summary-row"><span>{t('co.amountToPay')}</span><strong>{usd(total)}</strong></div>
                      {insufficient && <div className="alert alert-error" style={{ marginTop: 14 }}><Info size={15} /> {t('co.insufficient')}</div>}
                    </>
                  ) : (
                    <div className="alert alert-warn"><Info size={15} /> {t('ac.loginRequired')} — <Link to="/login" style={{ textDecoration: 'underline' }}>{t('nav.login')}</Link></div>
                  )}
                </div>
              )}

              <div className="alert alert-warn" style={{ marginTop: 16 }}><Info size={15} /> {t('co.demoNotice')}</div>
            </div>
          </div>

          {/* ----------------------------------------------------------- note */}
          <div className="panel">
            <div className="panel-head"><h2><span className="step" style={{ width: 25, height: 25, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--grad-btn)', color: '#fff', fontSize: '.75rem' }}>3</span> {t('co.note')}</h2></div>
            <div className="panel-body">
              <textarea className="textarea" style={{ minHeight: 88 }} placeholder={t('co.notePh')} value={form.note} onChange={(e) => set('note', e.target.value)} />
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- summary */}
        <div className="summary-panel">
          <div className="panel">
            <div className="panel-head"><h2><Tag size={18} /> {t('co.summary')}</h2></div>
            <div className="panel-body">
              <div className="stack gap-12" style={{ marginBottom: 18 }}>
                {cart.map((item) => (
                  <div className="row gap-10" key={item.key}>
                    <ProductArt className="mini-art" style={{ width: 42, height: 42 }} product={item} compact />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 700 }}>{item.productName}</div>
                      <div className="tiny text-dim">{item.packageLabel} × {item.qty}</div>
                      {item.accountId && <div className="tiny" style={{ color: '#a78bfa', wordBreak: 'break-all' }}>{item.accountId}</div>}
                    </div>
                    <strong style={{ fontSize: '.82rem' }}>{usd(item.price * item.qty)}</strong>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="summary-row"><span>{t('c.subtotal')}</span><span>{usd(cartSubtotal)}</span></div>
              {promo && <div className="summary-row" style={{ color: '#6ee7b7' }}><span>{t('c.discount')} ({promo.code})</span><span>-{usd(discount)}</span></div>}
              <div className="summary-row total"><span>{t('c.total')}</span><Price value={total} size="lg" rate={rate} /></div>

              {error && <div className="alert alert-error" style={{ marginTop: 14 }}><Info size={15} /> {error}</div>}

              <label className="checkbox" style={{ marginTop: 18 }}>
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>{t('co.terms')} <Link to="/about">{t('co.termsLink')}</Link>.</span>
              </label>

              <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} disabled={submitting || insufficient} type="submit">
                {submitting ? <><span className="spinner" style={{ width: 17, height: 17 }} /> {t('co.processing')}</> : <><LockKeyhole size={17} /> {t('co.place')} · {usd(total)}</>}
              </button>
              <p className="text-center tiny text-dim" style={{ marginTop: 12 }}><ShieldCheck size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{t('p.secure')}</p>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
