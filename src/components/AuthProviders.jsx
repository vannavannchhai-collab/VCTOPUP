import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import BrandLogo from './BrandLogo.jsx';

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function AuthProviders({ onAuth, busy, setError, t }) {
  const googleTarget = useRef(null);
  const telegramTarget = useRef(null);
  const [config, setConfig] = useState(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingTelegram, setLoadingTelegram] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/auth/providers').then((r) => { if (alive) setConfig(r.data); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [setError]);

  useEffect(() => {
    if (!config?.googleReady || !config.googleClientId || !googleTarget.current) return undefined;
    let alive = true;
    setLoadingGoogle(true);
    loadScript('https://accounts.google.com/gsi/client', 'google-identity-services')
      .then(() => {
        if (!alive || !window.google?.accounts?.id || !googleTarget.current) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (response) => {
            if (!response?.credential) return setError(t('au.googleFailed'));
            onAuth('google', response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.renderButton(googleTarget.current, {
          type: 'standard', theme: 'filled_black', size: 'large', shape: 'rectangular',
          text: 'continue_with', width: Math.min(360, googleTarget.current.clientWidth || 320),
          logo_alignment: 'left',
        });
      })
      .catch(() => setError(t('au.googleUnavailable')))
      .finally(() => { if (alive) setLoadingGoogle(false); });
    return () => { alive = false; if (googleTarget.current) googleTarget.current.replaceChildren(); };
  }, [config?.googleReady, config?.googleClientId, onAuth, setError, t]);

  useEffect(() => {
    if (!config?.telegramReady || !config.telegramBotUsername || !telegramTarget.current) return undefined;
    let alive = true;
    window.onVCTelegramAuth = (user) => { if (alive) onAuth('telegram', user); };
    telegramTarget.current.replaceChildren();
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', config.telegramBotUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onVCTelegramAuth(user)');
    script.onload = () => setLoadingTelegram(false);
    script.onerror = () => { setLoadingTelegram(false); setError(t('au.telegramUnavailable')); };
    setLoadingTelegram(true);
    telegramTarget.current.appendChild(script);
    return () => {
      alive = false;
      delete window.onVCTelegramAuth;
      telegramTarget.current?.replaceChildren();
    };
  }, [config?.telegramReady, config?.telegramBotUsername, onAuth, setError, t]);

  return (
    <div className="social-auth">
      <div className="social-auth-divider"><span>{t('au.orContinue')}</span></div>
      {config?.googleReady ? (
        <div className="social-auth-button google-auth-button">
          <div ref={googleTarget} />
          {loadingGoogle && <span className="social-loading"><Loader2 size={15} className="spinner" /></span>}
        </div>
      ) : (
        <div className="social-auth-unconfigured"><BrandLogo brand="google" label="Google" compact /> <span>{t('au.googleSetupRequired')}</span></div>
      )}
      {config?.telegramReady ? (
        <div className="social-auth-button telegram-auth-button">
          <div ref={telegramTarget} />
          {loadingTelegram && <span className="social-loading"><Loader2 size={15} className="spinner" /></span>}
        </div>
      ) : (
        <div className="social-auth-unconfigured"><BrandLogo brand="telegram" label="Telegram" compact /> <span>{t('au.telegramSetupRequired')}</span></div>
      )}
      {busy && <div className="tiny text-dim social-signin-progress"><Loader2 size={14} className="spinner" /> {t('au.signingIn')}</div>}
      {config && (!config.googleReady || !config.telegramReady) && (
        <div className="social-auth-note"><AlertCircle size={13} /> {t('au.socialNeedsSetup')}</div>
      )}
    </div>
  );
}
