import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { ProductArt, Price } from './ui.jsx';

export default function ProductCard({ product, delay = 0 }) {
  const { t, L, boot } = useStore();
  const category = boot.categories.find((c) => c.id === product.category);
  const tag = product.tag;
  const tagClass = tag === 'HOT' ? 'badge-hot' : tag === 'NEW' ? 'badge-new' : 'badge-popular';
  return (
    <Link to={`/product/${product.slug}`} className="product-card reveal" style={{ transitionDelay: `${delay}ms` }}>
      <div className="art-wrap">
        {boot.previewMode ? <span className="badge preview-product-badge">{t('live.previewBadge')}</span> : tag && <span className={`badge ${tagClass} card-tag`}>
          {tag === 'HOT' ? <Zap size={10} fill="currentColor" /> : null}{tag}
        </span>}
        <ProductArt product={product} />
      </div>
      <div className="card-body">
        <div className="cat-label">{category ? L(category.name) : product.category}</div>
        <h3>{product.name}</h3>
        <p className="card-desc">{L(product.desc)}</p>
        <div className="card-foot">
          <div>
            <div className="from">{boot.previewMode ? t('live.previewPrice') : t('shop.starting')}</div>
            <Price value={product.minPrice ?? (product.packages?.[0]?.price || 0)} size="sm" />
          </div>
          <span className="card-go"><ArrowUpRight size={17} /></span>
        </div>
      </div>
    </Link>
  );
}
