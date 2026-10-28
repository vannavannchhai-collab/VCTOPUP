import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Zap, Mail, LockKeyhole, User, Phone, ArrowRight,
  CheckCircle2, Info, Eye, EyeOff,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import AuthProviders from '../components/AuthProviders.jsx';

export default function Login() {
  const { t, lang, login, register, socialLogin, notify } = useStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = params.get('tab') === 'register' ? 'register' : 'login';
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const switchTab = (next) => { setParams(next === 'register' ? { tab: 'register' } : {}); setError(''); };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (tab === 'register') {
        if (form.password !== form.confirm) throw new Error(t('au.passwordMismatch'));
        const res = await register({ name: form.name, email: form.email, phone: form.phone, password: form.password });
        notify(res.message || t('au.welcome'), 'success');
      } else {
        await login(form.email, form.password);
        notify(t('au.welcome'), 'success');
      }
      const from = location.state?.from || '/account';
      navigate(from, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const onSocialAuth = useCallback(async (provider, credential) => {
    setError(''); setLoading(true);
    try {
      await socialLogin(provider, credential);
      notify(t('au.welcome'), 'success');
      navigate(location.state?.from || '/account', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [socialLogin, notify, t, navigate, location.state]);

  return (
    <div className="auth-wrap">
      <div className="auth-visual">
        <div className="auth-brand-mark" aria-label="VC TOPUP"><Zap size={52} fill="currentColor" /><strong>VC TOPUP</strong></div>
        <h2>{t('au.welcome')}</h2>
        <p>{t('au.registerSub')} · {t('hero.subtitle')}</p>
        <ul className="auth-benefits">
          {[1, 2, 3, 4].map((i) => (
            <li key={i}><span className="bi"><CheckCircle2 size={16} /></span>{t(`au.benefit${i}`)}</li>
          ))}
        </ul>
      </div>

      <div className="auth-panel">
        <div className="auth-box">
          <h1>{tab === 'login' ? t('au.loginTitle') : t('au.registerTitle')}</h1>
          <p>{tab === 'login' ? t('au.loginSub') : t('au.registerSub')}</p>

          <div className="auth-tabs">
            <button className={tab === 'login' ? 'on' : ''} onClick={() => switchTab('login')}>{t('nav.login')}</button>
            <button className={tab === 'register' ? 'on' : ''} onClick={() => switchTab('register')}>{t('nav.register')}</button>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 18 }}><Info size={15} /> {error}</div>}

          <form onSubmit={submit}>
            {tab === 'register' && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="field-label">{t('au.name')} *</label>
                  <div className="field"><span className="field-icon"><User size={16} /></span>
                    <input className="input with-icon" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Your name" /></div>
                </div>
                <div className="form-group">
                  <label className="field-label">{t('au.phone')}</label>
                  <div className="field"><span className="field-icon"><Phone size={16} /></span>
                    <input className="input with-icon" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="012 345 678" /></div>
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="field-label">{t('au.email')} *</label>
              <div className="field"><span className="field-icon"><Mail size={16} /></span>
                <input className="input with-icon" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" /></div>
            </div>
            <div className="form-group">
              <label className="field-label">{t('au.password')} *</label>
              <div className="field"><span className="field-icon"><LockKeyhole size={16} /></span>
                <input className="input with-icon" type={showPass ? 'text' : 'password'} required minLength={tab === 'register' ? 10 : 1}
                  value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" style={{ paddingRight: 44 }} />
                <button type="button" className="icon-btn" style={{ position: 'absolute', right: 6, top: 6, width: 34, height: 34 }} onClick={() => setShowPass((v) => !v)}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {tab === 'register' && (
              <div className="form-group">
                <label className="field-label">{t('au.confirm')} *</label>
                <div className="field"><span className="field-icon"><LockKeyhole size={16} /></span>
                  <input className="input with-icon" type="password" required minLength={10}
                    value={form.confirm} onChange={(e) => set('confirm', e.target.value)} placeholder="••••••••" /></div>
              </div>
            )}
            <button className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <span className="spinner" style={{ width: 17, height: 17 }} /> : <Zap size={17} fill="currentColor" />}
              {tab === 'login' ? t('au.loginBtn') : t('au.registerBtn')} <ArrowRight size={16} />
            </button>
          </form>

          <AuthProviders onAuth={onSocialAuth} busy={loading} setError={setError} t={t} />

          <p className="text-center small" style={{ marginTop: 18 }}>
            {tab === 'login' ? t('au.noAccount') : t('au.hasAccount')}{' '}
            <button onClick={() => switchTab(tab === 'login' ? 'register' : 'login')} style={{ color: '#c4b5fd', fontWeight: 700 }}>
              {tab === 'login' ? t('nav.register') : t('nav.login')}
            </button>
          </p>


        </div>
      </div>
    </div>
  );
}
