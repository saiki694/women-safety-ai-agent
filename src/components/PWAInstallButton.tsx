import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 whitespace-nowrap shrink-0 ${
          compact ? 'min-h-[40px] px-3 py-2 text-xs' : 'min-h-[44px] px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 ${
            compact ? 'min-h-[40px] px-3 py-2 text-xs' : 'min-h-[44px] px-4 py-2.5 text-sm'
          }`}
        >
          <Smartphone className="h-4 w-4 text-violet-400 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-[#10172E] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-white">Install SHE-SHIELD AI</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong> for one-tap offline SOS access.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[44px] w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
