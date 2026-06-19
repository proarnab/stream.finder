'use client';
// components/pwa/InstallBanner.tsx
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner]         = useState(false);
  const [isIOS, setIsIOS]                   = useState(false);
  const [isInstalled, setIsInstalled]       = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);

    // Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 10 seconds on the site
      setTimeout(() => {
        if (!localStorage.getItem('pwa-dismissed')) setShowBanner(true);
      }, 10_000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show iOS instructions after delay
    if (ios && !localStorage.getItem('pwa-dismissed')) {
      setTimeout(() => setShowBanner(true), 15_000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-dismissed', '1');
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50
                 bg-surface-800 border border-brand-500/30 rounded-2xl shadow-2xl shadow-black/50
                 p-4 animate-fade-up"
      role="dialog"
      aria-label="Install StreamFinder app"
    >
      <div className="flex items-start gap-3">
        {/* App icon */}
        <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg shadow-brand-500/40">
          S
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Add StreamFinder to Home Screen</p>
          {isIOS ? (
            <p className="text-xs text-slate-400 mt-0.5">
              Tap the <strong className="text-white">Share</strong> button then{' '}
              <strong className="text-white">Add to Home Screen</strong>
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">
              Install the app for faster access — works offline too
            </p>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 -mt-1"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!isIOS && deferredPrompt && (
        <button
          onClick={handleInstall}
          className="w-full mt-3 btn-primary justify-center py-2.5"
        >
          Install App — It&apos;s Free
        </button>
      )}

      {isIOS && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-surface-900 rounded-lg p-2.5">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-11h2v6h-2zm0-4h2v2h-2z"/>
          </svg>
          Tap ⎙ Share → &quot;Add to Home Screen&quot;
        </div>
      )}
    </div>
  );
}
