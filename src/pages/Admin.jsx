import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, Ticket, Users, Inbox, Settings,
  ArrowUpRight, TrendingUp, DollarSign, Clock3, CheckCircle2, Plus, Search,
  X, Save, Trash2, Eye, ShieldCheck, Sparkles, ExternalLink, Loader2,
  AlertTriangle, Mail, Send, Percent, Edit3, RefreshCw,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api, qs } from '../lib/api.js';
import { usd, dateShort, compact, statusTone } from '../lib/format.js';
import Icon, { ICONS } from '../components/Icon.jsx';
import { ProductArt, StatusBadge } from '../components/ui.jsx';

const TABS = [
  { id: 'overview', key: 'ad.overview', icon: LayoutDashboard },
  { id: 'orders', key: 'ad.orders', icon: ShoppingBag },
  { id: 'products', key: 'ad.products', icon: Package },
  { id: 'promos', key: 'ad.promos', icon: Ticket },
  { id: 'users', key: 'ad.users', icon: Users },
  { id: 'messages', key: 'ad.messages', icon: Inbox },
  { id: 'settings', key: 'ad.settings', icon: Settings },
];

const EMPTY_PRODUCT = {
  name: '', slug: '', category: 'games', icon: 'Gamepad2', colors: ['#8b5cf6', '#4f46e5'],
  currency: 'units', tag: '', featured: false, popular: false, requiresId: 'player',
  idPlaceholder: '123456789', basePrice: 1,
  descKh: '', descEn: '',
};

