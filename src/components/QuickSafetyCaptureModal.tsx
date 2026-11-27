import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileAudio,
  MapPin,
  Mic,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react';
import type { Coordinates } from '../types';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export type QuickCaptureMode = 'voice' | 'evidence';

interface QuickSafetyCaptureModalProps {
  mode: QuickCaptureMode;
  coords: Coordinates | null;
  speechSupported: boolean;
  onClose: () => void;
  onSaveReport: (payload: {
    text: string;
    audioDataUrl?: string;
    audioDurationSec?: number;
    hasExplicitAudioConsent?: boolean;
    triggerSosAfter?: boolean;
  }) => Promise<void>;
}

export const QuickSafetyCaptureModal: React.FC<QuickSafetyCaptureModalProps> = ({
  mode,
  coords,
  speechSupported,
  onClose,
  onSaveReport,
}) => {
  const [noteText, setNoteText] = useState('');
  const [dictating, setDictating] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>(undefined);
  const [audioConsent, setAudioConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const toggleDictation = () => {
    setError(null);
    if (dictating && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      setDictating(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setError('Live speech dictation is unavailable in this browser. Type your report below or record audio.');
      return;
    }

    const rec = new SpeechCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';
    rec.onresult = (ev) => {
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i += 1) {
        const t = ev.results[i]?.[0]?.transcript;
        if (t) parts.push(t);
      }
      if (parts.length > 0) {
        setNoteText(parts.join(' ').trim());
      }
    };
    rec.onerror = () => {
      setDictating(false);
      setError('Microphone permission denied or speech capture interrupted.');
    };
    rec.onend = () => {
      setDictating(false);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setDictating(true);
    } catch {
      setError('Could not start voice dictation.');
    }
  };

  const handleStartAudio = async () => {
    if (!audioConsent) {
      setError('Please check the explicit microphone recording consent box first.');
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      setRecordingSec(0);
      setAudioDataUrl(undefined);

      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setAudioDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
        setRecordingAudio(false);
      };

      recorderRef.current = rec;
      rec.start();
      setRecordingAudio(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSec((s) => {
          if (s >= 29) {
            rec.stop();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Microphone access was denied or unavailable on this device.');
    }
  };

  const handleStopAudio = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const handleSubmit = async (triggerSosAfter: boolean) => {
    if (!noteText.trim() && !audioDataUrl) {
      setError('Add a spoken/written note or record an audio clip before saving.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSaveReport({
        text:
          noteText.trim() ||
          (mode === 'voice' ? 'Quick voice incident report recorded' : 'Encrypted audio evidence recorded'),
        audioDataUrl,
        audioDurationSec: audioDataUrl ? Math.max(1, recordingSec) : undefined,
        hasExplicitAudioConsent: audioDataUrl ? true : undefined,
        triggerSosAfter,
      });
      setSavedOk(true);
      if (!triggerSosAfter) {
        setTimeout(() => {
          onClose();
        }, 700);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0D1328] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                mode === 'voice' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
              }`}
            >
              {mode === 'voice' ? <Mic className="h-5 w-5" /> : <FileAudio className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {mode === 'voice' ? 'Quick Voice Report' : 'Record Encrypted Evidence'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'voice'
                  ? 'Dictate or log an incident quickly with GPS timestamp.'
                  : 'Capture explicit-consent audio and notes to Emergency History.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick capture"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-xs text-slate-300">
            <MapPin className="h-4 w-4 shrink-0 text-violet-400" />
            <span className="truncate font-mono-tabular">
              {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'GPS location pending — timestamp attached'}
            </span>
          </div>

          {mode === 'voice' && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={!speechSupported}
                onClick={toggleDictation}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  dictating
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-violet-600 text-white hover:bg-violet-500'
                }`}
              >
                {dictating ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
                <span>{dictating ? 'Stop Voice Dictation' : 'Speak Report Now'}</span>
              </button>
              {!speechSupported && (
                <span className="text-xs text-slate-400">Speech-to-text unavailable here; type or record audio below.</span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300" htmlFor="quick-report-note">
              Incident Details / Spoken Transcript
            </label>
            <textarea
              id="quick-report-note"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Describe what happened, cab/auto plate number, landmark, or person..."
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-[#070B19] p-3.5">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={audioConsent}
                onChange={(e) => setAudioConsent(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-violet-600"
              />
              <span>I explicitly consent to record microphone audio evidence (max 30s).</span>
            </label>

            <div className="flex flex-wrap items-center gap-2.5">
              {!recordingAudio ? (
                <button
                  type="button"
                  onClick={() => void handleStartAudio()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Mic className="h-3.5 w-3.5 text-red-400" />
                  <span>{audioDataUrl ? 'Re-record Audio' : 'Record Audio Clip'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopAudio}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-500"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span className="font-mono-tabular">Stop Recording ({recordingSec}s)</span>
                </button>
              )}
              {audioDataUrl && !recordingAudio && (
                <span className="text-xs font-medium text-emerald-300">Audio captured ({recordingSec}s)</span>
              )}
            </div>

            {audioDataUrl && <audio controls src={audioDataUrl} className="h-8 w-full" />}
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">{error}</p>
          )}

          {savedOk && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>Saved securely to Emergency History.</span>
            </p>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit(false)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save to Emergency History'}</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Save &amp; Trigger SOS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
