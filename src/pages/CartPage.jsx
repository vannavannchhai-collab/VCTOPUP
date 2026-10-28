import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Trash2, ArrowRight, Tag, X, Minus, Plus, ShieldCheck,
  ArrowLeft, Info,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { usd, khr } from '../lib/format.js';
import { ProductArt, Price, PageHead } from '../components/ui.jsx';

export default function CartPage() {
  const { t, cart, removeFromCart, updateQty, clearCart, cartSubtotal, rate, boot } = useStore();
  const navigate = useNavigate();

  const total = cartSubtotal;

  return (
    <>
      <PageHead title={t('cart.title')} crumbs={[]} subtitle={t('cart.items')} />
      <div className="container checkout-layout">
        <div>
          <div className="panel">
            <div className="panel-head">
              <h2><ShoppingCart size={19} /> {t('cart.items')} <span className="badge badge-violet">{cart.length}</span></h2>
              {cart.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clearCart}><Trash2 size={14} /> {t('cart.clear')}</button>}
            </div>
            <div className="panel-body">
              {cart.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><ShoppingCart size={34} /></div>
                  <h3>{t('cart.empty')}</h3>
                  <p>{t('cart.emptyDesc')}</p>
                  <Link to="/shop" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>{t('cart.start')} <ArrowRight size={15} /></Link>
                </div>
              ) : cart.map((item) => (
                <div className="cart-item" key={item.key}>
                  <ProductArt className="item-art" product={item} compact />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <h4>{item.productName}</h4>
                    <div className="item-meta">{item.packageLabel} · {usd(item.price)} / unit{rate ? ` · ${khr(item.price, rate)}` : ''}</div>
                    {item.accountId && <div className="item-account">{t('cart.account')} {item.accountId}</div>}
                    <div style={{ marginTop: 10 }}>
                      <div className="qty-control">
                        <button onClick={() => updateQty(item.key, item.qty - 1)}><Minus size={11} /></button>
                        <span>{item.qty}</span>
                        <button onClick={() => updateQty(item.key, item.qty + 1)}><Plus size={11} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => removeFromCart(item.key)}><X size={14} /></button>
                    <Price value={item.price * item.qty} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {cart.length > 0 && (
            <div className="alert alert-info" style={{ marginTop: 18 }}>
              <Info size={16} />
              <span>{boot.previewMode ? t('live.previewUnavailable') : `${t('p.secure')} · ${t('s.paymentsSub')}`}</span>
            </div>
          )}
          <div style={{ marginTop: 22 }}>
            <Link to="/shop" className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> {t('cart.continue')}</Link>
          </div>
        </div>

        <div className="summary-panel">
          <div className="panel">
            <div className="panel-head"><h2><Tag size={18} /> {t('cart.summary')}</h2></div>
            <div className="panel-body">
              <div className="summary-row"><span>{t('c.subtotal')}</span><span>{usd(cartSubtotal)}</span></div>
              <div className="summary-row"><span>{t('p.delivery')}</span><span className="text-dim">{boot.previewMode ? t('live.previewBadge') : t('live.providerDelivery')}</span></div>
              <div className="summary-row total"><span>{t('c.total')}</span><Price value={total} size="lg" rate={rate} /></div>

              <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }}
                disabled={cart.length === 0 || boot.previewMode} onClick={() => navigate('/checkout')}>
                {boot.previewMode ? t('live.previewBadge') : t('cart.checkout')} <ArrowRight size={17} />
              </button>
              <p className="text-center tiny text-dim" style={{ marginTop: 12 }}><ShieldCheck size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{t('p.secure')}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