export default function Admin() {
  const { t, L, lang, user, authLoading, notify, boot, loadBoot } = useStore();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [promos, setPromos] = useState([]);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productModal, setProductModal] = useState(null);
  const [promoModal, setPromoModal] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (which) => {
    setLoading(true);
    try {
      if (which === 'overview') {
        setOverview((await api.get('/admin/overview')).data);
        setIntegrations((await api.get('/admin/integrations')).data);
      }
      if (which === 'orders') setOrders((await api.get(`/admin/orders${qs({ q: orderSearch, status: statusFilter })}`)).data);
      if (which === 'products') setProducts((await api.get('/admin/products')).data);
      if (which === 'promos') setPromos((await api.get('/admin/promos')).data);
      if (which === 'users') setUsers((await api.get('/admin/users')).data);
      if (which === 'messages') setMessages((await api.get('/admin/messages')).data);
      if (which === 'settings') {
        const s = (await api.get('/settings')).data;
        setSettingsForm({
          announcementKh: s.announcement?.kh || '', announcementEn: s.announcement?.en || '',
          phone: s.phone || '', telegram: s.telegram || '', email: s.email || '',
          exchangeRate: s.exchangeRate || 4100,
        });
      }
    } catch (err) { notify(err.message, 'error'); }
    finally { setLoading(false); }
  }, [orderSearch, statusFilter, notify]);

  useEffect(() => { if (user?.role === 'admin') load(tab); }, [tab, user?.role, load]);

  useEffect(() => {
    if (tab !== 'orders' || user?.role !== 'admin') return;
    const timer = setTimeout(() => load('orders'), 350);
    return () => clearTimeout(timer);
  }, [orderSearch, statusFilter, tab, user?.role, load]);

  const changeStatus = async (code, status) => {
    try {
      await api.put(`/admin/orders/${code}`, { status });
      notify(t('ad.saved'), 'success');
      load('orders');
    } catch (err) { notify(err.message, 'error'); }
  };

  const retryDelivery = async (code) => {
    try {
      const r = await api.post(`/admin/orders/${code}/retry`, {});
      notify(r.data?.status === 'completed' ? t('pay.done') : t('ad.saved'), 'success');
      load('orders');
    } catch (err) { notify(err.message, 'error'); }
  };

  const confirmPayment = async (code) => {
    if (!window.confirm(t('ad.confirmPayment') + '?')) return;
    try {
      await api.post(`/admin/orders/${code}/confirm-payment`, { note: 'Manually confirmed in admin' });
      notify(t('ad.saved'), 'success');
      load('orders');
    } catch (err) { notify(err.message, 'error'); }
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(t('ad.confirmDelete'))) return;
    try { await api.del(`/admin/products/${p.id}`); notify(t('ad.saved'), 'success'); load('products'); loadBoot(); }
    catch (err) { notify(err.message, 'error'); }
  };

  const deletePromo = async (p) => {
    if (!window.confirm(t('ad.confirmDelete'))) return;
    try { await api.del(`/admin/promos/${p.code}`); notify(t('ad.saved'), 'success'); load('promos'); }
    catch (err) { notify(err.message, 'error'); }
  };

  const togglePromo = async (p) => {
    try { await api.put(`/admin/promos/${p.code}`, { active: !p.active }); load('promos'); }
    catch (err) { notify(err.message, 'error'); }
  };

  const toggleFeatured = async (p) => {
    try { await api.put(`/admin/products/${p.id}`, { featured: !p.featured }); load('products'); loadBoot(); }
    catch (err) { notify(err.message, 'error'); }
  };

  const saveProduct = async (e) => {
    e.preventDefault(); setBusy(true);
    const f = productModal;
    const payload = {
      name: f.name, slug: f.slug, category: f.category, icon: f.icon, colors: f.colors,
      currency: f.currency, tag: f.tag || null, featured: !!f.featured, popular: !!f.popular,
      requiresId: f.requiresId, idPlaceholder: f.idPlaceholder,
      idLabel: { kh: 'លេខសម្គាល់អ្នកលេង (Player ID)', en: 'Player ID' },
      desc: { kh: f.descKh, en: f.descEn },
      instructions: { kh: ['ជ្រើសរើសកញ្ចប់', 'បញ្ចូលលេខគណនី', 'បង់ប្រាក់', 'ទទួលឥណទានភ្លាមៗ'], en: ['Choose a package', 'Enter your account ID', 'Pay', 'Receive credits instantly'] },
      packages: [
        { id: 'small', label: `Small · ${f.currency}`, price: Number(f.basePrice) || 1, oldPrice: null, bonus: null, popular: false },
        { id: 'medium', label: `Medium · ${f.currency}`, price: +((Number(f.basePrice) || 1) * 2.4).toFixed(2), oldPrice: null, bonus: null, popular: true },
        { id: 'large', label: `Large · ${f.currency}`, price: +((Number(f.basePrice) || 1) * 4.8).toFixed(2), oldPrice: null, bonus: null, popular: false },
      ],
    };
    try {
      if (f.id) await api.put(`/admin/products/${f.id}`, payload);
      else await api.post('/admin/products', payload);
      notify(t('ad.saved'), 'success'); setProductModal(null); load('products'); loadBoot();
    } catch (err) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const savePromo = async (e) => {
    e.preventDefault(); setBusy(true);
    const f = promoModal;
    const payload = {
      code: f.code.toUpperCase(), type: f.type, value: Number(f.value),
      minOrder: Number(f.minOrder), maxUses: Number(f.maxUses), active: f.active !== false,
      note: { kh: f.note, en: f.note },
    };
    try {
      if (f.original) await api.put(`/admin/promos/${f.original}`, payload);
      else await api.post('/admin/promos', payload);
      notify(t('ad.saved'), 'success'); setPromoModal(null); load('promos');
    } catch (err) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const saveSettings = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.put('/admin/settings', {
        announcement: { kh: settingsForm.announcementKh, en: settingsForm.announcementEn },
        phone: settingsForm.phone, telegram: settingsForm.telegram, email: settingsForm.email,
        exchangeRate: Number(settingsForm.exchangeRate),
      });
      notify(t('ad.saved'), 'success'); loadBoot();
    } catch (err) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const markRead = async (m) => {
    try { await api.put(`/admin/messages/${m.id}`, { read: true }); load('messages'); }
    catch (err) { notify(err.message, 'error'); }
  };

  if (authLoading) return <div className="loading-center"><span className="spinner" /> {t('c.loading')}</div>;
  if (!user) return (
    <div className="container" style={{ padding: '80px 0' }}>
      <div className="empty-state card"><div className="empty-icon"><ShieldCheck size={32} /></div>
        <h3>{t('ad.loginAsAdmin')}</h3><Link to="/login" className="btn btn-primary btn-sm">{t('nav.login')}</Link></div>
    </div>
  );
  if (user.role !== 'admin') return (
    <div className="container" style={{ padding: '80px 0' }}>
      <div className="empty-state card"><div className="empty-icon" style={{ color: '#fda4af' }}><AlertTriangle size={32} /></div>
        <h3>{t('ad.accessDenied')}</h3><Link to="/" className="btn btn-primary btn-sm">{t('c.goHome')}</Link></div>
    </div>
  );

  const stats = overview?.stats || {};
  const maxRevenue = Math.max(1, ...(overview?.chart || []).map((d) => d.revenue));
  const unread = messages.filter((m) => !m.read).length;

  const renderOverview = () => (
    <div className="stack gap-20">
      <div className="admin-stat-grid">
        {[
          { label: t('ad.revenue'), value: usd(stats.revenue || 0), icon: DollarSign, color: '#a78bfa', glow: 'rgba(139,92,246,.2)', trend: '+12.4%' },
          { label: t('ad.orders'), value: stats.orders || 0, icon: ShoppingBag, color: '#67e8f9', glow: 'rgba(34,211,238,.18)', trend: `${stats.thisMonth || 0} ${lang === 'kh' ? 'ខែនេះ' : 'this month'}` },
          { label: t('ad.avgOrder'), value: usd(stats.avgOrder || 0), icon: TrendingUp, color: '#6ee7b7', glow: 'rgba(52,211,153,.18)', trend: '+5.2%' },
          { label: t('ad.pending'), value: (stats.pending || 0) + (stats.processing || 0), icon: Clock3, color: '#fcd34d', glow: 'rgba(251,191,36,.18)', trend: `${stats.completed || 0} ${t('ad.completed')}` },
        ].map((s, i) => (
          <div className="admin-stat" key={i} style={{ '--stat-glow': s.glow }}>
            <div className="as-top"><span className="as-icon" style={{ background: `${s.color}22`, color: s.color }}><s.icon size={19} /></span>
              <span className="as-trend"><ArrowUpRight size={12} /> {s.trend}</span></div>
            <div className="as-value">{s.value}</div><small>{s.label}</small>
          </div>
        ))}
      </div>

      {integrations && (
        <div className="panel integration-panel">
          <div className="panel-head">
            <h2 style={{ fontSize: '1rem' }}><ShieldCheck size={17} /> {t('ad.integrations')}</h2>
            <span className={`badge ${integrations.live ? (integrations.ready ? 'badge-green' : 'badge-red') : 'badge-violet'}`}>
              {integrations.live
                ? (integrations.ready ? t('ad.liveReady') : `LIVE · ${integrations.blockers.length} ${t('ad.liveBlockers')}`)
                : 'SANDBOX'}
            </span>
          </div>
          <div className="panel-body">
            <div className="integration-grid">
              {Object.entries(integrations.checks).map(([k, ok]) => (
                <div className={`integration-check ${ok ? 'on' : 'off'}`} key={k}>
                  {ok ? <CheckCircle2 size={14} /> : <X size={14} />} <span>{k}</span>
                </div>
              ))}
            </div>
            {integrations.blockers?.length > 0 && (
              <div className="alert alert-error" style={{ marginTop: 14 }}>
                <AlertTriangle size={15} /> {t('ad.liveBlockers')}: {integrations.blockers.join(', ')}
              </div>
            )}
            <div className="row gap-16 wrap" style={{ marginTop: 14 }}>
              <span className="small text-dim">{t('ad.awaiting')}: <strong>{integrations.ordersAwaitingPayment}</strong></span>
              <span className="small" style={{ color: integrations.ordersFailedDelivery ? '#fda4af' : undefined }}>
                {t('ad.failedDelivery')}: <strong>{integrations.ordersFailedDelivery}</strong>
              </span>
              <span className="small text-dim">KHQR TTL: <strong>{integrations.qrTtlMinutes} min</strong></span>
            </div>
            {integrations.recentSecurityEvents?.length > 0 && (
              <details className="security-events">
                <summary>{t('ad.securityEvents')} ({integrations.recentSecurityEvents.length})</summary>
                {integrations.recentSecurityEvents.map((e) => (
                  <div className="tiny" key={e.id}>[{e.level}] {dateShort(e.at, lang)} — {e.message}</div>
                ))}
              </details>
            )}
          </div>
        </div>
      )}

      <div className="admin-charts">
        <div className="chart-card">
          <h3>{t('ad.chart')}</h3><p>{t('ad.revenue')} (USD)</p>
          <div className="bar-chart">
            {(overview?.chart || []).map((d, i) => (
              <div className="bar-col" key={i}>
                <div className="bar" style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}>
                  <span className="bar-tip">{usd(d.revenue)}</span>
                </div>
                <span className="bar-label">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-card">
          <h3>{t('ad.categories')}</h3><p>{t('ad.revenue')} · {t('ad.orders')}</p>
          <div className="cat-bars">
            {(overview?.byCategory || []).map((c) => {
              const max = Math.max(1, ...(overview?.byCategory || []).map((x) => x.revenue));
              return (
                <div className="cat-bar-row" key={c.id}>
                  <div className="cb-top"><span>{L(c.name)}</span><span>{usd(c.revenue)} · {c.count}</span></div>
                  <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${(c.revenue / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="admin-charts" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><h2 style={{ fontSize: '1rem' }}>{t('ad.recent')}</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setTab('orders')}>{t('c.viewAll')} <ArrowUpRight size={14} /></button></div>
          <div className="order-table-wrap"><table className="data-table">
            <thead><tr><th>{t('suc.code')}</th><th>{t('ad.customer')}</th><th>{t('c.date')}</th><th>{t('c.status')}</th><th className="text-right">{t('ad.amount')}</th></tr></thead>
            <tbody>{(overview?.recent || []).slice(0, 6).map((o) => (
              <tr key={o.code}>
                <td><button onClick={() => { setTab('orders'); setOrderSearch(o.code); }} style={{ color: '#c4b5fd', fontWeight: 700 }}>{o.code}</button></td>
                <td><strong style={{ fontSize: '.8rem' }}>{o.customer.name}</strong><div className="tiny text-dim">{o.customer.phone}</div></td>
                <td className="small text-dim nowrap">{dateShort(o.createdAt, lang)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="text-right fw-700">{usd(o.total)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="chart-card">
          <h3>{t('ad.top')}</h3><p>{t('shop.sold')}</p>
          <div className="stack gap-12">
            {(overview?.topProducts || []).map((p, i) => (
              <div className="row gap-10" key={p.id}>
                <span className="tiny text-dim" style={{ width: 14 }}>{i + 1}.</span>
                <ProductArt className="tp-art" product={p} compact />
                <div className="grow" style={{ minWidth: 0 }}><strong style={{ fontSize: '.79rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</strong>
                  <small className="text-dim">{compact(p.sold)} {t('shop.sold')}</small></div>
                <strong className="small">{usd(p.revenue)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="panel">
      <div className="panel-head"><h2>{t('ad.orders')}</h2><span className="badge badge-violet">{orders.length}</span></div>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="admin-toolbar" style={{ marginBottom: 0 }}>
          <div className="search-box"><span className="field-icon"><Search size={16} /></span>
            <input className="input with-icon" placeholder={t('ad.searchOrders')} value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} /></div>
          <select className="select" style={{ width: 'auto', minWidth: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('c.all')}</option>
            <option value="pending">{t('st.pending')}</option>
            <option value="paid">{t('st.paid')}</option>
            <option value="processing">{t('st.processing')}</option>
            <option value="delivery_failed">{t('st.delivery_failed')}</option>
            <option value="completed">{t('st.completed')}</option>
            <option value="cancelled">{t('st.cancelled')}</option>
          </select>
        </div>
      </div>
      <div className="order-table-wrap"><table className="data-table">
        <thead><tr><th>{t('suc.code')}</th><th>{t('ad.customer')}</th><th>{t('ad.product')}</th><th>{t('ad.method')}</th><th>{t('c.date')}</th><th className="text-right">{t('ad.amount')}</th><th>{t('c.status')}</th><th>{t('c.action')}</th></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o.code}>
            <td><Link to={`/track?code=${o.code}`} style={{ color: '#c4b5fd', fontWeight: 700 }}>{o.code}</Link></td>
            <td><strong style={{ fontSize: '.8rem' }}>{o.customer.name}</strong><div className="tiny text-dim">{o.customer.phone}</div></td>
            <td><div className="table-product"><ProductArt className="tp-art" product={o.items[0]} compact />
              <div><strong>{o.items[0]?.productName}</strong><small>{o.items[0]?.packageLabel} × {o.items[0]?.qty}</small></div></div></td>
            <td className="small text-dim nowrap">{o.payment.method.toUpperCase()}</td>
            <td className="small text-dim nowrap">{dateShort(o.createdAt, lang)}</td>
            <td className="text-right fw-700">{usd(o.total)}</td>
            <td>
              <select className="select" style={{ padding: '6px 28px 6px 9px', fontSize: '.74rem', minWidth: 120, backgroundPosition: 'right 7px center' }}
                value={o.status} onChange={(e) => changeStatus(o.code, e.target.value)}>
                <option value="pending">{t('st.pending')}</option>
                <option value="paid">{t('st.paid')}</option>
                <option value="processing">{t('st.processing')}</option>
                <option value="delivery_failed">{t('st.delivery_failed')}</option>
                <option value="completed">{t('st.completed')}</option>
                <option value="cancelled">{t('st.cancelled')}</option>
              </select>
            </td>
            <td>
              <div className="row gap-6 nowrap">
                {o.status === 'delivery_failed' && (
                  <button className="btn btn-primary btn-xs" onClick={() => retryDelivery(o.code)} title={t('ad.retry')}>
                    <RefreshCw size={11} /> {t('ad.retry')}
                  </button>
                )}
                {o.payment?.status !== 'paid' && o.status !== 'cancelled' && o.payment?.verification === 'manual' && (
                  <button className="btn btn-outline btn-xs" onClick={() => confirmPayment(o.code)} title={t('ad.confirmPayment')}>
                    <CheckCircle2 size={11} /> {t('ad.confirmPayment')}
                  </button>
                )}
                <Link to={`/pay/${o.code}`} className="btn btn-ghost btn-xs" title="KHQR"><Eye size={11} /></Link>
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      {orders.length === 0 && !loading && <div className="empty-state"><h3>{t('c.noResults')}</h3></div>}
    </div>
  );

  const renderProducts = () => (
    <div className="panel">
      <div className="panel-head"><h2>{t('ad.products')} <span className="badge badge-gray">{products.length}</span></h2>
        <button className="btn btn-primary btn-sm" onClick={() => setProductModal({ ...EMPTY_PRODUCT })}><Plus size={15} /> {t('ad.addProduct')}</button></div>
      <div className="order-table-wrap"><table className="data-table">
        <thead><tr><th>{t('ad.product')}</th><th>{t('ad.category')}</th><th>Packages</th><th>{t('ad.price')}</th><th>{t('shop.sold')}</th><th>{t('c.active')}</th><th>{t('c.action')}</th></tr></thead>
        <tbody>{products.map((p) => (
          <tr key={p.id}>
            <td><div className="table-product"><ProductArt className="tp-art" product={p} compact />
              <div><strong>{p.name}</strong><small>/{p.slug}</small></div></div></td>
            <td className="small text-dim">{L(boot.categories.find((c) => c.id === p.category)?.name) || p.category}</td>
            <td className="small">{p.packages?.length}</td>
            <td className="small fw-700">{usd(Math.min(...(p.packages || [{ price: 0 }]).map((x) => x.price)))}</td>
            <td className="small text-dim">{compact(p.sold)}</td>
            <td><button className={`badge ${p.featured ? 'badge-green' : 'badge-gray'}`} style={{ cursor: 'pointer' }} onClick={() => toggleFeatured(p)}>{p.featured ? 'Featured' : '—'}</button></td>
            <td><div className="row gap-6">
              <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setProductModal({
                ...EMPTY_PRODUCT, ...p, id: p.id, basePrice: Math.min(...(p.packages || [{ price: 1 }]).map((x) => x.price)),
                descKh: p.desc?.kh || '', descEn: p.desc?.en || '', tag: p.tag || '',
              })}><Edit3 size={13} /></button>
              <button className="icon-btn" style={{ width: 30, height: 30, color: '#fda4af' }} onClick={() => deleteProduct(p)}><Trash2 size={13} /></button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );

  const renderPromos = () => (
    <div className="panel">
      <div className="panel-head"><h2>{t('ad.promos')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setPromoModal({ code: '', type: 'percent', value: 10, minOrder: 5, maxUses: 100, active: true, note: '' })}><Plus size={15} /> {t('ad.addPromo')}</button></div>
      <div className="order-table-wrap"><table className="data-table">
        <thead><tr><th>{t('ad.code')}</th><th>{t('ad.type')}</th><th>{t('ad.value')}</th><th>{t('ad.minOrder')}</th><th>{t('ad.uses')}</th><th>{t('c.status')}</th><th>{t('c.action')}</th></tr></thead>
        <tbody>{promos.map((p) => (
          <tr key={p.code}>
            <td><strong style={{ color: '#c4b5fd', letterSpacing: '.05em' }}>{p.code}</strong></td>
            <td className="small">{p.type}</td>
            <td className="small fw-700">{p.type === 'percent' ? `${p.value}%` : usd(p.value)}</td>
            <td className="small">{usd(p.minOrder)}</td>
            <td className="small">{p.uses} / {p.maxUses}</td>
            <td><button className={`badge ${p.active ? 'badge-green' : 'badge-red'}`} style={{ cursor: 'pointer' }} onClick={() => togglePromo(p)}>{p.active ? t('c.active') : t('c.inactive')}</button></td>
            <td><div className="row gap-6">
              <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setPromoModal({ ...p, original: p.code, note: L(p.note) })}><Edit3 size={13} /></button>
              <button className="icon-btn" style={{ width: 30, height: 30, color: '#fda4af' }} onClick={() => deletePromo(p)}><Trash2 size={13} /></button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );

  const renderUsers = () => (
    <div className="panel">
      <div className="panel-head"><h2>{t('ad.users')}</h2><span className="badge badge-gray">{users.length}</span></div>
      <div className="order-table-wrap"><table className="data-table">
        <thead><tr><th>{t('ad.customer')}</th><th>Email / Phone</th><th>{t('ad.orders')}</th><th>{t('ac.spent')}</th><th>{t('ac.balance')}</th><th>{t('c.status')}</th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id}>
            <td><strong style={{ fontSize: '.82rem' }}>{u.name}</strong><div className="tiny text-dim">{dateShort(u.createdAt, lang)}</div></td>
            <td className="small">{u.email}<div className="tiny text-dim">{u.phone || '—'}</div></td>
            <td className="small">{u.orderCount}</td>
            <td className="small fw-700">{usd(u.spent)}</td>
            <td className="small">{usd(u.balance)}</td>
            <td><span className={`badge ${u.role === 'admin' ? 'badge-violet' : 'badge-green'}`}>{u.role}</span></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );

  const renderMessages = () => (
    <div className="panel">
      <div className="panel-head"><h2>{t('ad.messages')}</h2><span className="badge badge-gray">{messages.length}</span></div>
      <div className="panel-body">
        {messages.length === 0 ? <div className="empty-state"><div className="empty-icon"><Inbox size={30} /></div><h3>{t('ad.noMessages')}</h3></div> :
          messages.map((m) => (
            <div className="contact-info-card" key={m.id} style={{ background: m.read ? 'rgba(16,22,40,.7)' : 'rgba(139,92,246,.08)' }}>
              <span className="ci"><Mail size={19} /></span>
              <div className="grow"><strong>{m.subject} {!m.read && <span className="badge badge-violet" style={{ marginLeft: 6 }}>NEW</span>}</strong>
                <p>{m.body}</p><p className="tiny text-dim" style={{ marginTop: 6 }}>{m.name} · {m.email} · {dateShort(m.createdAt, lang)}</p></div>
              {!m.read && <button className="btn btn-outline btn-xs" onClick={() => markRead(m)}><Eye size={12} /> {t('c.confirm')}</button>}
            </div>
          ))}
      </div>
    </div>
  );

  const renderSettings = () => settingsForm && (
    <form className="panel" onSubmit={saveSettings}>
      <div className="panel-head"><h2>{t('ad.settings')}</h2></div>
      <div className="panel-body stack gap-20">
        <div>
          <h3 style={{ fontSize: '.95rem', marginBottom: 14 }}><Sparkles size={16} style={{ verticalAlign: -3, marginRight: 6 }} />{t('ad.announcement')}</h3>
          <div className="form-grid">
            <div className="form-group"><label className="field-label">ភាសាខ្មែរ</label>
              <input className="input" value={settingsForm.announcementKh} onChange={(e) => setSettingsForm({ ...settingsForm, announcementKh: e.target.value })} /></div>
            <div className="form-group"><label className="field-label">English</label>
              <input className="input" value={settingsForm.announcementEn} onChange={(e) => setSettingsForm({ ...settingsForm, announcementEn: e.target.value })} /></div>
          </div>
        </div>
        <div className="divider" />
        <div>
          <h3 style={{ fontSize: '.95rem', marginBottom: 14 }}>{t('ad.contactInfo')}</h3>
          <div className="form-grid">
            <div className="form-group"><label className="field-label">{t('ct.phone')}</label><input className="input" value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} /></div>
            <div className="form-group"><label className="field-label">Telegram</label><input className="input" value={settingsForm.telegram} onChange={(e) => setSettingsForm({ ...settingsForm, telegram: e.target.value })} /></div>
            <div className="form-group"><label className="field-label">{t('ct.email')}</label><input className="input" value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} /></div>
            <div className="form-group"><label className="field-label">{t('ad.exchangeRate')}</label><input className="input" type="number" value={settingsForm.exchangeRate} onChange={(e) => setSettingsForm({ ...settingsForm, exchangeRate: e.target.value })} /></div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} style={{ alignSelf: 'flex-start' }}><Save size={15} /> {t('c.save')}</button>
      </div>
    </form>
  );

  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="as-label">MENU</div>
        {TABS.map((tb) => (
          <button key={tb.id} className={tab === tb.id ? 'on' : ''} onClick={() => setTab(tb.id)}>
            <tb.icon size={17} /> {t(tb.key)}
            {tb.id === 'messages' && unread > 0 && <span className="cnt">{unread}</span>}
          </button>
        ))}
        <div className="as-label">SHORTCUTS</div>
        <Link to="/" className="btn btn-outline btn-sm" style={{ margin: '4px 8px' }}><ExternalLink size={14} /> {t('ad.viewSite')}</Link>
      </aside>

      <div className="admin-main">
        <div className="admin-top">
          <div><h1>{t(`ad.${tab === 'overview' ? 'title' : tab}`)}</h1>
            <p>{tab === 'overview' ? `${t('ad.overview')} · ${new Date().toLocaleDateString(lang === 'kh' ? 'km-KH' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : `VC TOPUP · ${t('nav.admin')}`}</p></div>
          <div className="row gap-8">
            {loading && <span className="small text-dim row gap-6"><Loader2 size={14} className="spinner" style={{ border: 0 }} /></span>}
            <button className="btn btn-outline btn-sm" onClick={() => load(tab)}>{t('c.retry')}</button>
            <Link to="/shop" className="btn btn-primary btn-sm"><Plus size={14} /> {t('ad.addProduct')}</Link>
          </div>
        </div>

        {tab === 'overview' && (overview ? renderOverview() : <div className="loading-center"><span className="spinner" /> {t('c.loading')}</div>)}
        {tab === 'orders' && renderOrders()}
        {tab === 'products' && renderProducts()}
        {tab === 'promos' && renderPromos()}
        {tab === 'users' && renderUsers()}
        {tab === 'messages' && renderMessages()}
        {tab === 'settings' && (settingsForm ? renderSettings() : <div className="loading-center"><span className="spinner" /> {t('c.loading')}</div>)}
      </div>

      {/* ------------------------------------------------------- product modal */}
      {productModal && (
        <div className="modal-overlay" onClick={() => setProductModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveProduct}>
            <div className="modal-head"><h3>{productModal.id ? t('ad.editProduct') : t('ad.addProduct')}</h3>
              <button type="button" className="icon-btn" onClick={() => setProductModal(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label className="field-label">{t('ad.name')} *</label>
                  <input className="input" required value={productModal.name} onChange={(e) => setProductModal({ ...productModal, name: e.target.value })} /></div>
                <div className="form-group"><label className="field-label">{t('ad.slug')}</label>
                  <input className="input" value={productModal.slug} placeholder="auto-generated" onChange={(e) => setProductModal({ ...productModal, slug: e.target.value })} /></div>
                <div className="form-group"><label className="field-label">{t('ad.category')}</label>
                  <select className="select" value={productModal.category} onChange={(e) => setProductModal({ ...productModal, category: e.target.value })}>
                    {boot.categories.map((c) => <option key={c.id} value={c.id}>{L(c.name)}</option>)}
                  </select></div>
                <div className="form-group"><label className="field-label">Icon</label>
                  <select className="select" value={productModal.icon} onChange={(e) => setProductModal({ ...productModal, icon: e.target.value })}>
                    {Object.keys(ICONS).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select></div>
                <div className="form-group"><label className="field-label">{t('p.currency')}</label>
                  <input className="input" value={productModal.currency} onChange={(e) => setProductModal({ ...productModal, currency: e.target.value })} placeholder="Diamonds" /></div>
                <div className="form-group"><label className="field-label">{t('ad.price')} (USD) *</label>
                  <input className="input" type="number" step="0.01" min="0.1" required value={productModal.basePrice} onChange={(e) => setProductModal({ ...productModal, basePrice: e.target.value })} /></div>
                <div className="form-group"><label className="field-label">Tag</label>
                  <select className="select" value={productModal.tag} onChange={(e) => setProductModal({ ...productModal, tag: e.target.value })}>
                    <option value="">—</option><option value="HOT">HOT</option><option value="NEW">NEW</option><option value="POPULAR">POPULAR</option>
                  </select></div>
                <div className="form-group"><label className="field-label">Account ID type</label>
                  <select className="select" value={productModal.requiresId} onChange={(e) => setProductModal({ ...productModal, requiresId: e.target.value })}>
                    <option value="player">Player ID</option><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option>
                  </select></div>
                <div className="form-group"><label className="field-label">Color A</label>
                  <input className="input" type="color" style={{ padding: 4, height: 44 }} value={productModal.colors[0]} onChange={(e) => setProductModal({ ...productModal, colors: [e.target.value, productModal.colors[1]] })} /></div>
                <div className="form-group"><label className="field-label">Color B</label>
                  <input className="input" type="color" style={{ padding: 4, height: 44 }} value={productModal.colors[1]} onChange={(e) => setProductModal({ ...productModal, colors: [productModal.colors[0], e.target.value] })} /></div>
              </div>
              <div className="form-group"><label className="field-label">Description (ខ្មែរ)</label>
                <textarea className="textarea" style={{ minHeight: 65 }} value={productModal.descKh} onChange={(e) => setProductModal({ ...productModal, descKh: e.target.value })} /></div>
              <div className="form-group"><label className="field-label">Description (English)</label>
                <textarea className="textarea" style={{ minHeight: 65 }} value={productModal.descEn} onChange={(e) => setProductModal({ ...productModal, descEn: e.target.value })} /></div>
              <label className="checkbox"><input type="checkbox" checked={!!productModal.featured} onChange={(e) => setProductModal({ ...productModal, featured: e.target.checked })} /> Featured on homepage</label>
              <div className="alert alert-info"><Icon name="CircleHelp" size={14} /> 3 packages will be generated from the base price (×1, ×2.4, ×4.8).</div>
            </div>
            <div className="modal-foot"><button type="button" className="btn btn-outline btn-sm" onClick={() => setProductModal(null)}>{t('c.cancel')}</button>
              <button className="btn btn-primary btn-sm" disabled={busy}><Save size={14} /> {t('c.save')}</button></div>
          </form>
        </div>
      )}

      {/* --------------------------------------------------------- promo modal */}
      {promoModal && (
        <div className="modal-overlay" onClick={() => setPromoModal(null)}>
          <form className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()} onSubmit={savePromo}>
            <div className="modal-head"><h3>{t('ad.addPromo')}</h3>
              <button type="button" className="icon-btn" onClick={() => setPromoModal(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div className="form-group"><label className="field-label">{t('ad.code')} *</label>
                <input className="input" required value={promoModal.code} disabled={!!promoModal.original} onChange={(e) => setPromoModal({ ...promoModal, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" /></div>
              <div className="form-grid">
                <div className="form-group"><label className="field-label">{t('ad.type')}</label>
                  <select className="select" value={promoModal.type} onChange={(e) => setPromoModal({ ...promoModal, type: e.target.value })}>
                    <option value="percent">Percent (%)</option><option value="fixed">Fixed ($)</option></select></div>
                <div className="form-group"><label className="field-label">{t('ad.value')}</label>
                  <input className="input" type="number" min="0" step="0.1" value={promoModal.value} onChange={(e) => setPromoModal({ ...promoModal, value: e.target.value })} /></div>
                <div className="form-group"><label className="field-label">{t('ad.minOrder')}</label>
                  <input className="input" type="number" min="0" step="0.5" value={promoModal.minOrder} onChange={(e) => setPromoModal({ ...promoModal, minOrder: e.target.value })} /></div>
                <div className="form-group"><label className="field-label">Max uses</label>
                  <input className="input" type="number" min="1" value={promoModal.maxUses} onChange={(e) => setPromoModal({ ...promoModal, maxUses: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="field-label">Note</label>
                <input className="input" value={promoModal.note} onChange={(e) => setPromoModal({ ...promoModal, note: e.target.value })} /></div>
              <label className="checkbox"><input type="checkbox" checked={promoModal.active !== false} onChange={(e) => setPromoModal({ ...promoModal, active: e.target.checked })} /> {t('c.active')}</label>
            </div>
            <div className="modal-foot"><button type="button" className="btn btn-outline btn-sm" onClick={() => setPromoModal(null)}>{t('c.cancel')}</button>
              <button className="btn btn-primary btn-sm" disabled={busy}><Save size={14} /> {t('c.save')}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
