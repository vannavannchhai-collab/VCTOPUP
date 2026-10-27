import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, Send, ShieldCheck, Clock3 } from 'lucide-react';
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
    if (order) return;
    let cancelled = false;
    api.get(`/orders/${code}`).then((res) => { if (!cancelled) setOrder(res.data); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code]);

  if (loading) return <div className="loading-center"><span className="spinner" /> {t('c.loading')}</div>;

  return (
    <div className="container success-wrap">
      <div className="success-icon"><Check size={46} strokeWidth={2.5} /></div>
      <div className="text-center">
        <h1 className="gradient-text" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>{t('suc.title')}</h1>
        <p style={{ maxWidth: 540, margin: '12px auto 0' }}>{t('suc.subtitle')}</p>
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
