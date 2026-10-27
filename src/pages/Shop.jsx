import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Package, ArrowRight } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api, qs } from '../lib/api.js';
import ProductCard from '../components/ProductCard.jsx';
import Icon from '../components/Icon.jsx';
import { PageHead } from '../components/ui.jsx';

export default function Shop() {
  const { t, L, boot, bootLoading } = useStore();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || 'all';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'popular';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(q);

  useEffect(() => { setSearch(q); }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    api.get(`/products${qs({ category, q, sort })}`)
      .then((res) => { if (!cancelled) setProducts(res.data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, q, sort]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || (key === 'sort' && value === 'popular')) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: false });
  };

  const submitSearch = (e) => { e.preventDefault(); setParam('q', search.trim()); };
  const clearAll = () => { setParams({}); setSearch(''); };

  return (
    <>
      <PageHead title={t('shop.title')} subtitle={t('shop.subtitle')} crumbs={[]} />
      <div className="container" style={{ paddingBottom: 80 }}>
        <div className="shop-toolbar">
          <form className="search-box" onSubmit={submitSearch}>
            <span className="field-icon"><Search size={17} /></span>
            <input className="input with-icon" placeholder={t('shop.searchPh')} value={search}
              onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" className="icon-btn" style={{ position: 'absolute', right: 6, top: 6, width: 34, height: 34 }}
              onClick={() => { setSearch(''); setParam('q', ''); }}><X size={14} /></button>}
          </form>
          <div className="row gap-10">
            <span className="small text-dim row gap-6 nowrap"><SlidersHorizontal size={15} /> {t('shop.sort')}</span>
            <select className="select sort-select" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              <option value="popular">{t('shop.sortPopular')}</option>
              <option value="rating">{t('shop.sortRating')}</option>
              <option value="price-asc">{t('shop.sortPriceAsc')}</option>
              <option value="price-desc">{t('shop.sortPriceDesc')}</option>
              <option value="name">{t('shop.sortName')}</option>
            </select>
          </div>
        </div>

        <div className="chip-scroll" style={{ marginBottom: 22 }}>
          <button className={`chip ${category === 'all' ? 'active' : ''}`} onClick={() => setParam('category', 'all')}>
            <Package size={15} /> {t('c.all')}
          </button>
          {boot.categories.map((c) => (
            <button key={c.id} className={`chip ${category === c.id ? 'active' : ''}`} onClick={() => setParam('category', c.id)}>
              <Icon name={c.icon} size={15} /> {L(c.name)}
            </button>
          ))}
        </div>

        <div className="result-count">
          {loading ? t('c.loading') : <>{t('shop.showing')} <strong>{products.length}</strong> {t('shop.products')}{q && <> · “{q}”</>}</>}
        </div>

        {error ? (
          <div className="empty-state">
            <div className="empty-icon"><X size={30} /></div>
            <h3>{t('c.error')}</h3><p>{error}</p>
            <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>{t('c.retry')}</button>
          </div>
        ) : loading ? (
          <div className="product-grid">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 310, borderRadius: 18 }} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon"><Search size={34} /></div>
            <h3>{t('c.noResults')}</h3>
            <p>{t('shop.subtitle')}</p>
            <button className="btn btn-outline btn-sm" onClick={clearAll}>{t('c.clearFilters')}</button>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p, i) => <ProductCard key={p.id} product={p} delay={(i % 4) * 55} />)}
          </div>
        )}

        <div className="cta-band" style={{ marginTop: 60 }}>
          <h2>{t('s.cta')}</h2>
          <p>{t('s.ctaSub')}</p>
          <Link to="/contact" className="btn btn-primary btn-lg">{t('nav.contact')} <ArrowRight size={17} /></Link>
        </div>
      </div>
    </>
  );
}
