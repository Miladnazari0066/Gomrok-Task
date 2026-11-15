import { useEffect, useState } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type DeviceOS = 'ios' | 'android' | 'desktop';

export interface DeviceEnvironment {
  deviceType: DeviceType;
  os: DeviceOS;
  isTouch: boolean;
  isStandalone: boolean;
  isPreviewEnvironment: boolean;
  viewportWidth: number;
  viewportHeight: number;
  orientation: 'portrait' | 'landscape';
}

function detectDeviceEnvironment(): DeviceEnvironment {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'desktop',
      os: 'desktop',
      isTouch: false,
      isStandalone: false,
      isPreviewEnvironment: false,
      viewportWidth: 1280,
      viewportHeight: 800,
      orientation: 'landscape',
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth || document.documentElement.clientWidth || 1280;
  const height = window.innerHeight || document.documentElement.clientHeight || 800;

  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const os: DeviceOS = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const isTouch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)')?.matches === true;

  let deviceType: DeviceType = 'desktop';
  if (width < 768) {
    deviceType = 'mobile';
  } else if (width < 1024 || (isTouch && width < 1180)) {
    deviceType = 'tablet';
  }

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  const host = window.location.hostname;
  const isPreviewHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.endsWith('.web.app');

  return {
    deviceType,
    os,
    isTouch,
    isStandalone,
    isPreviewEnvironment: isInIframe || isPreviewHost,
    viewportWidth: width,
    viewportHeight: height,
    orientation: width >= height ? 'landscape' : 'portrait',
  };
}

export function useDeviceEnvironment(): DeviceEnvironment {
  const [env, setEnv] = useState<DeviceEnvironment>(() => detectDeviceEnvironment());

  useEffect(() => {
    const sync = () => {
      const next = detectDeviceEnvironment();
      setEnv(next);
      const root = document.documentElement;
      root.setAttribute('data-device', next.deviceType);
      root.setAttribute('data-os', next.os);
      root.setAttribute('data-standalone', next.isStandalone ? 'true' : 'false');
      root.setAttribute('data-touch', next.isTouch ? 'true' : 'false');
    };

    sync();

    const displayMedia = window.matchMedia?.('(display-mode: standalone)');
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('orientationchange', sync, { passive: true });
    displayMedia?.addEventListener?.('change', sync);

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      displayMedia?.removeEventListener?.('change', sync);
    };
  }, []);

  return env;
}
