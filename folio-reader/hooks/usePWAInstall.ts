import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  | 'unavailable'   // not web, already installed, or browser doesn't support
  | 'promptable'    // Chrome/Edge — can call prompt()
  | 'ios';          // iOS Safari — must show manual instructions

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isWebkit = /webkit/i.test(ua);
  const isChrome = /crios/i.test(ua);
  return isIos && isWebkit && !isChrome;
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-ignore – iOS Safari specific
    window.navigator.standalone === true
  );
}

export function usePWAInstall() {
  const [installState, setInstallState] = useState<InstallState>('unavailable');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isInStandaloneMode()) return;

    if (isIosSafari()) {
      setInstallState('ios');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState('promptable');
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallState('unavailable');
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => setDismissed(true);

  const visible = !dismissed && installState !== 'unavailable';

  return { installState, visible, install, dismiss };
}
