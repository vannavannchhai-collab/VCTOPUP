import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Wallet, Settings, LogOut, Wallet as WalletIcon,
  Coins, TrendingUp, Plus, Gift, ArrowRight, CheckCircle2, Info, ShieldCheck,
  LockKeyhole, Save, Eye, Package,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { usd, dateShort, initials } from '../lib/format.js';
import { PageHead, StatusBadge } from '../components/ui.jsx';

const TABS = [
  { id: 'overview', key: 'ad.overview', icon: LayoutDashboard },
  { id: 'orders', key: 'nav.orders', icon: ShoppingBag },
  { id: 'wallet', key: 'nav.wallet', icon: WalletIcon },
  { id: 'settings', key: 'nav.settings', icon: Settings },
];

export default function Account() {
  const { t, user, authLoading, refreshUser, logout, notify, lang, rate } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'overview');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [topupOpen, setTopupOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({ name: '', phone: '', telegram: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    setProfile({ name: user.name || '', phone: user.phone || '', telegram: user.telegram || '' });
    setLoadingOrders(true);
    api.get('/auth/orders').then((r) => setOrders(r.data)).catch(() => {}).finally(() => setLoadingOrders(false));
  }, [user?.id]);

  const changeTab = (id) => { setTab(id); setParams(id === 'overview' ? {} : { tab: id }); };

  const doTopup = async (amount) => {
    setBusy(true);
    try {
      await api.post('/auth/wallet/topup', { amount });
      await refreshUser();
      notify(`$${amount} ${lang === 'kh' ? 'បានបន្ថែមទៅកាបូបរបស់អ្នក' : 'added to your wallet'}`, 'success');
      setTopupOpen(false);
    } catch (err) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const doRedeem = async () => {
    setBusy(true);
    try { const r = await api.post('/auth/wallet/redeem'); await refreshUser(); notify(r.message, 'success'); }
    catch (err) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const saveProfile = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { const r = await api.put('/auth/profile', profile); await refreshUser(); setMsg(r.message); notify(t('ac.updated'), 'success'); }
    catch (err) { setMsg(err.message); }
    finally { setBusy(false); }
  };

  const changePass = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { const r = await api.post('/auth/change-password', passwords); setMsg(r.message); notify(r.message, 'success'); setPasswords({ current: '', next: '' }); }
    catch (err) { setMsg(err.message); }
    finally { setBusy(false); }
  };

  if (authLoading) return <div className="loading-center"><span className="spinner" /> {t('c.loading')}</div>;
  if (!user) return (
    <div className="container" style={{ padding: '80px 0' }}>
      <div className="empty-state card">
        <div className="empty-icon"><LockKeyhole size={32} /></div>
        <h3>{t('ac.loginRequired')}</h3>
        <Link to="/login" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>{t('nav.login')} <ArrowRight size={15} /></Link>
      </div>
    </div>
  );

  const spent = orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageHead title={t('ac.title')} crumbs={[]} />
      <div className="container account-wrap">
        <div className="account-hero">
          <div className="big-avatar">{initials(user.name)}</div>
          <div className="grow">
            <h1>{t('ac.hello')}, {user.name}</h1>
            <p>{user.email} · {t('ac.member')} {dateShort(user.createdAt, lang)}</p>
          </div>
          {user.role === 'admin' && <Link to="/admin" className="btn btn-outline btn-sm"><ShieldCheck size={15} /> {t('nav.admin')}</Link>}
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); notify(t('nav.logout'), 'info'); }}><LogOut size={15} /> {t('nav.logout')}</button>
        </div>

        <div className="account-stats">
          <div className="account-stat"><span className="as-icon" style={{ background: 'rgba(139,92,246,.14)', color: '#c4b5fd' }}><WalletIcon size={19} /></span>
            <div className="as-value gradient-text">{usd(user.balance || 0)}</div><small>{t('ac.balance')}</small></div>
          <div className="account-stat"><span className="as-icon" style={{ background: 'rgba(251,191,36,.14)', color: '#fcd34d' }}><Coins size={19} /></span>
            <div className="as-value">{user.points || 0}</div><small>{t('ac.points')}</small></div>
          <div className="account-stat"><span className="as-icon" style={{ background: 'rgba(34,211,238,.14)', color: '#67e8f9' }}><ShoppingBag size={19} /></span>
            <div className="as-value">{orders.length}</div><small>{t('ac.orders')}</small></div>
          <div className="account-stat"><span className="as-icon" style={{ background: 'rgba(52,211,153,.14)', color: '#6ee7b7' }}><TrendingUp size={19} /></span>
            <div className="as-value">{usd(spent)}</div><small>{t('ac.spent')}</small></div>
        </div>

        <div className="account-layout">
          <nav className="account-nav">
            {TABS.map((tb) => (
              <button key={tb.id} className={tab === tb.id ? 'on' : ''} onClick={() => changeTab(tb.id)}>
                <tb.icon size={17} /> {t(tb.key)}
              </button>
            ))}
          </nav>

          <div style={{ minWidth: 0 }}>
            {/* ------------------------------------------------------ overview */}
            {tab === 'overview' && (
              <div className="stack gap-20">
                <div className="panel">
                  <div className="panel-head"><h2>{t('ac.history')}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={() => changeTab('orders')}>{t('c.viewAll')} <ArrowRight size={14} /></button></div>
                  <div className="panel-body">
                    {orders.length === 0 ? <p className="text-dim small">{t('ac.noOrders')}</p> : orders.slice(0, 4).map((o) => (
                      <div className="row between gap-12" key={o.code} style={{ padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                        <div><strong style={{ fontSize: '.84rem' }}>{o.items[0]?.productName}</strong>
                          <div className="tiny text-dim">{o.code} · {dateShort(o.createdAt, lang)}</div></div>
                        <div className="text-right"><StatusBadge status={o.status} /><div className="small" style={{ marginTop: 4 }}>{usd(o.total)}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head"><h2><Gift size={18} /> {t('ac.points')}</h2></div>
                  <div className="panel-body">
                    <div className="row between gap-16 wrap">
                      <div><div className="fw-800" style={{ fontSize: '2rem' }}>{user.points || 0} <span className="small text-dim">PTS</span></div>
                        <p className="small" style={{ marginTop: 4 }}>{t('why.3d')}</p></div>
                      <button className="btn btn-primary btn-sm" disabled={(user.points || 0) < 100 || busy} onClick={doRedeem}><Gift size={15} /> {t('ac.redeem')}</button>
                    </div>
                    <div className="cat-bar-track" style={{ marginTop: 16 }}><div className="cat-bar-fill" style={{ width: `${Math.min(100, ((user.points || 0) % 100))}%` }} /></div>
                    <div className="tiny text-dim" style={{ marginTop: 6 }}>{(user.points || 0) % 100} / 100 → $1.00</div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- orders */}
            {tab === 'orders' && (
              <div className="panel">
                <div className="panel-head"><h2>{t('ac.history')}</h2><span className="badge badge-gray">{orders.length}</span></div>
                <div className="panel-body">
                  {loadingOrders ? <div className="loading-center"><span className="spinner" /></div> : orders.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon"><Package size={30} /></div>
                      <h3>{t('ac.noOrders')}</h3><p>{t('ac.noOrdersDesc')}</p>
                      <Link to="/shop" className="btn btn-primary btn-sm">{t('cart.start')}</Link></div>
                  ) : (
                    <div className="order-table-wrap"><table className="data-table">
                      <thead><tr><th>{t('suc.code')}</th><th>{t('ad.product')}</th><th>{t('c.date')}</th><th>{t('c.status')}</th><th className="text-right">{t('c.total')}</th></tr></thead>
                      <tbody>{orders.map((o) => (
                        <tr key={o.code}>
                          <td><Link to={`/track?code=${o.code}`} style={{ color: '#c4b5fd', fontWeight: 700 }}>{o.code}</Link></td>
                          <td><div className="table-product"><div><strong>{o.items[0]?.productName}</strong><small>{o.items[0]?.packageLabel} × {o.items[0]?.qty}</small></div></div></td>
                          <td className="small text-dim nowrap">{dateShort(o.createdAt, lang)}</td>
                          <td><StatusBadge status={o.status} /></td>
                          <td className="text-right fw-700">{usd(o.total)}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                  )}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- wallet */}
            {tab === 'wallet' && (
              <div className="panel">
                <div className="panel-head"><h2><WalletIcon size={18} /> {t('nav.wallet')}</h2></div>
                <div className="panel-body">
                  <div className="row between gap-20 wrap" style={{ padding: '8px 0 18px' }}>
                    <div><div className="tiny text-dim">{t('ac.balance')}</div>
                      <div className="fw-800 gradient-text" style={{ fontSize: '2.6rem', lineHeight: 1.2 }}>{usd(user.balance || 0)}</div></div>
                    <button className="btn btn-primary" onClick={() => setTopupOpen(true)}><Plus size={16} /> {t('ac.addFunds')}</button>
                  </div>
                  <div className="divider" />
                  <h3 style={{ fontSize: '.95rem', margin: '20px 0 12px' }}>{t('ac.topupAmount')}</h3>
                  <div className="wallet-actions">
                    {[5, 10, 20, 50, 100].map((a) => (
                      <button className="btn btn-outline btn-sm" key={a} disabled={busy} onClick={() => doTopup(a)}>${a}</button>
                    ))}
                  </div>
                  <div className="alert alert-warn" style={{ marginTop: 20 }}><Info size={15} /> {t('ac.demoTopup')}</div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------ settings */}
            {tab === 'settings' && (
              <div className="stack gap-20">
                <form className="panel" onSubmit={saveProfile}>
                  <div className="panel-head"><h2>{t('ac.profile')}</h2></div>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="form-group"><label className="field-label">{t('au.name')}</label>
                        <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
                      <div className="form-group"><label className="field-label">{t('au.phone')}</label>
                        <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
                      <div className="form-group"><label className="field-label">{t('au.email')}</label>
                        <input className="input" value={user.email} disabled /></div>
                      <div className="form-group"><label className="field-label">Telegram</label>
                        <input className="input" value={profile.telegram} onChange={(e) => setProfile({ ...profile, telegram: e.target.value })} placeholder="@username" /></div>
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 18 }} disabled={busy}><Save size={15} /> {t('c.save')}</button>
                  </div>
                </form>
                <form className="panel" onSubmit={changePass}>
                  <div className="panel-head"><h2>{t('au.changePass')}</h2></div>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="form-group"><label className="field-label">{t('au.current')}</label>
                        <input className="input" type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></div>
                      <div className="form-group"><label className="field-label">{t('au.newPass')}</label>
                        <input className="input" type="password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} /></div>
                    </div>
                    <button className="btn btn-outline btn-sm" style={{ marginTop: 18 }} disabled={busy}><LockKeyhole size={15} /> {t('au.changePass')}</button>
                    {msg && <div className="alert alert-info" style={{ marginTop: 14 }}><Info size={14} /> {msg}</div>}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {topupOpen && (
        <div className="modal-overlay" onClick={() => setTopupOpen(false)}>
          <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>{t('ac.addFunds')}</h3><button className="icon-btn" onClick={() => setTopupOpen(false)}>✕</button></div>
            <div className="modal-body">
              <p className="small">{t('ac.topupAmount')}</p>
              <div className="grid g2" style={{ gap: 10 }}>
                {[5, 10, 20, 50, 100].map((a) => (
                  <button className="btn btn-outline" key={a} disabled={busy} onClick={() => doTopup(a)}>+ ${a}</button>
                ))}
              </div>
              <div className="alert alert-warn"><Info size={14} /> {t('ac.demoTopup')}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
