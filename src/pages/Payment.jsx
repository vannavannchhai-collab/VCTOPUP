import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ShieldCheck, QrCode, Clock3, Check, CheckCircle2, RefreshCw, Loader2,
  AlertTriangle, ArrowRight, Copy, Wallet, Info, Zap,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { usd, khr, dateTime } from '../lib/format.js';
import { CopyButton, StatusBadge } from '../components/ui.jsx';
import { PageHead } from '../components/ui.jsx';

const POLL_MS = 5000;

function useCountdown(expiresAt) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  return { left, label: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` };
}

export default function Payment() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t, rate, notify, lang } = useStore();

  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrImg, setQrImg] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const finished = useRef(false);
  const currentStatus = status?.status || info?.status || 'pending';
  const countdown = useCountdown(info?.payment?.expiresAt);

  const loadInfo = useCallback(async () => {
    try {
      const res = await api.get(`/payments/${encodeURIComponent(code)}`);
      setInfo(res.data);
      setStatus((s) => s || { status: res.data.status, paymentStatus: res.data.payment.status, fulfillment: res.data.fulfillment, timeline: res.data.timeline });
      setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [code]);

  const poll = useCallback(async () => {
    try {
      const res = await api.get(`/payments/${encodeURIComponent(code)}/status`);
      setStatus(res.data);
      if (res.data.status === 'completed' && !finished.current) {
        finished.current = true;
        clearInterval(timer.current);
        notify(t('pay.done'), 'success');
      }
    } catch (err) { setError(err.message); }
  }, [code, notify, t]);

  useEffect(() => { loadInfo(); }, [loadInfo]);
  useEffect(() => {
    timer.current = setInterval(poll, POLL_MS);
    poll();
    return () => clearInterval(timer.current);
  }, [poll]);

  // Render the server-generated KHQR string. The browser never invents it.
  useEffect(() => {
    const qr = info?.payment?.qr;
    if (!qr) { setQrImg(''); return; }
    let cancelled = false;
    QRCode.toDataURL(qr, { width: 340, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1020', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQrImg(url); })
      .catch(() => setQrImg(''));
    return () => { cancelled = true; };
  }, [info?.payment?.qr]);

  const simulate = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${encodeURIComponent(code)}/simulate`, {});
      notify(lang === 'kh' ? 'បានក្លែងធ្វើការទូទាត់' : 'Bank payment simulated', 'info');
      await poll();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const refreshQr = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${encodeURIComponent(code)}/refresh`, {});
      finished.current = false;
      await loadInfo();
      await poll();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="loading-center"><span className="spinner" /> {t('c.loading')}</div>;
  if (!info) return (
    <div className="container" style={{ padding: '80px 0' }}>
      <div className="empty-state card"><div className="empty-icon"><AlertTriangle size={30} /></div>
        <h3>{error || t('c.error')}</h3><Link to="/shop" className="btn btn-primary btn-sm">{t('pay.backShop')}</Link></div>
    </div>
  );

  const p = info.payment;
  const isSandbox = p.sandbox || p.mode === 'sandbox';
  const isManual = p.verification === 'manual';
  const isPaid = ['paid', 'processing', 'completed', 'delivery_failed'].includes(currentStatus) || status?.paymentStatus === 'paid';
  const isDone = currentStatus === 'completed';
  const isFailed = currentStatus === 'delivery_failed';
  const hasDiscrepancy = Boolean(status?.discrepancy?.length);
  const isExpired = p.expiresAt && countdown && countdown.left === 0 && !isPaid;
  const stepIndex = isDone || isFailed ? 3 : isPaid ? 2 : 0;

  return (
    <>
      <PageHead title={t('pay.title')} crumbs={[{ label: t('co.title'), to: '/checkout' }]} subtitle={t('pay.subtitle')} />

      <div className="container payment-page">
        {isSandbox && (
          <div className="alert alert-warn sandbox-ribbon">
            <Info size={16} /><strong>{t('pay.sandbox')}</strong>
          </div>
        )}
        {!isSandbox && (
          <div className="alert alert-success sandbox-ribbon">
            <ShieldCheck size={16} /><strong>{t('pay.live')}</strong>
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertTriangle size={15} /> {error}</div>}

        <div className="pay-grid">
          {/* ---------------------------------------------------------- left */}
          <div className="panel pay-qr-card">
            <div className="panel-head">
              <h2><QrCode size={19} /> {t('pay.title')}</h2>
              <StatusBadge status={isDone ? 'completed' : isFailed ? 'delivery_failed' : isPaid ? 'paid' : 'pending'} />
            </div>
            <div className="panel-body">
              {p.qr && !isPaid ? (
                <>
                  <div className="qr-box pay-qr-box">
                    {qrImg ? <img src={qrImg} alt="Bakong KHQR payment code" /> : <Loader2 size={26} className="spinner" />}
                  </div>
                  {isExpired ? (
                    <div className="pay-expired">
                      <Clock3 size={17} /> {t('pay.expired')}
                      <button className="btn btn-primary btn-sm" onClick={refreshQr} disabled={busy}>
                        <RefreshCw size={14} /> {t('pay.refresh')}
                      </button>
                    </div>
                  ) : (
                    <div className="pay-countdown"><Clock3 size={15} /> {t('pay.expires')} <strong>{countdown?.label || '--:--'}</strong></div>
                  )}
                  <div className="pay-kv"><span>{t('pay.amount')}</span><strong className="gradient-text">{usd(p.amount)} · {khr(p.amount, rate)}</strong></div>
                  <div className="pay-kv"><span>{t('pay.merchant')}</span><span>{p.merchantName}</span></div>
                  <div className="pay-kv"><span>{t('pay.account')}</span><span>{p.accountId}</span></div>
                  <div className="pay-kv"><span>{t('pay.bill')}</span><span>{info.code}</span></div>
                  <div className="row gap-8 wrap" style={{ marginTop: 14 }}>
                    <CopyButton text={p.qr} className="btn btn-outline btn-sm" label={t('pay.copyQr')} />
                    <button className="btn btn-ghost btn-sm" onClick={refreshQr} disabled={busy}><RefreshCw size={14} /> {t('pay.refresh')}</button>
                  </div>
                </>
              ) : isManual && !isPaid ? (
                <div className="pay-manual">
                  <Wallet size={30} />
                  <h3>{p.accountName}</h3>
                  <div className="success-code">{p.accountNumber}</div>
                  <CopyButton text={p.accountNumber || ''} label={t('c.copy')} className="btn btn-outline btn-sm" />
                  <div className="alert alert-warn" style={{ marginTop: 16 }}><Info size={14} /> {t('pay.manual')}</div>
                </div>
              ) : (
                <div className={`pay-state ${isDone ? 'done' : isFailed ? 'failed' : ''}`}>
                  {isDone ? <CheckCircle2 size={52} /> : isFailed ? <AlertTriangle size={52} /> : <Loader2 size={46} className="spinner" />}
                  <h3>{isDone ? t('pay.done') : isFailed ? t('pay.failed') : isPaid ? t('pay.delivering') : t('pay.waiting')}</h3>
                  <p>{isDone ? t('st.completedD') : isFailed ? t('pay.failedDesc') : t('pay.checking')}</p>
                  {status?.fulfillment?.ref && <div className="tiny text-dim">{t('pay.ref')}: {status.fulfillment.ref}</div>}
                  {isDone && <Link to={`/order/${code}`} className="btn btn-primary" style={{ marginTop: 18 }}>{t('pay.openOrder')} <ArrowRight size={16} /></Link>}
                </div>
              )}

              {!isSandbox && <div className="alert alert-info" style={{ marginTop: 16 }}><ShieldCheck size={14} /> {t('pay.secureNote')}</div>}
              {!isDone && <p className="text-center tiny text-dim" style={{ marginTop: 12 }}>{t('pay.auto')}</p>}
            </div>
          </div>

          {/* --------------------------------------------------------- right */}
          <div className="stack gap-16">
            <div className="panel">
              <div className="panel-head"><h2 style={{ fontSize: '1rem' }}>{t('suc.next')}</h2></div>
              <div className="panel-body">
                <div className="pay-steps">
                  {[
                    { label: t('pay.step1'), ico: QrCode },
                    { label: t('pay.step2'), ico: ShieldCheck },
                    { label: t('pay.step3'), ico: Zap },
                  ].map((s, i) => (
                    <div className={`pay-step ${stepIndex > i ? 'done' : stepIndex === i ? 'active' : ''}`} key={i}>
                      <span className="ps-num">{stepIndex > i ? <Check size={14} /> : i + 1}</span>
                      <s.ico size={17} />
                      <strong>{s.label}</strong>
                    </div>
                  ))}
                </div>

                {isSandbox && !isPaid && (
                  <div className="pay-simulate">
                    <button className="btn btn-cyan btn-block" onClick={simulate} disabled={busy}>
                      {busy ? <Loader2 size={16} className="spinner" /> : <Zap size={16} />} {t('pay.simulate')}
                    </button>
                    <p className="tiny text-dim" style={{ marginTop: 8 }}>{t('pay.simulateHint')}</p>
                  </div>
                )}

                {hasDiscrepancy && (
                  <div className="alert alert-error" style={{ marginTop: 14 }}>
                    <AlertTriangle size={15} /><div><strong>{t('pay.discrepancy')}</strong>
                      <div className="tiny">{status.discrepancy.join(' · ')}</div></div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2 style={{ fontSize: '1rem' }}>{t('co.summary')}</h2>
                <span className="badge badge-gray">{info.code}</span></div>
              <div className="panel-body">
                {info.items.map((it, i) => (
                  <div className="row between gap-12" key={i} style={{ paddingBottom: 9, borderBottom: '1px solid var(--line)' }}>
                    <div><strong style={{ fontSize: '.83rem' }}>{it.productName}</strong>
                      <div className="tiny text-dim">{it.packageLabel} × {it.qty}</div>
                      {it.accountId && <div className="tiny text-violet" style={{ wordBreak: 'break-all' }}>{it.accountId}</div>}</div>
                    <strong className="small">{usd(it.lineTotal)}</strong>
                  </div>
                ))}
                <div className="summary-row total" style={{ marginTop: 12 }}><span>{t('c.total')}</span><strong>{usd(info.total)}</strong></div>
                <div className="tiny text-dim" style={{ marginTop: 8 }}>{t('c.date')}: {dateTime(info.createdAt)}</div>
                <Link to={`/track?code=${code}`} className="btn btn-outline btn-sm btn-block" style={{ marginTop: 14 }}>
                  {t('nav.track')} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
