import React, { useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  FileText,
  Lock,
  Mic,
  Phone,
  Shield,
  Square,
  Trash2,
  Upload,
  Vibrate,
  Volume2,
} from 'lucide-react';
import type { Coordinates, EmergencyIncident, SafetyPreferences, UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface EmergencyHistoryViewProps {
  incidents: EmergencyIncident[];
  coords: Coordinates | null;
  onCreateEvidenceLog: (note: string) => Promise<void>;
  onAddEvidence: (
    incidentId: string,
    payload: { text: string; audioDataUrl?: string; audioDurationSec?: number; hasExplicitAudioConsent?: boolean },
  ) => Promise<void>;
}

export const EmergencyHistoryView: React.FC<EmergencyHistoryViewProps> = ({
  incidents,
  onCreateEvidenceLog,
  onAddEvidence,
}) => {
  const [newLogNote, setNewLogNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [recordingForId, setRecordingForId] = useState<string | null>(null);
  const [consentAudio, setConsentAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim()) return;
    setCreating(true);
    try {
      await onCreateEvidenceLog(newLogNote.trim());
      setNewLogNote('');
    } finally {
      setCreating(false);
    }
  };

  const handleRecordClip = async (incidentId: string) => {
    if (!consentAudio) {
      setAudioError('Please confirm explicit audio consent before recording.');
      return;
    }
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      const started = Date.now();
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationSec = Math.max(1, Math.round((Date.now() - started) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            void onAddEvidence(incidentId, {
              text: 'Audio evidence clip recorded from Emergency History',
              audioDataUrl: reader.result,
              audioDurationSec: durationSec,
              hasExplicitAudioConsent: true,
            });
          }
        };
        reader.readAsDataURL(blob);
        setRecordingForId(null);
      };
      recorderRef.current = rec;
      rec.start();
      setRecordingForId(incidentId);
    } catch {
      setAudioError('Microphone access was denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
        <h1 className="font-display text-xl font-bold text-white">Emergency History &amp; Encrypted Evidence</h1>
        <p className="mt-1 text-xs text-slate-400">
          Every SOS trigger, missed check-in, incident timestamp, GPS link, and optional audio note is encrypted at rest.
        </p>

        <form onSubmit={handleLogSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newLogNote}
            onChange={(e) => setNewLogNote(e.target.value)}
            placeholder="Log an incident detail (e.g. suspicious vehicle plate, street location)..."
            className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-[#070B19] px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newLogNote.trim()}
            className="min-h-[44px] rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? 'Saving...' : 'Save Evidence Log'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={consentAudio}
              onChange={(e) => setConsentAudio(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 accent-violet-600"
            />
            <span>Allow explicit-consent optional audio attachment to any record below</span>
          </label>
          {audioError && <span className="text-red-300">{audioError}</span>}
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0D1328] p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 text-sm font-semibold text-white">No Emergency Incidents Recorded</p>
          <p className="mt-1 text-xs text-slate-400">
            SOS activations, missed check-ins, and saved evidence notes will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map((inc) => (
            <div key={inc.id} className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono-tabular">{new Date(inc.startedAt).toLocaleString()}</span>
                    <span aria-hidden="true">·</span>
                    <span>Trigger: {inc.triggerSource.replace('_', ' ')}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        inc.status === 'active'
                          ? 'font-semibold text-red-400'
                          : inc.status === 'resolved'
                            ? 'font-semibold text-emerald-300'
                            : 'text-slate-300'
                      }
                    >
                      {inc.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-100">{inc.emergencyMessage}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {inc.coordinates && (
                    <a
                      href={inc.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-700 bg-[#070B19] px-3 py-1.5 text-xs font-medium text-violet-300 hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Maps Pin</span>
                    </a>
                  )}
                  {recordingForId === inc.id ? (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>Stop Audio</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRecordClip(inc.id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-700 bg-[#10172E] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                    >
                      <Mic className="h-3.5 w-3.5 text-red-400" />
                      <span>Attach Audio</span>
                    </button>
                  )}
                </div>
              </div>

              {inc.evidenceNotes.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {inc.evidenceNotes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-slate-800/80 bg-[#070B19] p-3 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>{note.hasExplicitAudioConsent ? 'Explicit-Consent Audio Evidence' : 'Evidence Note'}</span>
                        <span className="font-mono-tabular">{new Date(note.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-slate-200">{note.text}</p>
                      {note.audioDataUrl && (
                        <audio controls src={note.audioDataUrl} className="mt-2 h-8 w-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ProfileSettingsViewProps {
  profile: UserProfile;
  voiceSupported: boolean;
  voiceListening: boolean;
  onUpdateProfile: (patch: {
    fullName?: string;
    mobile?: string;
    photoUrl?: string;
    preferences?: Partial<SafetyPreferences>;
    consent?: Partial<UserProfile['consent']>;
  }) => Promise<void>;
  onTestShakeSos: () => void;
  onTestSiren: () => void;
  onTriggerFakeCall: () => void;
  onRequestNotifications: () => Promise<void>;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  profile,
  voiceSupported,
  voiceListening,
  onUpdateProfile,
  onTestShakeSos,
  onTestSiren,
  onTriggerFakeCall,
  onRequestNotifications,
  onLogout,
  onDeleteAccount,
}) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [mobile, setMobile] = useState(profile.mobile);
  const [distressPhrase, setDistressPhrase] = useState(profile.preferences.distressPhrase);
  const [fakeCallerName, setFakeCallerName] = useState(profile.preferences.fakeCallerName);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSaveBasic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateProfile({
        fullName,
        mobile,
        preferences: { distressPhrase, fakeCallerName },
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void onUpdateProfile({ photoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
        <div className="flex items-center gap-4">
          <img
            src={profile.photoUrl}
            alt={profile.fullName}
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-500/40"
          />
          <div>
            <h1 className="font-display text-xl font-bold text-white">{profile.fullName}</h1>
            <p className="text-xs text-slate-400">
              {profile.email} · <span className="font-mono-tabular">{profile.mobile}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#10172E] px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Account & SOS Controls */}
        <form
          onSubmit={handleSaveBasic}
          className="space-y-5 rounded-2xl border border-slate-800 bg-[#0D1328] p-5 lg:col-span-6"
        >
          <h2 className="font-display text-base font-semibold text-white">Profile &amp; Safety Triggers</h2>

          <div className="flex items-center gap-4">
            <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800">
              <Upload className="h-3.5 w-3.5 text-violet-300" />
              <span>Change Profile Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="set-name">
                Full Name
              </label>
              <input
                id="set-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="set-mobile">
                Mobile Number
              </label>
              <input
                id="set-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-300">SOS Cancellation Countdown</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Prevents accidental alerts while still allowing instant SOS trigger.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 3, 5, 10].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => void onUpdateProfile({ preferences: { sosCountdownSeconds: sec } })}
                  className={`min-h-[38px] rounded-lg px-3.5 py-1.5 font-mono-tabular text-xs font-semibold ${
                    profile.preferences.sosCountdownSeconds === sec
                      ? 'bg-violet-600 text-white'
                      : 'border border-slate-700 bg-[#070B19] text-slate-300'
                  }`}
                >
                  {sec === 0 ? 'Immediate (0s)' : `${sec} seconds`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-300">Auto-Call on SOS Activation</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Automatically launches your phone dialer when SOS activates (plus automated Twilio voice calls when server secrets are configured).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: 'primary_contact' as const, label: 'Auto-Call Primary Parent' },
                { id: '112' as const, label: 'Auto-Call 112' },
                { id: 'off' as const, label: 'Manual Only' },
              ].map((opt) => {
                const current = profile.preferences.autoCallTarget ?? 'primary_contact';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void onUpdateProfile({ preferences: { autoCallTarget: opt.id } })}
                    className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
                      current === opt.id
                        ? 'bg-violet-600 text-white'
                        : 'border border-slate-700 bg-[#070B19] text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={profile.preferences.autoGatewayCallEnabled !== false}
                onChange={(e) =>
                  void onUpdateProfile({ preferences: { autoGatewayCallEnabled: e.target.checked } })
                }
                className="h-4 w-4 rounded border-slate-600 accent-violet-600"
              />
              <span>Automatically trigger Twilio voice call + SMS when gateway secrets are active</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="set-phrase">
                Voice SOS Distress Phrase
              </label>
              <input
                id="set-phrase"
                type="text"
                value={distressPhrase}
                onChange={(e) => setDistressPhrase(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="set-fakecall">
                Fake Incoming Caller Name
              </label>
              <input
                id="set-fakecall"
                type="text"
                value={fakeCallerName}
                onChange={(e) => setFakeCallerName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{saving ? 'Saving...' : savedNotice ? 'Settings Saved' : 'Save Settings'}</span>
          </button>
        </form>

        {/* Advanced Triggers & Privacy Controls */}
        <div className="space-y-4 lg:col-span-6">
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
            <h2 className="font-display text-base font-semibold text-white">Advanced Emergency Triggers</h2>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070B19] p-3.5">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Vibrate className="h-4 w-4 text-violet-400" />
                  <span>Shake-to-SOS</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Detects rapid phone shaking on supported mobile accelerometers.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTestShakeSos}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Simulate
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void onUpdateProfile({
                      preferences: { shakeToSosEnabled: !profile.preferences.shakeToSosEnabled },
                    })
                  }
                  className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold ${
                    profile.preferences.shakeToSosEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {profile.preferences.shakeToSosEnabled ? 'Enabled' : 'Off'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070B19] p-3.5">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Mic className="h-4 w-4 text-violet-400" />
                  <span>Voice SOS Phrase Listener</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {voiceSupported
                    ? voiceListening
                      ? `Listening explicitly for "${profile.preferences.distressPhrase}"`
                      : 'Requests microphone permission only when turned On.'
                    : 'Web Speech Recognition is unavailable in this browser.'}
                </p>
              </div>
              <button
                type="button"
                disabled={!voiceSupported}
                onClick={() =>
                  void onUpdateProfile({
                    preferences: { voiceSosEnabled: !profile.preferences.voiceSosEnabled },
                  })
                }
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-40 ${
                  profile.preferences.voiceSosEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {profile.preferences.voiceSosEnabled ? 'Listening' : 'Enable'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={onTestSiren}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <Volume2 className="h-4 w-4 text-amber-300" />
                <span>Test Loud Siren</span>
              </button>

              <button
                type="button"
                onClick={onTriggerFakeCall}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <Phone className="h-4 w-4 text-emerald-300" />
                <span>Launch Fake Call</span>
              </button>

              <button
                type="button"
                onClick={() => void onRequestNotifications()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <Activity className="h-4 w-4 text-violet-300" />
                <span>Enable Alerts / Notifications</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
            <div className="flex items-center gap-2 text-white">
              <Lock className="h-4 w-4 text-violet-400" />
              <h2 className="font-display text-base font-semibold">Offline Safety &amp; Privacy Controls</h2>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-300">
              <li>1. If internet is lost, SHE-SHIELD AI retains your trusted contacts and 112 dialing offline.</li>
              <li>2. Your live GPS coordinates are never shared publicly or visible to strangers.</li>
              <li>3. Audio evidence recording only starts when you explicitly tap Record and confirm consent.</li>
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-xs text-slate-400">
                <Shield className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />
                Privacy Accepted · {new Date(profile.consent.privacyAcceptedAt).toLocaleDateString()}
              </span>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-medium text-red-400 hover:text-red-300"
                >
                  Delete Account Data
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onDeleteAccount()}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Delete</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-slate-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
