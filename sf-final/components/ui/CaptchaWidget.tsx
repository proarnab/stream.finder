'use client';
// components/ui/CaptchaWidget.tsx
import { useEffect, useRef, useCallback } from 'react';
import { getCaptchaProvider, getCaptchaSiteKey } from '@/lib/captcha';

interface CaptchaWidgetProps {
  onVerify?: (token: string) => void;
  onError?: (error: string) => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact' | 'invisible';
  className?: string;
}

export function CaptchaWidget({
  onVerify,
  onError,
  theme = 'dark',
  size = 'normal',
  className = '',
}: CaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const provider = getCaptchaProvider();
  const siteKey = getCaptchaSiteKey();

  // Auto-render CAPTCHA widget on mount
  useEffect(() => {
    if (provider === 'none' || !siteKey || !containerRef.current) return;

    const loadCaptcha = async () => {
      if (provider === 'hcaptcha') {
        // @ts-expect-error — hcaptcha script injected globally
        if (!window.hcaptcha) {
          const script = document.createElement('script');
          script.src = 'https://js.hcaptcha.com/1/api.js';
          document.body.appendChild(script);
          script.onload = () => renderHCaptcha();
        } else {
          renderHCaptcha();
        }
      } else if (provider === 'turnstile') {
        // @ts-expect-error — turnstile script injected globally
        if (!window.turnstile) {
          const script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
          document.body.appendChild(script);
          script.onload = () => renderTurnstile();
        } else {
          renderTurnstile();
        }
      }
    };

    const renderHCaptcha = () => {
      if (!containerRef.current) return;
      // @ts-expect-error — hcaptcha injected by script
      window.hcaptcha?.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
        callback: (token: string) => onVerify?.(token),
        'error-callback': () => onError?.('hCaptcha verification failed'),
        'expired-callback': () => onError?.('CAPTCHA expired'),
      });
    };

    const renderTurnstile = () => {
      if (!containerRef.current) return;
      // @ts-expect-error — turnstile injected by script
      window.turnstile?.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
        callback: (token: string) => onVerify?.(token),
        'error-callback': () => onError?.('Turnstile verification failed'),
        'expired-callback': () => onError?.('CAPTCHA expired'),
      });
    };

    loadCaptcha();
  }, [provider, siteKey, onVerify, onError, theme, size]);

  // No CAPTCHA configured
  if (provider === 'none') {
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className={`text-xs text-slate-600 p-3 bg-slate-900/50 rounded-lg border border-slate-700 ${className}`}>
          ℹ️ CAPTCHA not configured (dev mode). Set CAPTCHA_PROVIDER env var to enable.
        </div>
      );
    }
    return null;
  }

  return (
    <div ref={containerRef} className={className} aria-label="CAPTCHA verification">
      {/* Widget renders here */}
    </div>
  );
}

// ─── Reset CAPTCHA (call after form submission) ────────────────────────────────

export function resetCaptcha() {
  const provider = getCaptchaProvider();
  if (provider === 'hcaptcha') {
    // @ts-expect-error — hcaptcha injected globally
    window.hcaptcha?.reset();
  } else if (provider === 'turnstile') {
    // @ts-expect-error — turnstile injected globally
    window.turnstile?.reset();
  }
}

// ─── Get token for manual submission ───────────────────────────────────────────

export function getCaptchaToken(): string | null {
  const provider = getCaptchaProvider();
  if (provider === 'hcaptcha') {
    // @ts-expect-error — hcaptcha injected globally
    return window.hcaptcha?.getResponse() ?? null;
  } else if (provider === 'turnstile') {
    // @ts-expect-error — turnstile injected globally
    return window.turnstile?.getResponse() ?? null;
  }
  return null;
}

// ─── Hook wrapper for easier use in forms ──────────────────────────────────────

export function useCaptcha() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useRef('');

  const getCaptcha = useCallback(() => getCaptchaToken(), []);
  const reset = useCallback(() => resetCaptcha(), []);

  return { containerRef, getCaptcha, reset, token: token.current, setToken: (t: string) => { token.current = t; } };
}
