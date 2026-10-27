import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, ArrowRight, ShieldCheck, Clock3, BadgePercent, Headphones, Star,
  CheckCircle2, ChevronDown, Sparkles, Gamepad2, Timer, LockKeyhole, Gift,
  TrendingUp, Users, Play, Quote, HelpCircle, Send, Smartphone, Wallet,
  CreditCard, Landmark, Building2, Gem, Copy, Check, Flame, Crown,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { compact } from '../lib/format.js';
import ProductCard from '../components/ProductCard.jsx';
import Icon from '../components/Icon.jsx';
import { SectionHead, Stars, Reveal, CopyButton } from '../components/ui.jsx';
import { ProductArt } from '../components/ui.jsx';

const HOW_ICONS = [Gamepad2, Gift, Smartphone, Zap];
const WHY_ICONS = [Timer, BadgePercent, Crown, Headphones];
const TRUST_ICONS = [Timer, ShieldCheck, BadgePercent, Headphones];

function Hero() {
  const { t, settings } = useStore();
  const s = settings.stats || {};
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="hero-badge animate-fade-up"><span className="dot"><Zap size={12} fill="currentColor" /></span>{t('hero.badge')}</div>
          <h1 className="animate-fade-up" style={{ animationDelay: '.06s' }}>
            <span className="line">{t('hero.title1')}</span>
            <span className="line gradient-text">{t('hero.title2')}</span>
          </h1>
          <p className="hero-subtitle animate-fade-up" style={{ animationDelay: '.12s' }}>{t('hero.subtitle')}</p>
          <div className="hero-ctas animate-fade-up" style={{ animationDelay: '.18s' }}>
            <Link to="/shop" className="btn btn-primary btn-lg"><Zap size={18} fill="currentColor" /> {t('hero.cta')}</Link>
            <Link to="/#how" className="btn btn-outline btn-lg"><Play size={16} fill="currentColor" /> {t('hero.cta2')}</Link>
          </div>
          <div className="hero-stats animate-fade-up" style={{ animationDelay: '.24s' }}>
            <div className="hero-stat"><strong className="gradient-text">{compact(s.customers || 42900)}+</strong><small>{t('hero.stat1')}</small></div>
            <div className="hero-stat"><strong className="gradient-text">{compact(s.orders || 128450)}+</strong><small>{t('hero.stat2')}</small></div>
            <div className="hero-stat"><strong className="gradient-text">24/7</strong><small>{t('hero.stat3')}</small></div>
          </div>
        </div>
        <div className="hero-visual animate-fade-up" style={{ animationDelay: '.1s' }}>
          <div className="orb" />
          <div className="ring" />
          <img className="hero-gem" src="/img/hero-gem.webp" alt="VC TOPUP crystal" />
          <div className="hero-float f1">
            <span className="fi" style={{ background: 'rgba(52,211,153,.18)', color: '#6ee7b7' }}><CheckCircle2 size={17} /></span>
            <div><strong>{t('hero.float1')}</strong><small>MLBB · 706 Diamonds</small></div>
          </div>
          <div className="hero-float f2">
            <span className="fi" style={{ background: 'rgba(139,92,246,.2)', color: '#c4b5fd' }}><Timer size={17} /></span>
            <div><strong>{t('hero.float2')}</strong><small>{t('hero.float3')}</small></div>
          </div>
          <div className="hero-float f3">
            <span className="fi" style={{ background: 'rgba(34,211,238,.18)', color: '#67e8f9' }}><LockKeyhole size={16} /></span>
            <div><strong>100% Secure</strong><small>KHQR ·ABA · Wing</small></div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="trust-strip">
          {[1, 2, 3, 4].map((i) => {
            const I = TRUST_ICONS[i - 1];
            return (
              <div className="trust-item" key={i}>
                <span className="ti"><I size={20} /></span>
                <div><strong>{t(`trust.${i}`)}</strong><small>{t(`trust.${i}d`)}</small></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Categories({ products }) {
  const { t, L, boot } = useStore();
  const hexToRgba = (hex, a) => {
    const h = (hex || '#8b5cf6').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  return (
    <section className="section" id="categories" style={{ paddingBottom: 0 }}>
      <div className="container">
        <SectionHead eyebrow="EXPLORE" title={t('s.categories')} subtitle={t('s.categoriesSub')}
          action="/shop" actionText={t('c.viewAll')} />
        <div className="category-grid">
          {boot.categories.map((c, i) => {
            const count = products.filter((p) => p.category === c.id).length;
            return (
              <Link key={c.id} to={`/shop?category=${c.id}`} className="category-card reveal" style={{
                transitionDelay: `${i * 55}ms`,
                '--cat-glow': hexToRgba(c.colors[0], .28),
                '--cat-icon': hexToRgba(c.colors[0], .18),
                '--cat-color': c.colors[0],
                '--cat-border': hexToRgba(c.colors[0], .55),
              }}>
                <span className="cat-icon"><Icon name={c.icon} size={23} /></span>
                <div>
                  <strong>{L(c.name)}</strong>
                  <small>{count || ''} {t('shop.products')}</small>
                </div>
                <ArrowRight size={16} className="arrow" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useStore();
  return (
    <section className="section" id="how" style={{ background: 'linear-gradient(180deg, transparent, rgba(109,92,255,.045), transparent)' }}>
      <div className="container">
        <SectionHead eyebrow="SIMPLE STEPS" title={t('s.how')} subtitle={t('s.howSub')} />
        <div className="how-grid">
          {[1, 2, 3, 4].map((i) => {
            const I = HOW_ICONS[i - 1];
            return (
              <Reveal className="how-step" key={i} delay={i * 90}>
                <div className="num">{String(i).padStart(2, '0')}<span className="hide"><I /></span></div>
                <h3>{t(`how.${i}t`)}</h3>
                <p>{t(`how.${i}d`)}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PromoBanner() {
  const { t, notify } = useStore();
  return (
    <section className="section-tight">
      <div className="container">
        <Reveal className="promo-banner">
          <img className="coins" src="/img/promo-coins.webp" alt="" />
          <div className="promo-content">
            <div className="eyebrow"><Sparkles size={14} /> {t('promo.eyebrow')}</div>
            <h2>{t('promo.title')} <span className="gradient-text">VC10</span></h2>
            <p>{t('promo.desc')}</p>
            <div className="row gap-16 wrap">
              <CopyButton text="VC10" className="promo-code-btn" onCopied={() => notify(t('c.copied'), 'success')}>VC10</CopyButton>
              <span className="tiny text-dim">{t('promo.note')}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Payments() {
  const { t, L, boot } = useStore();
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="PAY YOUR WAY" title={t('s.payments')} subtitle={t('s.paymentsSub')} />
        <div className="pay-grid">
          {boot.paymentMethods.map((m, i) => (
            <Reveal className="pay-card" key={m.id} delay={i * 60}>
              <span className="pay-logo" style={{ background: `linear-gradient(140deg, ${m.colors[0]}, ${m.colors[1]})` }}>
                <Icon name={m.icon} size={23} />
              </span>
              <strong>{m.name}</strong>
              <small>{m.id === 'aba' || m.id === 'acleda' ? 'KHQR' : m.id === 'wallet' ? 'Instant' : 'E-Wallet'}</small>
            </Reveal>
          ))}
        </div>
        <div className="khqr-note"><ShieldCheck size={15} /> {t('ft.secure')} — ABA · ACLEDA · Wing · TrueMoney · VC Wallet</div>
      </div>
    </section>
  );
}

function WhyUs() {
  const { t } = useStore();
  return (
    <section className="section" style={{ background: 'linear-gradient(180deg, rgba(34,211,238,.035), transparent)' }}>
      <div className="container">
        <SectionHead eyebrow="WHY US" title={t('s.why')} subtitle={t('s.whySub')} />
        <div className="why-grid">
          {[1, 2, 3, 4].map((i) => {
            const I = WHY_ICONS[i - 1];
            return (
              <Reveal className="why-card" key={i} delay={i * 65}>
                <span className="wi"><I size={22} /></span>
                <h3>{t(`why.${i}t`)}</h3>
                <p>{t(`why.${i}d`)}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  const { t, L, boot } = useStore();
  if (!boot.reviews.length) return null;
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="TESTIMONIALS" title={t('s.reviews')} subtitle={t('s.reviewsSub')} />
        <div className="review-grid">
          {boot.reviews.map((r, i) => (
            <Reveal className="review-card" key={r.id} delay={i * 70}>
              <div className="row between">
                <Quote size={22} className="quote" />
                <Stars value={r.rating} />
              </div>
              <p>“{L(r.text)}”</p>
              <div className="reviewer">
                <span className="avatar" style={{ background: `linear-gradient(140deg, ${r.color}, ${r.color}88)` }}>{r.avatar}</span>
                <div><strong>{r.name}</strong><small>{L(r.role)}</small></div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { t, L, boot, settings } = useStore();
  const [open, setOpen] = useState(0);
  return (
    <section className="section" id="faq">
      <div className="container faq-wrap">
        <div className="faq-side">
          <div className="faq-icon"><HelpCircle size={27} /></div>
          <h2>{t('s.faq')}</h2>
          <p>{t('s.faqSub')}</p>
          <div className="row gap-12 wrap" style={{ marginBottom: 20 }}>
            <span className="pill"><Clock3 size={12} /> 24/7 {t('ft.support')}</span>
            <span className="pill"><Send size={12} /> {settings.telegram}</span>
          </div>
          <Link to="/contact" className="btn btn-outline btn-sm">{t('nav.contact')} <ArrowRight size={15} /></Link>
        </div>
        <div className="faq-list">
          {boot.faqs.map((f, i) => (
            <div className={`faq-item ${open === i ? 'open' : ''}`} key={i}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                {L(f.q)} <span className="plus"><ChevronDown size={15} /></span>
              </button>
              <div className="faq-a"><p>{L(f.a)}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t, boot } = useStore();
  const [products, setProducts] = useState([]);
  useEffect(() => {
    api.get('/products').then((r) => setProducts(r.data)).catch(() => {});
  }, []);
  const featured = (boot.featured.length ? boot.featured : products).slice(0, 8);
  const popular = (boot.popular.length ? boot.popular : products).slice(0, 4);

  return (
    <>
      <Hero />
      <Categories products={products} />

      <section className="section-sm" id="featured">
        <div className="container">
          <SectionHead eyebrow="TOP PICKS" title={t('s.featured')} subtitle={t('s.featuredSub')}
            action="/shop" actionText={t('c.viewAll')} />
          <div className="product-grid">
            {featured.length ? featured.map((p, i) => <ProductCard key={p.id} product={p} delay={(i % 4) * 60} />)
              : Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}
          </div>
        </div>
      </section>

      <PromoBanner />
      <HowItWorks />

      <section className="section-sm" id="popular">
        <div className="container">
          <SectionHead eyebrow="BEST SELLERS" title={t('s.popular')} subtitle={t('s.popularSub')}
            action="/shop?sort=popular" actionText={t('c.viewAll')} />
          <div className="product-grid">
            {popular.length ? popular.map((p, i) => <ProductCard key={p.id} product={p} delay={(i % 4) * 60} />)
              : Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}
          </div>
        </div>
      </section>

      <WhyUs />
      <Payments />
      <Reviews />
      <FAQ />

      <section className="section-tight">
        <div className="container">
          <Reveal className="cta-band">
            <h2>{t('s.cta')}</h2>
            <p>{t('s.ctaSub')}</p>
            <div className="row center gap-12 wrap">
              <Link to="/shop" className="btn btn-primary btn-lg"><Zap size={18} fill="currentColor" /> {t('s.ctaBtn')}</Link>
              <Link to="/track" className="btn btn-outline btn-lg">{t('nav.track')} <ArrowRight size={16} /></Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
