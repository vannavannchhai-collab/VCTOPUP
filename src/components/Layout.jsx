import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Zap, ShoppingCart, Menu, X, Globe, ChevronRight, ArrowRight, Send, Mail,
  Phone, MapPin, ShieldCheck, CheckCircle2,
  AlertTriangle, Info, ArrowUp, Trash2, Plus, Minus, User, LogOut,
  LayoutDashboard, Package, Headphones, Sparkles, Gift, Gamepad2,
  CreditCard, Smartphone, Clapperboard, MessageCircle,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { usd, khr, initials } from '../lib/format.js';
import { ProductArt } from './ui.jsx';

/* ------------------------------------------------------------------ header */
function Header() {
  const { t, L, lang, setLang, cartCount, setCartOpen, settings, user, logout, notify, boot } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTopbar, setShowTopbar] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const nav = [
    { to: '/', key: 'nav.home', end: true },
    { to: '/shop', key: 'nav.shop' },
    { to: '/#how', key: 'nav.how' },
    { to: '/track', key: 'nav.track' },
    { to: '/about', key: 'nav.about' },
    { to: '/contact', key: 'nav.contact' },
  ];

  const handleLogout = () => {
    logout(); notify(lang === 'kh' ? 'បានចាកចេញពីគណនី' : 'Signed out', 'info');
    navigate('/');
  };

  return (
    <>
      {showTopbar && L(settings.announcement) && (
        <div className="topbar">
          <div className="topbar-inner">
            <span>{L(settings.announcement)}</span>
            <button className="topbar-close" onClick={() => setShowTopbar(false)} aria-label="close"><X size={15} /></button>
          </div>
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="VC TOPUP home">
            <span className="brand-mark"><Zap size={22} fill="currentColor" /></span>
            <span className="brand-text"><strong>VC<em>TOPUP</em></strong><small>GAME CREDIT STORE</small></span>
          </Link>

          <nav className="main-nav">
            {nav.map((n) => (
              <NavLink key={n.key} to={n.to} end={n.end}
                className={({ isActive }) => isActive && !n.to.includes('#') ? 'active' : ''}>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <div className="lang-toggle" title={t('nav.language')}>
              <button className={lang === 'kh' ? 'on' : ''} onClick={() => setLang('kh')}>ខ្មែរ</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <button className="icon-btn cart-btn" onClick={() => setCartOpen(true)} aria-label={t('nav.cart')}>
              <ShoppingCart size={18} />
              {cartCount > 0 && <span className="cart-count">{cartCount > 99 ? '99+' : cartCount}</span>}
            </button>
            {user ? (
              <Link to="/account" className="header-account">
                <span className="avatar">{initials(user.name)}</span>
                <span className="name">{user.name.split(' ')[0]}</span>
              </Link>
            ) : (
              <Link to="/login" className="btn btn-outline btn-sm" style={{ height: 38 }}>{t('nav.login')}</Link>
            )}
            {boot.productCount > 0 && <Link to="/shop" className="btn btn-primary btn-sm header-cta" style={{ height: 38 }}>
              <Zap size={14} fill="currentColor" /> {t('hero.cta')}
            </Link>}
            <button className="icon-btn mobile-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label={t('nav.menu')}>
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav">
          {nav.map((n) => (
            <NavLink key={n.key} to={n.to} className={({ isActive }) => isActive && !n.to.includes('#') ? 'active' : ''}>
              <ChevronRight size={17} /> {t(n.key)}
            </NavLink>
          ))}
          <div className="mn-divider" />
          {user ? (
            <>
              <Link to="/account"><User size={17} /> {t('nav.account')}</Link>
              {user.role === 'admin' && <Link to="/admin"><LayoutDashboard size={17} /> {t('nav.admin')}</Link>}
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', color: '#fda4af' }}>
                <LogOut size={17} /> {t('nav.logout')}
              </button>
            </>
          ) : (
            <div className="mn-actions">
              <Link to="/login" className="btn btn-outline grow">{t('nav.login')}</Link>
              <Link to="/login?tab=register" className="btn btn-primary grow">{t('nav.register')}</Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ cart drawer */
function CartDrawer() {
  const { t, cartOpen, setCartOpen, cart, removeFromCart, updateQty, clearCart, cartSubtotal, promo, rate } = useStore();
  const navigate = useNavigate();
  if (!cartOpen) return null;
  const discount = promo ? (promo.type === 'percent' ? cartSubtotal * promo.value / 100 : Math.min(promo.value, cartSubtotal)) : 0;
  const total = Math.max(0, cartSubtotal - discount);
  return (
    <>
      <div className="drawer-overlay" onClick={() => setCartOpen(false)} />
      <aside className="cart-drawer">
        <div className="drawer-head">
          <h3><ShoppingCart size={19} /> {t('cart.title')} <span className="badge badge-violet">{cart.length}</span></h3>
          <button className="icon-btn" onClick={() => setCartOpen(false)}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: '50px 10px' }}>
              <div className="empty-icon"><ShoppingCart size={34} /></div>
              <h3>{t('cart.empty')}</h3>
              <p>{t('cart.emptyDesc')}</p>
              <button className="btn btn-primary btn-sm" onClick={() => { setCartOpen(false); navigate('/shop'); }}>
                {t('cart.start')} <ArrowRight size={15} />
              </button>
            </div>
          ) : cart.map((item) => (
            <div className="cart-line" key={item.key}>
              <ProductArt className="mini-art" product={item} compact />
              <div className="grow" style={{ minWidth: 0 }}>
                <h4>{item.productName}</h4>
                <div className="cl-sub">{item.packageLabel} · {usd(item.price)}</div>
                {item.accountId && <div className="cl-account">{t('cart.account')} {item.accountId}</div>}
                <div className="cl-bottom">
                  <div className="qty-control">
                    <button onClick={() => updateQty(item.key, item.qty - 1)}><Minus size={11} /></button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateQty(item.key, item.qty + 1)}><Plus size={11} /></button>
                  </div>
                  <strong style={{ fontSize: '.85rem' }}>{usd(item.price * item.qty)}</strong>
                </div>
              </div>
              <button className="icon-btn" style={{ width: 26, height: 26, alignSelf: 'flex-start' }}
                onClick={() => removeFromCart(item.key)} aria-label="remove"><X size={13} /></button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="drawer-foot">
            {promo && <div className="summary-row" style={{ color: '#6ee7b7' }}><span>{t('c.discount')} ({promo.code})</span><span>-{usd(discount)}</span></div>}
            <div className="summary-row total"><span>{t('c.total')}</span><span>{usd(total)} {rate && <span className="tiny text-dim" style={{ fontWeight: 400 }}>≈ {khr(total, rate)}</span>}</span></div>
            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }}
              onClick={() => { setCartOpen(false); navigate('/checkout'); }}>
              {t('cart.checkout')} <ArrowRight size={17} />
            </button>
            <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8 }} onClick={clearCart}>
              <Trash2 size={13} /> {t('cart.clear')}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ toasts */
function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const I = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertTriangle : Info;
        return (
          <div key={toast.id} className={`toast ${toast.type}`} onClick={() => dismissToast(toast.id)}>
            <span className="ti"><I size={15} /></span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <X size={13} style={{ opacity: .5 }} />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ footer */
function Footer() {
  const { t, settings, boot } = useStore();
  const contacts = [
    settings.phone && <a key="phone" className="row gap-8" href={`tel:${settings.phone}`}><Phone size={13} /> {settings.phone}</a>,
    settings.email && <a key="email" className="row gap-8" href={`mailto:${settings.email}`}><Mail size={13} /> {settings.email}</a>,
    settings.telegram && <a key="telegram" className="row gap-8" href={/^https?:/.test(settings.telegram) ? settings.telegram : `https://t.me/${String(settings.telegram).replace(/^@/, '')}`} target="_blank" rel="noreferrer"><Send size={13} /> {settings.telegram}</a>,
  ].filter(Boolean);
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand"><span className="brand-mark"><Zap size={21} fill="currentColor" /></span>
            <span className="brand-text"><strong>VC<em>TOPUP</em></strong><small>GAME CREDIT STORE</small></span></Link>
          <p>{t('ft.desc')}</p>
        </div>
        <div className="footer-col">
          <h4>{t('ft.shop')}</h4>
          <ul>
            <li><Link to="/shop">{t('c.all')} {t('shop.products')}</Link></li>
            <li><Link to="/shop?category=games">{t('nav.shop')} — Games</Link></li>
            <li><Link to="/shop?category=mobile">Mobile Top Up</Link></li>
            <li><Link to="/shop?category=giftcard">Gift Cards</Link></li>
            <li><Link to="/shop?category=streaming">Streaming</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>{t('ft.support')}</h4>
          <ul>
            <li><Link to="/track">{t('nav.track')}</Link></li>
            <li><Link to="/#faq">{t('s.faq')}</Link></li>
            <li><Link to="/contact">{t('nav.contact')}</Link></li>
            <li><Link to="/about">{t('nav.about')}</Link></li>
          </ul>
        </div>
        {contacts.length > 0 && <div className="footer-col">
          <h4>{t('nav.contact')}</h4>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.78rem', color: 'var(--muted)' }}>{contacts}</div>
        </div>}
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} VC TOPUP. {t('ft.rights')}</span>
        <div className="footer-badges">
          <span className="fb"><ShieldCheck size={12} /> {t('ft.secure')}</span>
          {boot.payment?.live && boot.payment?.ready && <span className="fb"><CreditCard size={12} /> Bakong KHQR</span>}
          {boot.payment?.live && boot.payment?.ready && <span className="fb"><CheckCircle2 size={12} /> {t('live.providerDelivery')}</span>}
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------- back to top */
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="top"><ArrowUp size={17} /></button>;
}

export default function Layout({ children }) {
  return (
    <>
      <Header />
      <main style={{ minHeight: '60vh' }}>{children}</main>
      <Footer />
      <CartDrawer />
      <Toasts />
      <BackToTop />
    </>
  );
}
