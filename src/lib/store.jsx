import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, ApiError } from './api.js';
import { translate, localize } from './i18n.js';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const read = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ } };

const DEFAULT_BOOT = {
  settings: {
    siteName: 'VC TOPUP', exchangeRate: null, phone: '',
    telegram: '', email: '',
    announcement: { kh: '', en: '' }, tagline: { kh: '', en: '' },
    address: { kh: '', en: '' }, stats: { orders: 0, customers: 0, games: 0, uptime: null },
  },
  categories: [], paymentMethods: [], reviews: [], faqs: [],
  featured: [], popular: [], productCount: 0, previewMode: false,
  payment: { mode: 'live', live: false, ready: false, blockers: ['Live configuration status unavailable'], checks: {} },
};

export function StoreProvider({ children }) {
  const [lang, setLangState] = useState(() => read('vc_lang', 'kh'));
  const [boot, setBoot] = useState(DEFAULT_BOOT);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState(null);

  const [cart, setCart] = useState(() => read('vc_cart', []));
  const [promo, setPromo] = useState(() => read('vc_promo', null));
  const [cartOpen, setCartOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [toasts, setToasts] = useState([]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const L = useCallback((value) => localize(value, lang), [lang]);
  const setLang = useCallback((next) => {
    setLangState(next); write('vc_lang', next);
    try { document.documentElement.lang = next === 'kh' ? 'km' : 'en'; } catch { /* noop */ }
  }, []);

  const notify = useCallback((message, type = 'success', icon = null) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, icon }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3800);
  }, []);
  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  const loadBoot = useCallback(async () => {
    setBootLoading(true);
    try {
      const res = await api.get('/bootstrap');
      setBoot({ ...DEFAULT_BOOT, ...res });
      setBootError(null);
    } catch (err) {
      setBootError(err.message);
    } finally { setBootLoading(false); }
  }, []);

  useEffect(() => { loadBoot(); }, [loadBoot]);
  useEffect(() => {
    if (!getToken()) { setAuthLoading(false); return; }
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setToken(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => write('vc_cart', cart), [cart]);
  useEffect(() => write('vc_promo', promo), [promo]);

  // ------------------------------------------------------------------ cart
  const addToCart = useCallback((item) => {
    const key = `${item.productSlug}::${item.packageId}::${item.accountId || ''}`;
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + (item.qty || 1) };
        return next;
      }
      return [...prev, { ...item, key, qty: item.qty || 1 }];
    });
    return key;
  }, []);

  const removeFromCart = useCallback((key) => setCart((prev) => prev.filter((x) => x.key !== key)), []);
  const updateQty = useCallback((key, qty) => setCart((prev) =>
    prev.map((x) => x.key === key ? { ...x, qty: Math.min(99, Math.max(1, qty)) } : x)), []);
  const clearCart = useCallback(() => { setCart([]); setPromo(null); }, []);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const cartSubtotal = useMemo(() => Math.round(cart.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100, [cart]);

  // ------------------------------------------------------------------ auth
  const finishAuth = useCallback((res) => {
    setToken(res.token);
    setUser(res.data);
    return res;
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return finishAuth(res);
  }, [finishAuth]);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    return finishAuth(res);
  }, [finishAuth]);

  const socialLogin = useCallback(async (provider, credential) => {
    const endpoint = provider === 'google' ? '/auth/google' : '/auth/telegram';
    const body = provider === 'google' ? { credential } : credential;
    const res = await api.post(endpoint, body);
    return finishAuth(res);
  }, [finishAuth]);

  const logout = useCallback(() => {
    setToken(null); setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try { const res = await api.get('/auth/me'); setUser(res.data); return res.data; }
    catch { return null; }
  }, []);

  const value = {
    lang, setLang, t, L,
    boot, bootLoading, bootError, loadBoot,
    settings: boot.settings, rate: boot.settings?.exchangeRate || null,
    cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, cartSubtotal,
    promo, setPromo, cartOpen, setCartOpen,
    user, authLoading, login, register, socialLogin, logout, refreshUser,
    toasts, notify, dismissToast,
    ApiError,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
