import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Star as StarIcon } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { usd, khr, statusTone } from '../lib/format.js';
import BrandLogo from './BrandLogo.jsx';

/* ------------------------------------------------------------- ProductArt */
export function ProductArt({ product, className = '', style, compact = false }) {
  const name = product?.name || product?.productName || 'VC TOPUP';
  const brand = product?.brand || product?.productBrand || '';
  return (
    <div className={`product-art official-brand-art ${className}`} style={style}>
      <BrandLogo brand={brand} label={name} compact={compact} />
    </div>
  );
}

/* ------------------------------------------------------------------ Price */
export function Price({ value, size = '', rate, showKhr = true, className = '' }) {
  const { rate: ctxRate } = useStore();
  return (
    <span className={`price ${size} ${className}`}>
      <span className="usd">{usd(value)}</span>
      {showKhr && (rate || ctxRate) && <span className="khr">{khr(value, rate || ctxRate)}</span>}
    </span>
  );
}

/* ---------------------------------------------------------- Section header */
export function SectionHead({ eyebrow, title, subtitle, action, actionText }) {
  return (
    <Reveal className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {(action || actionText) && (
        <Link to={action || '/shop'} className="btn btn-outline btn-sm">
          {actionText} <ArrowRight size={15} />
        </Link>
      )}
    </Reveal>
  );
}

/* --------------------------------------------------------------- Reveal.js */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const ob = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('in'); ob.unobserve(el); }
    }, { threshold: .08, rootMargin: '0px 0px -30px 0px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>{children}</Tag>;
}

/* ------------------------------------------------------------ StatusBadge */
export function StatusBadge({ status, withDot = true }) {
  const { t } = useStore();
  const tone = statusTone(status);
  return (
    <span className={`badge badge-${tone}`}>
      {withDot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
      {t(`st.${status}`) || status}
    </span>
  );
}

/* --------------------------------------------------------------- Page head */
export function PageHead({ title, subtitle, crumbs = [] }) {
  return (
    <div className="page-head">
      <div className="container inner">
        <div className="breadcrumb">
          <Link to="/">VC TOPUP</Link>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <span>/</span>
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span style={{ color: 'var(--text)' }}>{c.label}</span>}
            </React.Fragment>
          ))}
          <span>/</span><span style={{ color: 'var(--text)' }}>{title}</span>
        </div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Copy button */
export function CopyButton({ text, onCopied, label, children, className = 'btn btn-outline btn-sm' }) {
  const { t } = useStore();
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e?.preventDefault?.(); e?.stopPropagation?.();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true); onCopied?.();
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {children !== undefined ? children : (copied ? t('c.copied') : (label || t('c.copy')))}
    </button>
  );
}

/* -------------------------------------------------------------- Stars row */
export function Stars({ value = 5, size = 13 }) {
  return <span className="stars">{Array.from({ length: 5 }, (_, i) => (
    <StarIcon key={i} size={size} fill={i < Math.round(value) ? 'currentColor' : 'none'} opacity={i < Math.round(value) ? 1 : .3} />
  ))}</span>;
}
