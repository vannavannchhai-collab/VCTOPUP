import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, ShieldCheck, Clock3, Zap, AlertTriangle, Loader2, QrCode } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { usd, khr, dateTime } from '../lib/format.js';
import { CopyButton, StatusBadge, Price } from '../components/ui.jsx';

export default function OrderSuccess() {
  const { code } = useParams();
  const location = useLocation();
  const { t, rate, notify, settings } = useStore();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.get(`/orders/${code}`)
      .then((res) => { if (!cancelled) setOrder(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    return () => { cancelled = true; };
  }, [code]);

  // Keep the delivery status live. The status endpoint is idempotent and also
  // self-heals: a paid order whose delivery was interrupted is retried here.
  useEffect(() => {
    if (!order) return;
    if (['completed', 'cancelled', 'delivery_failed'].includes(order.status)) return;
    const id = setInterval(() => {
      api.get(`/payments/${code}/status`)
        .then((res) => setOrder((o) => o && ({ ...o, status: res.data.status, payment: { ...o.payment, status: res.data.paymentStatus }, fulfillment: res.data.fulfillment, deliveredAt: res.data.deliveredAt })))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [order?.status, code]);

  if (loading) return <div className="loading-center"><span className="spinner" /> {t('c.loading')}</div>;

  const finished = order?.status === 'completed';
  const failed = order?.status === 'delivery_failed';
  const awaitingPayment = order?.payment?.status === 'pending' || order?.payment?.status === 'expired';

  return (
    <div className="container success-wrap">
      <div className={`success-icon ${failed ? 'failed' : ''}`}>
        {finished ? <Check size={46} strokeWidth={2.5} /> : failed ? <AlertTriangle size={46} /> : <Zap size={44} />}
      </div>
      <div className="text-center">
        <h1 className="gradient-text" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
          {finished ? t('pay.done') : failed ? t('pay.failed') : t('suc.title')}
        </h1>
        <p style={{ maxWidth: 540, margin: '12px auto 0' }}>
          {finished ? t('st.completedD') : failed ? t('pay.failedDesc') : awaitingPayment ? t('pay.waiting') : t('suc.subtitle')}
        </p>
        <div className="row center gap-10 wrap" style={{ marginTop: 20 }}>
          <span className="success-code">{order?.code || code}</span>
          <CopyButton text={order?.code || code || ''} onCopied={() => notify(t('c.copied'), 'success')} />
        </div>
        <div className="tiny text-dim" style={{ marginTop: 4 }}>{t('suc.keep')}</div>
      </div>

      <div className="panel" style={{ marginTop: 38 }}>
        <div className="panel-head">
          <h2>{t('co.summary')}</h2>
          {order && <StatusBadge status={order.status} />}
        </div>
        <div className="panel-body">
          {order?.items.map((item, i) => (
            <div className="row between gap-12" key={i} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <strong style={{ fontSize: '.88rem' }}>{item.productName}</strong>
                <div className="tiny text-dim">{item.packageLabel} × {item.qty}</div>
                {item.accountId && <div className="tiny text-violet">{t('cart.account')} {item.accountId}</div>}
              </div>
              <strong>{usd(item.lineTotal)}</strong>
            </div>
          ))}
          <div className="summary-row" style={{ marginTop: 12 }}><span>{t('c.subtotal')}</span><span>{usd(order?.subtotal)}</span></div>
          {order?.discount > 0 && <div className="summary-row" style={{ color: '#6ee7b7' }}><span>{t('c.discount')}</span><span>-{usd(order.discount)}</span></div>}
          <div className="summary-row total"><span>{t('c.total')}</span><Price value={order?.total} size="lg" rate={rate} /></div>
          <div className="row between gap-12 wrap tiny text-dim" style={{ marginTop: 12 }}>
            <span>{t('c.date')}: {dateTime(order?.createdAt)}</span>
            <span>{t('ad.method')}: {order?.payment?.method?.toUpperCase()}</span>
            <span>+{order?.pointsEarned || 0} {t('ac.points')}</span>
          </div>
        </div>
      </div>

      {/* Real-money → real-diamonds status, straight from the server. */}
      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head"><h2 style={{ fontSize: '1rem' }}><Zap size={17} /> {t('tr.timeline')}</h2>
          {order && <StatusBadge status={order.status} />}</div>
        <div className="panel-body">
          <div className="delivery-track">
            {[
              { key: 'verify', label: t('pay.step2'), done: !awaitingPayment, icon: ShieldCheck },
              { key: 'deliver', label: t('pay.step3'), done: finished, icon: Zap },
            ].map((s) => (
              <div className={`delivery-item ${s.done ? 'done' : ''}`} key={s.key}>
                <span className="di">{s.done ? <Check size={15} /> : <s.icon size={15} />}</span>
                <strong>{s.label}</strong>
                {!s.done && <Loader2 size={13} className="spinner" />}
              </div>
            ))}
          </div>
          {order?.payment?.sandbox && (
            <div className="alert alert-warn" style={{ marginTop: 14 }}><QrCode size={14} /> {t('pay.sandbox')}</div>
          )}
          {order?.fulfillment?.ref && (
            <div className="tiny text-dim" style={{ marginTop: 10 }}>{t('pay.ref')}: {order.fulfillment.ref}</div>
          )}
          {order?.deliveredAt && (
            <div className="tiny" style={{ marginTop: 6, color: '#6ee7b7' }}>{dateTime(order.deliveredAt)}</div>
          )}
          {awaitingPayment && (
            <Link to={`/pay/${code}`} className="btn btn-primary btn-sm btn-block" style={{ marginTop: 14 }}>
              <QrCode size={14} /> {t('pay.title')} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      <h3 className="text-center" style={{ marginTop: 40, marginBottom: 20 }}>{t('suc.next')}</h3>
      <div className="success-steps">
        {[
          { i: 1, ico: ShieldCheck, text: t('suc.step1') },
          { i: 2, ico: Clock3, text: t('suc.step2') },
          { i: 3, ico: Sparkles, text: t('suc.step3') },
        ].map((s) => (
          <div className="success-step" key={s.i}>
            <div className="sn">{s.i}</div>
            <s.ico size={22} style={{ color: '#a78bfa', marginBottom: 8 }} />
            <p>{s.text}</p>
          </div>
        ))}
      </div>

      <div className="row center gap-12 wrap" style={{ marginTop: 34 }}>
        <Link to={`/track?code=${order?.code || code}`} className="btn btn-primary btn-lg">{t('suc.track')} <ArrowRight size={17} /></Link>
        <Link to="/" className="btn btn-outline btn-lg">{t('c.goHome')}</Link>
      </div>
      <p className="text-center small text-dim" style={{ marginTop: 22 }}>
        {t('suc.help')} <a href={`https://t.me/${(settings.telegram || '@vctopup').replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: '#c4b5fd' }}>{settings.telegram}</a>
      </p>
    </div>
  );
}
