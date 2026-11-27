import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  Mic,
  PhoneCall,
  Send,
  ShieldAlert,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Coordinates, EmergencyIncident, TrustedContact } from '../types';

interface EmergencySosViewProps {
  countdownRemaining: number | null;
  activeIncident: EmergencyIncident | null;
  contacts: TrustedContact[];
  coords: Coordinates | null;
  sirenPlaying: boolean;
  autoDialNotice?: string | null;
  onCancelCountdown: () => void;
  onSkipCountdownNow: () => void;
  onToggleSiren: () => void;
  onResolveIncident: (status: 'resolved' | 'cancelled') => void;
  onSaveEvidence: (
    incidentId: string,
    payload: { text: string; audioDataUrl?: string; audioDurationSec?: number; hasExplicitAudioConsent?: boolean },
  ) => Promise<void>;
  onRefreshLocation: () => void;
}

export const EmergencySosView: React.FC<EmergencySosViewProps> = ({
  countdownRemaining,
  activeIncident,
  contacts,
  coords,
  sirenPlaying,
  autoDialNotice,
  onCancelCountdown,
  onSkipCountdownNow,
  onToggleSiren,
  onResolveIncident,
  onSaveEvidence,
  onRefreshLocation,
}) => {
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [audioConsentChecked, setAudioConsentChecked] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  if (countdownRemaining !== null) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red-500/50 bg-gradient-to-b from-red-950/85 to-[#0B1022] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-600/25 ring-2 ring-red-500">
          <span className="font-mono-tabular text-4xl font-bold text-white">{countdownRemaining}</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold text-white sm:text-3xl">
          Activating Emergency SOS
        </h1>
        <p className="mt-2 text-sm text-red-100/90">
          Obtaining live GPS coordinates, preparing family alerts, and activating emergency mode in{' '}
          <span className="font-mono-tabular font-semibold">{countdownRemaining}s</span>.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onCancelCountdown}
            className="min-h-[48px] rounded-xl border border-slate-600 bg-[#10172E] px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Cancel Alert (I&apos;m Safe)
          </button>
          <button
            type="button"
            onClick={onSkipCountdownNow}
            className="min-h-[48px] rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500"
          >
            Trigger SOS Immediately
          </button>
        </div>
      </div>
    );
  }

  if (!activeIncident) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-[#0D1328] p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-4 font-display text-2xl font-bold text-white">No Active SOS Emergency</h1>
        <p className="mt-2 text-sm text-slate-300">
          Press the red SOS button on the Dashboard or top bar anytime you feel unsafe.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a
            href="tel:112"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
          >
            <PhoneCall className="h-4 w-4" />
            <span>Direct Call 112</span>
          </a>
        </div>
      </div>
    );
  }

  const liveCoords = activeIncident.coordinates ?? coords;
  const mapsLink = activeIncident.googleMapsLink;
  const parentContacts = contacts.filter((c) => c.isPrimaryParent || c.relationship === 'Father' || c.relationship === 'Mother');

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeIncident.emergencyMessage);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await onSaveEvidence(activeIncident.id, { text: noteText.trim() });
      setNoteText('');
    } finally {
      setSavingNote(false);
    }
  };

  const handleStartAudioEvidence = async () => {
    if (!audioConsentChecked) {
      setAudioError('Check the explicit audio consent box first.');
      return;
    }
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      setRecordingSec(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            void onSaveEvidence(activeIncident.id, {
              text: noteText.trim() || 'Recorded emergency audio evidence',
              audioDataUrl: reader.result,
              audioDurationSec: recordingSec,
              hasExplicitAudioConsent: true,
            });
            setNoteText('');
          }
        };
        reader.readAsDataURL(blob);
        setIsRecordingAudio(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSec((s) => {
          if (s >= 29) {
            recorder.stop();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setAudioError('Microphone access was denied or is unavailable on this device.');
    }
  };

  const handleStopAudioEvidence = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Emergency Banner */}
      <div className="rounded-3xl border border-red-500/60 bg-gradient-to-r from-red-950/90 via-[#1E0E24] to-[#0D1328] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white">
              <span className="animate-sos-ring absolute inset-0 rounded-2xl border-2 border-red-400" />
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-red-300">
                SOS EMERGENCY MODE ACTIVE · {new Date(activeIncident.startedAt).toLocaleTimeString()}
              </p>
              <h1 className="font-display text-2xl font-bold text-white">Stay Calm &amp; Move to Safety</h1>
              <p className="mt-1 text-xs text-red-100/85">
                Move toward brightly lit shops, security desks, or populated transit gates while keeping your phone ready.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onToggleSiren}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                sirenPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'border border-slate-700 bg-[#10172E] text-white hover:bg-slate-800'
              }`}
            >
              {sirenPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span>{sirenPlaying ? 'Mute Siren' : 'Play Loud Siren'}</span>
            </button>

            <a
              href="tel:112"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-red-500"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Call 112 Now</span>
            </a>

            <button
              type="button"
              onClick={() => onResolveIncident('resolved')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/50 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>I&apos;m Safe · Cancel / End SOS</span>
            </button>
          </div>
        </div>
        {autoDialNotice && (
          <div className="mt-4 rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-2.5 text-xs text-emerald-100">
            {autoDialNotice}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Live Location & Emergency Message */}
        <div className="space-y-5 lg:col-span-6">
          <section className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-white">Live Location Tracking</h2>
              <button
                type="button"
                onClick={onRefreshLocation}
                className="min-h-[36px] rounded-lg border border-slate-700 bg-[#10172E] px-3 py-1 text-xs font-medium text-violet-300 hover:bg-slate-800"
              >
                Update GPS
              </button>
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-slate-800/90 bg-[#070B19] p-3.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div className="min-w-0 flex-1 text-xs">
                {liveCoords ? (
                  <>
                    <p className="font-mono-tabular font-semibold text-white">
                      {liveCoords.lat.toFixed(6)}, {liveCoords.lng.toFixed(6)}
                    </p>
                    <p className="mt-1 text-slate-400">
                      Updated {new Date(liveCoords.timestamp).toLocaleTimeString()} ·{' '}
                      {liveCoords.accuracy ? `±${Math.round(liveCoords.accuracy)}m` : 'Active lock'}
                    </p>
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 font-medium text-violet-300 underline hover:text-violet-200"
                    >
                      <span>Open Google Maps Pin</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </>
                ) : (
                  <p className="text-amber-200">
                    Waiting for GPS coordinates. Grant location permission or call 112 directly.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-300">Prepared SOS Emergency Message</p>
                <button
                  type="button"
                  onClick={() => void handleCopyMessage()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copiedMsg ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <p className="mt-2 rounded-xl border border-slate-800 bg-[#070B19] p-3 text-xs leading-relaxed text-slate-200">
                {activeIncident.emergencyMessage}
              </p>
            </div>
          </section>

          {/* Evidence Note & Explicit-Consent Audio */}
          <section className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
            <h2 className="font-display text-base font-semibold text-white">Save Incident Evidence</h2>
            <p className="mt-1 text-xs text-slate-400">
              Notes and optional audio recordings (up to 30s) are stored encrypted in your Emergency History.
            </p>
            <form onSubmit={handleSubmitNote} className="mt-3 space-y-3">
              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Describe vehicle number, landmark, or person..."
                className="w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={savingNote || !noteText.trim()}
                  className="min-h-[40px] rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>

                {!isRecordingAudio ? (
                  <button
                    type="button"
                    onClick={() => void handleStartAudioEvidence()}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    <Mic className="h-3.5 w-3.5 text-red-400" />
                    <span>Record Audio Evidence</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopAudioEvidence}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span className="font-mono-tabular">Stop Recording ({recordingSec}s)</span>
                  </button>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={audioConsentChecked}
                  onChange={(e) => setAudioConsentChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 accent-violet-600"
                />
                <span>I explicitly consent to record microphone audio for this incident.</span>
              </label>

              {audioError && <p className="text-xs text-red-300">{audioError}</p>}
            </form>
          </section>
        </div>

        {/* Family Contact Alert Status & One-Tap Call Parents */}
        <div className="space-y-5 lg:col-span-6">
          {parentContacts.length > 0 && (
            <section className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
              <h2 className="font-display text-base font-semibold text-white">One-Tap Parent Calling</h2>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {parentContacts.map((parent) => (
                  <a
                    key={parent.id}
                    href={`tel:${parent.phone.replace(/[^+\d]/g, '')}`}
                    className="flex min-h-[48px] items-center justify-between rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-2.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50"
                  >
                    <span>
                      Call {parent.relationship} ({parent.name})
                    </span>
                    <PhoneCall className="h-4 w-4 shrink-0 text-emerald-300" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
            <h2 className="font-display text-base font-semibold text-white">Family Alert Delivery Status</h2>
            <p className="mt-1 text-xs text-slate-400">
              Delivery confirmation reflects real SMS gateway responses. Where no SMS gateway is attached, tap Send SMS
              to open your device&apos;s messaging app directly.
            </p>

            {activeIncident.deliveries.length === 0 ? (
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
                No trusted contacts registered yet. Add contacts in Trusted Contacts or dial 112 immediately.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {activeIncident.deliveries.map((d) => (
                  <div
                    key={d.contactId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070B19] p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        {d.contactName} <span className="font-normal text-slate-400">· {d.relationship}</span>
                      </p>
                      <p className="mt-0.5 font-mono-tabular text-xs text-slate-400">{d.phone}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        SMS:{' '}
                        <span
                          className={
                            d.status === 'delivered' || d.status === 'queued'
                              ? 'font-semibold text-emerald-300'
                              : d.status === 'manual_required'
                                ? 'font-semibold text-amber-300'
                                : 'font-semibold text-red-300'
                          }
                        >
                          {d.status === 'delivered'
                            ? 'Auto-Delivered via SMS Gateway'
                            : d.status === 'queued'
                              ? 'Auto-Dispatched via SMS Gateway'
                              : d.status === 'manual_required'
                                ? 'Gateway Secrets Not Set (Tap Send SMS)'
                                : 'Gateway SMS Failed'}
                        </span>
                      </p>
                      {d.callStatus && (
                        <p className="mt-0.5 text-xs text-slate-300">
                          Auto-Call:{' '}
                          <span
                            className={
                              d.callStatus === 'initiated' || d.callStatus === 'queued'
                                ? 'font-semibold text-emerald-300'
                                : d.callStatus === 'manual_required'
                                  ? 'font-semibold text-sky-300'
                                  : 'font-semibold text-red-300'
                            }
                          >
                            {d.callStatus === 'initiated' || d.callStatus === 'queued'
                              ? 'Automated Voice Call Initiated'
                              : d.callStatus === 'manual_required'
                                ? 'Device Dialer Mode'
                                : 'Voice Call Failed'}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={d.smsUri}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send SMS</span>
                      </a>
                      <a
                        href={`tel:${d.phone.replace(/[^+\d]/g, '')}`}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-[#10172E] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
