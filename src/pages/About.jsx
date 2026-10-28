import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Timer, ShieldCheck, Users, ArrowRight, Sparkles, Gamepad2, Heart } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { PageHead, SectionHead, Reveal } from '../components/ui.jsx';

export default function About() {
  const { t, boot } = useStore();
  const values = [
    { icon: Timer, title: t('ab.value1'), desc: t('ab.value1d'), color: '#a78bfa' },
    { icon: ShieldCheck, title: t('ab.value2'), desc: t('ab.value2d'), color: '#67e8f9' },
    { icon: Users, title: t('ab.value3'), desc: t('ab.value3d'), color: '#6ee7b7' },
  ];
  return (
    <>
      <div className="page-head"><div className="container inner" style={{ textAlign: 'center' }}>
        <div className="breadcrumb" style={{ justifyContent: 'center' }}><Link to="/">VC TOPUP</Link><span>/</span><span style={{ color: 'var(--text)' }}>{t('nav.about')}</span></div>
        <h1 className="gradient-text">{t('ab.title')}</h1>
        <p style={{ margin: '0 auto' }}>{t('ab.subtitle')}</p>
      </div></div>

      <div className="container">
        <Reveal className="about-visual official-about-mark">
          <div className="about-brand-wordmark"><Sparkles size={32} /><strong>VC TOPUP</strong><span>Verified digital goods only</span></div>
        </Reveal>

        <div className="story-grid">
          <div>
            <div className="section-head" style={{ marginBottom: 18 }}><div><div className="eyebrow">OUR STORY</div><h2>{t('ab.storyTitle')}</h2></div></div>
            <p>{t('ab.story1')}</p>
            <p>{t('ab.story2')}</p>
          </div>
          <div className="panel">
            <div className="panel-body">
              <span className="badge badge-cyan"><Zap size={11} /> {t('ab.mission')}</span>
              <h3 style={{ fontSize: '1.35rem', margin: '16px 0 10px' }}>{t('ab.missionText')}</h3>
              <div className="divider" style={{ margin: '20px 0' }} />
              <div className="about-verified-note"><ShieldCheck size={18} /><span>{boot.productCount ? `${boot.productCount} ${t('live.verifiedOffers')}` : t('live.catalogNotReady')}</span></div>
              <div className="alert alert-info" style={{ marginTop: 20 }}><Heart size={15} /> {t('ft.made')}</div>
              <Link to="/shop" className="btn btn-primary btn-block" style={{ marginTop: 18 }}>{t('cart.start')} <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>

        <div className="value-grid">
          {values.map((v, i) => (
            <Reveal className="why-card" key={i} delay={i * 80}>
              <span className="wi" style={{ background: `${v.color}22`, color: v.color, borderColor: `${v.color}44` }}><v.icon size={22} /></span>
              <h3>{v.title}</h3><p>{v.desc}</p>
            </Reveal>
          ))}
        </div>

        <div style={{ marginTop: 60 }} className="cta-band">
          <h2>{t('s.cta')}</h2><p>{t('s.ctaSub')}</p>
          <div className="row center gap-12 wrap">
            <Link to="/shop" className="btn btn-primary btn-lg"><Gamepad2 size={18} /> {t('s.ctaBtn')}</Link>
            <Link to="/contact" className="btn btn-outline btn-lg">{t('nav.contact')}</Link>
          </div>
        </div>
      </div>
      <div style={{ height: 80 }} />
    </>
  );
}
