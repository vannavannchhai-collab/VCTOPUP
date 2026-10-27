import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Mail, MapPin, Clock3, Send, Facebook, Youtube, Instagram,
  CheckCircle2, Info, ArrowRight, HelpCircle, Sparkles,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { PageHead } from '../components/ui.jsx';

export default function Contact() {
  const { t, L, settings, notify, user } = useStore();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/contact', form);
      setSent(true); notify(t('ct.sent'), 'success');
      setForm({ ...form, subject: '', body: '' });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const items = [
    { icon: Phone, label: t('ct.phone'), value: settings.phone, href: `tel:${settings.phone}` },
    { icon: Mail, label: t('ct.email'), value: settings.email, href: `mailto:${settings.email}` },
    { icon: Send, label: 'Telegram', value: settings.telegram, href: `https://t.me/${(settings.telegram || 'vctopup').replace('@', '')}` },
    { icon: MapPin, label: t('ct.address'), value: L(settings.address) },
    { icon: Clock3, label: t('ct.hours'), value: t('ct.hoursValue') },
  ];

  return (
    <>
      <PageHead title={t('ct.title')} subtitle={t('ct.subtitle')} crumbs={[]} />
      <div className="container contact-grid">
        <div className="panel">
          <div className="panel-head"><h2><Send size={18} /> {t('ct.formTitle')}</h2></div>
          <form className="panel-body" onSubmit={submit}>
            {sent && <div className="alert alert-success" style={{ marginBottom: 18 }}><CheckCircle2 size={16} /> {t('ct.sent')}</div>}
            {error && <div className="alert alert-error" style={{ marginBottom: 18 }}><Info size={16} /> {error}</div>}
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group"><label className="field-label">{t('ct.name') || t('au.name')} *</label>
                <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('co.namePh')} /></div>
              <div className="form-group"><label className="field-label">{t('ct.email')} *</label>
                <input className="input" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={t('co.emailPh')} /></div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}><label className="field-label">{t('ct.subject')}</label>
              <input className="input" value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder={t('ct.subject')} /></div>
            <div className="form-group"><label className="field-label">{t('ct.message')} *</label>
              <textarea className="textarea" required minLength={5} value={form.body} onChange={(e) => set('body', e.target.value)} placeholder={t('ct.messagePh')} /></div>
            <button className="btn btn-primary btn-lg" style={{ marginTop: 18 }} disabled={busy}>
              {busy ? <span className="spinner" style={{ width: 17, height: 17 }} /> : <Send size={17} />} {t('ct.send')}
            </button>
          </form>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-head"><h2 style={{ fontSize: '1rem' }}>{t('ct.infoTitle')}</h2></div>
            <div className="panel-body">
              {items.map((it, i) => (
                <a className="contact-info-card" key={i} href={it.href} target={it.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                  style={{ marginBottom: i === items.length - 1 ? 0 : 12 }}>
                  <span className="ci"><it.icon size={19} /></span>
                  <div><strong>{it.label}</strong><p>{it.value}</p></div>
                </a>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-body">
              <div className="row gap-10" style={{ marginBottom: 12 }}><HelpCircle size={19} className="text-violet" /><strong>{t('s.faq')}</strong></div>
              <p className="small" style={{ marginBottom: 14 }}>{t('ct.faqHint')} <Link to="/#faq" style={{ color: '#c4b5fd' }}>{t('ct.faqLink')}</Link>.</p>
              <Link to="/#faq" className="btn btn-outline btn-sm">{t('ct.faqLink')} <ArrowRight size={14} /></Link>
              <div className="divider" style={{ margin: '20px 0' }} />
              <div className="row gap-10" style={{ marginBottom: 12 }}><Sparkles size={19} className="text-cyan" /><strong>{t('ft.follow')}</strong></div>
              <div className="footer-social">
                <a className="icon-btn" href={`https://t.me/${(settings.telegram || 'vctopup').replace('@', '')}`} target="_blank" rel="noreferrer"><Send size={16} /></a>
                <a className="icon-btn" href="https://facebook.com" target="_blank" rel="noreferrer"><Facebook size={16} /></a>
                <a className="icon-btn" href="https://youtube.com" target="_blank" rel="noreferrer"><Youtube size={16} /></a>
                <a className="icon-btn" href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={16} /></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
