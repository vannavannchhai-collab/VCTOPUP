import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Settings, LogOut, TrendingUp, ArrowRight, Info, ShieldCheck,
  LockKeyhole, Save, Eye, Package,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { usd, dateShort, initials } from '../lib/format.js';
import { PageHead, StatusBadge } from '../components/ui.jsx';

const TABS = [
  { id: 'overview', key: 'ad.overview', icon: LayoutDashboard },
  { id: 'orders', key: 'nav.orders', icon: ShoppingBag },
  { id: 'settings', key: 'nav.settings', icon: Settings },
];

export default function Account() {
  const { t, user, authLoading, refreshUser, logout, notify, lang, rate } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'overview');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
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
            <p>{user.email || (user.authProvider === 'telegram' ? 'Telegram' : 'Google')} · {t('ac.member')} {dateShort(user.createdAt, lang)}</p>
          </div>
          {user.role === 'admin' && <Link to="/admin" className="btn btn-outline btn-sm"><ShieldCheck size={15} /> {t('nav.admin')}</Link>}
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); notify(t('nav.logout'), 'info'); }}><LogOut size={15} /> {t('nav.logout')}</button>
        </div>

        <div className="account-stats real-account-stats">
          <div className="account-stat"><span className="as-icon" style={{ background: 'rgba(34,211,238,.14)', color: '#67e8f9' }}><ShoppingBag size={19} /></span>
            <div className="as-value">{orders.filter((o) => o.payment?.status === 'paid').length}</div><small>{t('ac.orders')}</small></div>
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
                        <input className="input" value={user.email || (user.authProvider === 'telegram' ? 'Telegram account' : '—')} disabled /></div>
                      <div className="form-group"><label className="field-label">Telegram</label>
                        <input className="input" value={profile.telegram} onChange={(e) => setProfile({ ...profile, telegram: e.target.value })} placeholder="@username" /></div>
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 18 }} disabled={busy}><Save size={15} /> {t('c.save')}</button>
                  </div>
                </form>
                {user.authProvider === 'password' && <form className="panel" onSubmit={changePass}>
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
                </form>}
              </div>
            )}
          </div>
        </div>
      </div>


    </>
  );
}
