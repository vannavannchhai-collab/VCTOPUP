import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Star, Zap, ShieldCheck, Clock3, ShoppingCart, ArrowRight, Minus, Plus,
  Info, CheckCircle2, Sparkles,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { usd, khr } from '../lib/format.js';
import ProductCard from '../components/ProductCard.jsx';
import { ProductArt, Price, PageHead } from '../components/ui.jsx';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, L, lang, rate, addToCart, notify, setCartOpen, boot } = useStore();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packageId, setPackageId] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [qty, setQty] = useState(1);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setPackageId(null); setAccountId(''); setQty(1);
    api.get(`/products/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (cancelled) return;
        setProduct(res.data); setRelated(res.related || []);
        const pop = res.data.packages.find((p) => p.popular);
        setPackageId((pop || res.data.packages[0])?.id || null);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const selected = useMemo(() => product?.packages.find((p) => p.id === packageId), [product, packageId]);
  const total = (selected?.price || 0) * qty;

  const buildItem = () => ({
    productSlug: product.slug, productId: product.id, productName: product.name,
    packageId: selected.id, packageLabel: selected.label, price: selected.price,
    qty, accountId: accountId.trim(), requiresId: product.requiresId,
    icon: product.icon, colors: product.colors,
    productIcon: product.icon, productColors: product.colors, productBrand: product.brand,
  });

  const validate = () => {
    if (!selected) { setFormError(t('p.selectPkg')); return false; }
    if (accountId.trim().length < 3) { setFormError(t('p.fillId')); return false; }
    setFormError(''); return true;
  };

  const onAdd = () => {
    if (!validate()) return;
    addToCart(buildItem());
    notify(`${product.name} — ${t('c.added')}`, 'success');
    setCartOpen(true);
  };

  const onBuy = () => {
    if (!validate()) return;
    addToCart(buildItem());
    navigate('/checkout');
  };

  if (loading) return (
    <div className="container" style={{ padding: '60px 0 100px' }}>
      <div className="detail-grid">
        <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
        <div className="stack gap-16"><div className="skeleton" style={{ height: 50 }} /><div className="skeleton" style={{ height: 100 }} /><div className="skeleton" style={{ height: 250 }} /></div>
      </div>
    </div>
  );
  if (error || !product) return (
    <div className="container" style={{ padding: '80px 0' }}>
      <div className="empty-state card">
        <div className="empty-icon"><Info size={32} /></div>
        <h3>{error || t('c.error')}</h3>
        <Link to="/shop" className="btn btn-primary btn-sm">{t('c.goHome')}</Link>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div className="container inner">
          <div className="breadcrumb">
            <Link to="/">VC TOPUP</Link><span>/</span>
            <Link to="/shop">{t('nav.shop')}</Link><span>/</span>
            <span style={{ color: 'var(--text)' }}>{product.name}</span>
          </div>
        </div>
      </div>

      <div className="container product-detail">
        <div className="detail-grid">
          {/* ------------------------------------------------------------ left */}
          <div>
            <div className="detail-visual">
              <ProductArt product={product} className="detail-hero-art" />
              <div className="detail-info-cards">
                <div className="detail-info-card"><Clock3 size={19} /><strong>{L(product.delivery)}</strong><small>{t('p.delivery')}</small></div>
                <div className="detail-info-card"><ShieldCheck size={19} /><strong>{boot.previewMode ? t('live.previewBadge') : t('trust.2')}</strong><small>{boot.previewMode ? t('live.previewUnavailable') : t('p.verified')}</small></div>
                </div>

              <div className="detail-block" style={{ marginTop: 18 }}>
                <h3><Info size={17} /> {t('p.description')}</h3>
                <p style={{ fontSize: '.87rem', lineHeight: 1.85 }}>{L(product.desc)}</p>
              </div>

              <div className="detail-block">
                <h3><Sparkles size={17} /> {t('p.instructions')}</h3>
                <ol className="instructions-list two">
                  {(product.instructions?.[lang] || product.instructions?.en || []).map((s, i) => (
                    <li key={i}><span className="n">{i + 1}</span>{s}</li>
                  ))}
                </ol>
                <div className="alert alert-warn" style={{ marginTop: 18 }}>
                  <Info size={15} />
                  <span><strong>{t('p.important')}</strong> {t('p.idHelp')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- right */}
          <div className="detail-main">
            <div className="row gap-8 wrap" style={{ marginBottom: 10 }}>
              {boot.previewMode && <span className="badge preview-product-badge">{t('live.previewBadge')}</span>}
              {!boot.previewMode && product.tag && <span className={`badge ${product.tag === 'HOT' ? 'badge-hot' : product.tag === 'NEW' ? 'badge-new' : 'badge-popular'}`}>{product.tag}</span>}
              <span className="badge badge-gray">{product.currency}</span>
            </div>
            <h1>{product.name}</h1>
            <div className="detail-meta">
              <span className="row gap-6">{boot.previewMode ? <Info size={14} /> : <CheckCircle2 size={14} className="text-green" />} {boot.previewMode ? t('live.previewPrice') : t('ad.providerPriceVerified')}</span>
            </div>
            <p className="detail-desc">{L(product.desc)}</p>

            <div className="detail-block">
              <h3><span className="step">1</span> {t('p.choose')}</h3>
              <div className="package-grid">
                {product.packages.map((p) => (
                  <button key={p.id} type="button"
                    className={`package-btn ${packageId === p.id ? 'selected' : ''} ${p.popular ? 'popular-flag' : ''}`}
                    onClick={() => { setPackageId(p.id); setFormError(''); }}>
                    {p.popular && <span className="pk-flag">{t('c.bestValue')}</span>}
                    {packageId === p.id && <span className="pk-check"><CheckCircle2 size={13} /></span>}
                    <span className="pk-label">{p.label}</span>
                    {boot.previewMode && <span className="pk-preview-label">{t('live.previewBadge')}</span>}
                    {p.oldPrice && <span className="pk-old">{usd(p.oldPrice)}</span>}
                    <span className="pk-price">{usd(p.price)}</span>
                    {rate && <span className="pk-khr">{khr(p.price, rate)}</span>}
                  </button>
                ))}
              </div>
            </div>

            {boot.previewMode ? <div className="alert alert-info preview-detail-notice" style={{ marginTop: 18 }}>
              <Info size={16} /><div><span>{t('live.previewUnavailable')}</span>
                <Link to="/checkout" className="btn btn-outline btn-xs" style={{ marginTop: 10 }}>{t('live.previewCheckoutLink')}</Link>
              </div>
            </div> : <div className="detail-block">
              <h3><span className="step">2</span> {t('p.account')}</h3>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="field-label">{L(product.idLabel)}</label>
                <input className="input" placeholder={product.idPlaceholder} value={accountId}
                  onChange={(e) => { setAccountId(e.target.value); setFormError(''); }} />
                <div className="form-hint">{t('p.idHelp')}</div>
              </div>
              <div className="row between gap-16 wrap">
                <div className="form-group">
                  <label className="field-label">{t('p.qtyLabel')}</label>
                  <div className="qty-control" style={{ transform: 'scale(1.35)', transformOrigin: 'left center' }}>
                    <button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={11} /></button>
                    <span>{qty}</span>
                    <button onClick={() => setQty(Math.min(99, qty + 1))}><Plus size={11} /></button>
                  </div>
                </div>
                <div className="text-right">
                  <label className="field-label" style={{ textAlign: 'right' }}>{t('p.yourTotal')}</label>
                  <Price value={total} size="lg" rate={rate} />
                </div>
              </div>
              {formError && <div className="form-error" style={{ marginTop: 12 }}><Info size={13} /> {formError}</div>}
              <div className="detail-actions">
                <button className="btn btn-outline" onClick={onAdd}><ShoppingCart size={17} /> {t('c.addToCart')}</button>
                <button className="btn btn-primary" onClick={onBuy}><Zap size={17} fill="currentColor" /> {t('c.buyNow')}</button>
              </div>
              <p className="text-center tiny text-dim" style={{ marginTop: 14 }}><ShieldCheck size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{t('p.secure')}</p>
              <p className="text-center tiny text-dim" style={{ marginTop: 6 }}>{t('p.needHelp')} <Link to="/contact" style={{ color: '#c4b5fd' }}>{t('nav.contact')}</Link></p>
            </div>}
          </div>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: 70 }}>
            <div className="section-head"><div><div className="eyebrow">MORE LIKE THIS</div><h2>{t('p.related')}</h2></div>
              <Link to="/shop" className="btn btn-outline btn-sm">{t('c.viewAll')} <ArrowRight size={15} /></Link></div>
            <div className="product-grid">
              {related.map((p, i) => <ProductCard key={p.id} product={p} delay={i * 60} />)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
