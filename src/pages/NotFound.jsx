import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Zap } from 'lucide-react';
import { useStore } from '../lib/store.jsx';

export default function NotFound() {
  const { t } = useStore();
  return (
    <div className="container" style={{ padding: '100px 0 120px' }}>
      <div className="empty-state">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(5rem, 16vw, 10rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-.06em' }} className="gradient-text">404</div>
        <h3>{t('misc.notFound')}</h3>
        <p>{t('misc.notFoundDesc')}</p>
        <div className="row gap-12 wrap center" style={{ marginTop: 14 }}>
          <Link to="/" className="btn btn-primary"><ArrowLeft size={16} /> {t('c.goHome')}</Link>
          <Link to="/shop" className="btn btn-outline"><Search size={16} /> {t('nav.shop')}</Link>
        </div>
      </div>
    </div>
  );
}
