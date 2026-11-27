import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  PhoneCall,
  Shield,
  Upload,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { api, loadOfflineSafetySnapshot, setAuthToken, type AuthSessionResponse } from '../utils/api';
import type { RelationshipRole } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SplashAndAuthProps {
  mode: 'splash' | 'auth';
  isOnline: boolean;
  onNavigateAuth: () => void;
  onNavigateSplash: () => void;
  onAuthenticated: (session: AuthSessionResponse) => void;
}

export const SplashAndAuth: React.FC<SplashAndAuthProps> = ({
  mode,
  isOnline,
  onNavigateAuth,
  onNavigateSplash,
  onAuthenticated,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState<RelationshipRole>('Father');
  const [contactPhone, setContactPhone] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offlineSnapshot = loadOfflineSafetySnapshot();

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile photo must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSampleAccess = async () => {
    setError(null);
    setLoading(true);
    try {
      const session = await api.startSampleSession();
      setAuthToken(session.token);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start sample session.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let session: AuthSessionResponse;
      if (authTab === 'login') {
        session = await api.login(email, password);
      } else {
        session = await api.register({
          fullName,
          mobile,
          email,
          password,
          photoUrl: photoUrl || undefined,
          privacyAccepted,
          locationConsent,
          initialContact:
            contactName.trim() && contactPhone.trim()
              ? { name: contactName.trim(), relationship: contactRole, phone: contactPhone.trim() }
              : undefined,
        });
      }
      setAuthToken(session.token);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'splash') {
    return (
      <div className="min-h-[100dvh] overflow-x-hidden bg-[#060A17] text-slate-100">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-8 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-2.5 whitespace-nowrap shrink-0">
            <img
              src="/src/assets/images/she_shield_emblem_1795711489465.jpg"
              alt="SHE-SHIELD AI emblem"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-xl object-cover ring-1 ring-violet-400/30"
            />
            <span className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
              SHE-SHIELD AI
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:inline-flex">
              <PWAInstallButton compact />
            </div>
            <a
              href="tel:112"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 sm:px-4 whitespace-nowrap shrink-0"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Emergency 112</span>
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-16 pt-2 sm:px-6 sm:pt-4">
          {!isOnline && (
            <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
              <div className="flex items-center gap-2 font-semibold">
                <WifiOff className="h-4 w-4 text-amber-400" />
                <span>Offline Mode Active — Saved Emergency Contacts Available</span>
              </div>
              <p className="mt-1 text-xs text-amber-200/90">
                Internet connectivity is unavailable. You can still call 112 or dial your cached trusted contacts below.
              </p>
              {offlineSnapshot && Array.isArray(offlineSnapshot.contacts) && offlineSnapshot.contacts.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {offlineSnapshot.contacts.map((c) => (
                    <a
                      key={c.id}
                      href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}
                      className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-[#0A1022] px-3 py-2 text-xs text-white"
                    >
                      <span>
                        {c.name} · {c.relationship}
                      </span>
                      <span className="font-mono-tabular text-amber-300">{c.phone}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid items-stretch gap-6 sm:gap-8 lg:grid-cols-12">
            <div className="flex flex-col justify-between rounded-3xl border border-slate-800/80 bg-[#0D1328] p-5 sm:p-10 lg:col-span-7">
              <div>
                <p className="text-xs font-medium tracking-wide text-violet-300">
                  Personal AI Safety Guardian · 24/7 Protection
                </p>
                <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:mt-4 sm:max-w-xl sm:text-5xl [text-wrap:balance]">
                  Walk home safely with one-tap SOS and live guardian support
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:mt-5 sm:text-base">
                  &ldquo;Every woman deserves to travel freely, work confidently, and return home safely. SHE-SHIELD AI
                  stands beside her when she needs help the most.&rdquo;
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={onNavigateAuth}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 sm:w-auto whitespace-nowrap shrink-0"
                  >
                    <span>Create Safety Account / Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleSampleAccess()}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#141D3B] px-5 py-3 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:opacity-60 sm:w-auto whitespace-nowrap shrink-0"
                  >
                    <UserCheck className="h-4 w-4 text-violet-300" />
                    <span>{loading ? 'Opening Workspace...' : 'Explore Sample Profile'}</span>
                  </button>

                  <div className="sm:hidden">
                    <PWAInstallButton />
                  </div>
                </div>

                {error && (
                  <p className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2.5 text-xs text-red-200">
                    {error}
                  </p>
                )}
              </div>

              <div className="mt-10 grid gap-4 border-t border-slate-800/80 pt-6 sm:grid-cols-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">One-Tap SOS &amp; 112</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Instant loud siren, live GPS link, family alert workflow, and direct 112 dialing.
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">English &amp; Telugu AI</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    SHE-SHIELD Guardian gives calm emergency guidance and analyzes suspicious scam texts.
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Safe Journey Tracker</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Planned route check-in timer with missed-arrival alerts and nearby police discovery.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[300px] overflow-hidden rounded-3xl border border-slate-800/80 bg-[#0D1328] lg:col-span-5">
              <img
                src="/src/assets/images/safety_guardian_banner_1795711490693.jpg"
                alt="Well-lit urban street at twilight representing safe evening commuting"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060A17] via-[#060A17]/45 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <img
                    src="/src/assets/images/she_shield_emblem_1795711489465.jpg"
                    alt="Shield emblem"
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-2xl object-cover ring-1 ring-violet-400/40"
                  />
                  <div>
                    <p className="font-display text-base font-semibold text-white">Privacy-First Protection</p>
                    <p className="text-xs text-slate-300">
                      Explicit permission prompts · Encrypted records · No secret audio capture
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#060A17] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onNavigateSplash}
            className="flex items-center gap-2.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <img
              src="/src/assets/images/she_shield_emblem_1795711489465.jpg"
              alt="SHE-SHIELD AI"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-xl object-cover"
            />
            <span className="font-display text-base font-bold text-white">SHE-SHIELD AI</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSampleAccess()}
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#10172E] px-3.5 py-2 text-xs font-medium text-violet-200 hover:bg-slate-800 whitespace-nowrap"
          >
            {loading ? 'Loading...' : 'Use Sample Profile'}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-800/90 bg-[#0D1328] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">
                {authTab === 'register' ? 'Create Your Safety Profile' : 'Sign In to SHE-SHIELD AI'}
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Your emergency contacts and incident logs are encrypted on the server.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-[#070B19] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setError(null);
                }}
                className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  authTab === 'register' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setError(null);
                }}
                className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  authTab === 'login' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {authTab === 'register' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor="reg-name">
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g., Priya Sharma"
                      className="mt-1.5 w-full rounded-xl border border-slate-700/90 bg-[#070B19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor="reg-mobile">
                      Mobile Number
                    </label>
                    <input
                      id="reg-mobile"
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="mt-1.5 w-full rounded-xl border border-slate-700/90 bg-[#070B19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Optional Profile Photo
                  </label>
                  <div className="mt-1.5 flex items-center gap-4">
                    <img
                      src={photoUrl || '/src/assets/images/user_profile_avatar_1795711489913.jpg'}
                      alt="Profile preview"
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-700"
                    />
                    <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800">
                      <Upload className="h-3.5 w-3.5 text-violet-300" />
                      <span>Upload Photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="auth-email">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-700/90 bg-[#070B19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300" htmlFor="auth-password">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border border-slate-700/90 bg-[#070B19] py-2.5 pl-3.5 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {authTab === 'register' && (
              <>
                <div className="rounded-2xl border border-slate-800 bg-[#090E20] p-4">
                  <p className="text-xs font-semibold text-white">First Trusted Family Contact (Recommended)</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    You can add Father, Mother, Brother, Sister, and friends later too.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Contact name"
                      className="rounded-xl border border-slate-700/90 bg-[#070B19] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                    <select
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value as RelationshipRole)}
                      className="rounded-xl border border-slate-700/90 bg-[#070B19] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Trusted Friend">Trusted Friend</option>
                    </select>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Phone (+91 ...)"
                      className="rounded-xl border border-slate-700/90 bg-[#070B19] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-800 bg-[#090E20] p-4 text-xs text-slate-300">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 accent-violet-600"
                    />
                    <span>
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={() => setShowPrivacyModal(true)}
                        className="font-semibold text-violet-300 underline hover:text-violet-200"
                      >
                        Privacy Policy &amp; Safety Consent
                      </button>
                      . My live location is never published publicly and permissions are requested only when I activate
                      a feature.
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={locationConsent}
                      onChange={(e) => setLocationConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 accent-violet-600"
                    />
                    <span>Allow GPS location lookup when I use SOS, Map, or Safe Journey Tracker.</span>
                  </label>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              <span>
                {loading
                  ? 'Please wait...'
                  : authTab === 'register'
                    ? 'Create Protected Account'
                    : 'Sign In to Dashboard'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-[#10172E] p-6 text-sm text-slate-300 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white">
                <Shield className="h-5 w-5 text-violet-400" />
                <h2 className="font-display text-lg font-semibold">SHE-SHIELD AI Privacy &amp; Consent Policy</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                aria-label="Close privacy policy"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <strong>Private Live Location:</strong> Your GPS coordinates are never published to a public directory.
                  They are only attached to SOS alerts or Safe Journey records you explicitly start.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <strong>No Secret Recording:</strong> Microphone access for Voice SOS or Evidence Audio is strictly
                  opt-in and displays a visible active indicator while recording.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <strong>Encrypted Storage &amp; Honest Alerts:</strong> Sensitive records are encrypted at rest, and
                  message delivery statuses clearly distinguish confirmed SMS gateway sends from manual device SMS.
                </span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => {
                setPrivacyAccepted(true);
                setShowPrivacyModal(false);
              }}
              className="mt-5 min-h-[44px] w-full rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
            >
              Accept &amp; Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
