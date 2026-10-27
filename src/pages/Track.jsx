import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Package, Check, Clock3, X, Info, ArrowRight, Phone, Mail,
  CalendarDays, CreditCard,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api, qs } from '../lib/api.js';
import { usd, dateTime } from '../lib/format.js';
import { PageHead, StatusBadge, CopyButton } from '../components/ui.jsx';

const STEPS = [
  { key: 'pending', icon: Package },
  { key: 'paid', icon: CreditCard },
  { key: 'processing', icon: Clock3 },
  { key: 'completed', icon: Check },
];

export default function Track() {
  const { t, L, rate, settings } = useStore();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setError(''); setOrder(null);
    try {
      const res = await api.get(`/orders/${encodeURIComponent(code.trim())}${qs({ phone })}`);
      setOrder(res.data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (params.get('code')) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentIdx = STEPS.findIndex((s) => s.key === order?.status);

  return (
    <>
      <PageHead title={t('tr.title')} subtitle={t('tr.subtitle')} crumbs={[]} />
      <div className="container track-wrap">
        <form className="panel" style={{ padding: 24 }} onSubmit={lookup}>
          <div className="track-form">
            <div className="form-group">
              <label className="field-label">{t('suc.code')}</label>
              <input className="input" placeholder={t('tr.codePh')} value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="field-label">{t('co.phone')} <span className="opt">({t('c.optional')})</span></label>
              <input className="input" placeholder={t('tr.phonePh')} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Search size={17} />} {t('tr.button')}
            </button>
          </div>
        </form>

        {error && !order && (
          <div className="empty-state card" style={{ marginTop: 24 }}>
            <div className="empty-icon" style={{ background: 'rgba(251,113,133,.1)', borderColor: 'rgba(251,113,133,.25)', color: '#fda4af' }}><X size={30} /></div>
            <h3>{t('tr.notFound')}</h3><p>{t('tr.notFoundDesc')}</p>
            <div className="alert alert-error" style={{ marginTop: 8 }}><Info size={14} /> {error}</div>
          </div>
        )}

        {order && (
          <div className="track-result">
            <div className="status-hero">
              <div className={`si badge-${order.status === 'completed' ? 'green' : order.status === 'cancelled' ? 'red' : order.status === 'processing' ? 'blue' : 'amber'}`}
                style={{ background: 'rgba(139,92,246,.13)', color: '#c4b5fd' }}>
                {order.status === 'completed' ? <Check size={27} /> : order.status === 'cancelled' ? <X size={27} /> : <Clock3 size={27} />}
              </div>
              <div className="grow">
                <div className="row between gap-12 wrap" style={{ marginBottom: 5 }}>
                  <strong style={{ fontSize: '1.05rem' }}>{order.code}</strong>
                  <StatusBadge status={order.status} />
                </div>
                <p style={{ fontSize: '.85rem' }}>{t(`st.${order.status}D`)}</p>
                <div className="tiny text-dim" style={{ marginTop: 6 }}><CalendarDays size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{dateTime(order.createdAt)}</div>
              </div>
              <CopyButton text={order.code} className="btn btn-outline btn-sm" />
            </div>

            <div className="checkout-layout" style={{ padding: 0, gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="panel">
                <div className="panel-head"><h2 style={{ fontSize: '1rem' }}>{t('tr.timeline')}</h2></div>
                <div className="panel-body">
                  {['cancelled', 'delivery_failed'].includes(order.status) ? (
                    <div className="timeline">
                      {order.timeline.map((tl, i) => (
                        <div className="timeline-item done" key={i}>
                          <span className="tdot">{tl.status === 'cancelled' ? <X size={13} /> : <Check size={13} />}</span>
                          <div><strong>{t(`st.${tl.status}`)}</strong><small>{dateTime(tl.at)} · {tl.note}</small></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="timeline">
                      {STEPS.map((s, i) => {
                        const reached = currentIdx >= i;
                        const tl = order.timeline.find((x) => x.status === s.key);
                        return (
                          <div className={`timeline-item ${reached ? 'done' : ''}`} key={s.key}>
                            <span className="tdot">{reached ? <Check size={13} /> : <s.icon size={13} />}</span>
                            <div>
                              <strong>{t(`st.${s.key}`)}</strong>
                              <small>{tl ? `${dateTime(tl.at)} · ${tl.note}` : t(`st.${s.key}D`)}</small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><h2 style={{ fontSize: '1rem' }}>{t('tr.items')}</h2></div>
                <div className="panel-body">
                  <div className="order-lines">
                    {order.items.map((item, i) => (
                      <div className="row between gap-12" key={i} style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                        <div><strong style={{ fontSize: '.85rem' }}>{item.productName}</strong>
                          <div className="tiny text-dim">{item.packageLabel} × {item.qty}</div>
                          {item.accountId && <div className="tiny text-violet">{t('cart.account')} {item.accountId}</div>}
                        </div>
                        <strong style={{ fontSize: '.85rem' }}>{usd(item.lineTotal)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="summary-row" style={{ marginTop: 12 }}><span>{t('c.subtotal')}</span><span>{usd(order.subtotal)}</span></div>
                  {order.discount > 0 && <div className="summary-row" style={{ color: '#6ee7b7' }}><span>{t('c.discount')}</span><span>-{usd(order.discount)}</span></div>}
                  <div className="summary-row total"><span>{t('c.total')}</span><strong>{usd(order.total)}</strong></div>
                  <div className="stack gap-8 tiny text-dim" style={{ marginTop: 14 }}>
                    <span className="row gap-6"><Phone size={12} /> {order.customer.phone}</span>
                    {order.customer.email && <span className="row gap-6"><Mail size={12} /> {order.customer.email}</span>}
                    <span className="row gap-6"><CreditCard size={12} /> {order.payment.method.toUpperCase()} · {order.payment.status === 'paid' ? t('c.paid') : t('c.unpaid')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginTop: 20 }}>
              <Info size={16} />
              <span>{t('suc.help')} <a href={`https://t.me/${(settings.telegram || '@vctopup').replace('@', '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{settings.telegram}</a></span>
            </div>
            <div className="row center gap-12 wrap" style={{ marginTop: 22 }}>
              {order.payment.status !== 'paid' && order.status !== 'cancelled' && (
                <Link to={`/pay/${order.code}`} className="btn btn-primary btn-sm">{t('pay.title')} <ArrowRight size={15} /></Link>
              )}
              <Link to="/shop" className="btn btn-outline btn-sm">{t('cart.continue')}</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
