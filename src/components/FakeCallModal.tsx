import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Shield, Volume2 } from 'lucide-react';
import { safetyAudio } from '../utils/audio';

interface FakeCallModalProps {
  callerName: string;
  callerLabel: string;
  onClose: () => void;
  onTriggerSos: () => void;
}

export const FakeCallModal: React.FC<FakeCallModalProps> = ({
  callerName,
  callerLabel,
  onClose,
  onTriggerSos,
}) => {
  const [answered, setAnswered] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    safetyAudio.startRingtone();
    return () => {
      safetyAudio.stopRingtone();
    };
  }, []);

  useEffect(() => {
    if (!answered) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [answered]);

  const handleAnswer = () => {
    safetyAudio.stopRingtone();
    setAnswered(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          'Hi, I am tracking your cab right now and waiting outside the main gate. Stay on the line with me until you reach.',
        );
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
      } catch {
        // Speech synthesis optional
      }
    }
  };

  const handleHangUp = () => {
    safetyAudio.stopRingtone();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onClose();
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const rem = (sec % 60).toString().padStart(2, '0');
    return `${mins}:${rem}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#080D1F] via-[#0B122A] to-[#050814] px-6 py-12 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Simulated incoming call"
    >
      <div className="flex flex-col items-center pt-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-violet-400/30 bg-violet-950/50 text-3xl font-semibold text-violet-200 shadow-lg">
          {callerName.slice(0, 1).toUpperCase()}
        </div>
        <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-white">{callerName}</h2>
        <p className="mt-2 font-mono-tabular text-sm text-slate-300">
          {answered ? `Connected · ${formatDuration(elapsedSec)}` : callerLabel}
        </p>

        {answered && (
          <div className="mt-8 max-w-sm rounded-2xl border border-slate-800 bg-[#10172E]/85 p-4 text-left text-xs leading-relaxed text-slate-300">
            <div className="flex items-center gap-2 font-medium text-violet-300">
              <Volume2 className="h-4 w-4" />
              <span>Voice Reassurance Script (Simulated Call)</span>
            </div>
            <p className="mt-2">
              &ldquo;Yes, I can see your live location on my phone right now. I am waiting right outside the gate—stay on
              the call with me.&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-8 pb-6">
        <div className="flex w-full items-center justify-around">
          <button
            type="button"
            onClick={handleHangUp}
            className="flex flex-col items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:bg-red-500 active:scale-95">
              <PhoneOff className="h-7 w-7" />
            </span>
            <span className="text-xs font-medium text-slate-300">{answered ? 'End Call' : 'Decline'}</span>
          </button>

          {!answered && (
            <button
              type="button"
              onClick={handleAnswer}
              className="flex flex-col items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform hover:bg-emerald-500 active:scale-95">
                <Phone className="h-7 w-7" />
              </span>
              <span className="text-xs font-medium text-slate-300">Answer</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            handleHangUp();
            onTriggerSos();
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2 text-xs font-medium text-red-200 hover:bg-red-900/50"
        >
          <Shield className="h-4 w-4 text-red-400" />
          <span>Escalate to Real SOS</span>
        </button>
      </div>
    </div>
  );
};
