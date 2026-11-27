import React from 'react';
import {
  Bot,
  Check,
  ChevronRight,
  Compass,
  FileAudio,
  LocateFixed,
  MapPin,
  Mic,
  Phone,
  PhoneCall,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Users,
  Vibrate,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  AppView,
  Coordinates,
  EmergencyIncident,
  PoliceStation,
  SafeJourney,
  TrustedContact,
  UserProfile,
} from '../types';

interface MainDashboardViewProps {
  profile: UserProfile;
  isOnline: boolean;
  coords: Coordinates | null;
  gpsStatus: string;
  activeIncident: EmergencyIncident | null;
  activeJourney: SafeJourney | null;
  contacts: TrustedContact[];
  policeStations: PoliceStation[];
  sirenPlaying: boolean;
  voiceListening: boolean;
  shareFeedback?: boolean;
  onTriggerSos: () => void;
  onToggleSiren: () => void;
  onTriggerFakeCall: () => void;
  onRequestGps: () => void;
  onQuickShareLocation: () => void;
  onOpenVoiceReport: () => void;
  onOpenRecordEvidence: () => void;
  onNavigate: (view: AppView) => void;
}

export const MainDashboardView: React.FC<MainDashboardViewProps> = ({
  profile,
  isOnline,
  coords,
  gpsStatus,
  activeIncident,
  activeJourney,
  contacts,
  policeStations,
  sirenPlaying,
  voiceListening,
  shareFeedback = false,
  onTriggerSos,
  onToggleSiren,
  onTriggerFakeCall,
  onRequestGps,
  onQuickShareLocation,
  onOpenVoiceReport,
  onOpenRecordEvidence,
  onNavigate,
}) => {
  const nearestPolice = policeStations[0];
  const parentContact = contacts.find(
    (c) => c.isPrimaryParent || c.relationship === 'Father' || c.relationship === 'Mother',
  );

  return (
    <div className="space-y-6">
      {/* Top Status & Profile Summary Row */}
      <div className="grid gap-4 rounded-3xl border border-slate-800/90 bg-[#0D1328] p-5 sm:p-6 lg:grid-cols-12 lg:items-center">
        <div className="flex items-center gap-4 lg:col-span-5">
          <img
            src={profile.photoUrl}
            alt={profile.fullName}
            referrerPolicy="no-referrer"
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-violet-500/40"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-violet-300">Protected Profile</p>
            <h1 className="truncate font-display text-xl font-bold text-white">{profile.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 text-slate-200">
                {activeIncident ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                    <span className="font-semibold text-red-300">SOS Active</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-semibold text-emerald-300">Guardian Ready</span>
                  </>
                )}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-sky-400" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-amber-300">Offline Mode</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#070B19] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Current GPS Position</p>
              <p className="mt-0.5 truncate font-mono-tabular text-xs font-semibold text-white">
                {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Location permission needed'}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{gpsStatus}</p>
            </div>
            <button
              type="button"
              onClick={onRequestGps}
              aria-label="Refresh GPS location"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300 hover:bg-violet-600/30"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#070B19] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Active Protection Triggers</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-200">
                <span className="inline-flex items-center gap-1">
                  <Vibrate className="h-3.5 w-3.5 text-violet-400" />
                  <span>Shake {profile.preferences.shakeToSosEnabled ? 'On' : 'Off'}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mic className="h-3.5 w-3.5 text-violet-400" />
                  <span>Voice {voiceListening ? 'Listening' : 'Off'}</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="min-h-[36px] shrink-0 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Central Focal Anchor: Emergency SOS Hub + Quick Emergency Actions */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800/90 bg-gradient-to-b from-[#131836] via-[#0D1328] to-[#080C1B] px-6 py-10 text-center lg:col-span-7">
          <p className="text-xs font-semibold tracking-wide text-slate-300">
            One-Tap Emergency Dispatch · {profile.preferences.sosCountdownSeconds}s Safety Countdown
          </p>

          <div className="relative my-7 flex items-center justify-center">
            <span className="animate-sos-ring pointer-events-none absolute h-52 w-52 rounded-full border-2 border-red-500/45" />
            <span className="animate-shield-breathe pointer-events-none absolute h-48 w-48 rounded-full bg-red-600/20 blur-xl" />
            <button
              type="button"
              onClick={onTriggerSos}
              className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full border-4 border-red-400/70 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_0_45px_rgba(220,38,38,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-red-400"
            >
              <ShieldAlert className="h-11 w-11" />
              <span className="mt-1.5 font-display text-2xl font-bold tracking-wider">SOS</span>
              <span className="mt-0.5 text-[11px] font-medium text-red-100">
                {activeIncident ? 'VIEW ACTIVE SOS' : 'TAP FOR HELP'}
              </span>
            </button>
          </div>

          <p className="max-w-md text-xs leading-relaxed text-slate-300">
            Alerts {contacts.length} trusted {contacts.length === 1 ? 'contact' : 'contacts'}, attaches your live
            Google Maps link, activates the emergency siren, and gives one-tap 112 dialing.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:112"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-500"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Emergency Call 112</span>
            </a>

            <button
              type="button"
              onClick={onTriggerFakeCall}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Phone className="h-4 w-4 text-emerald-400" />
              <span>Fake Incoming Call</span>
            </button>

            <button
              type="button"
              onClick={onToggleSiren}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                sirenPlaying
                  ? 'border-amber-400 bg-amber-500 text-slate-950'
                  : 'border-slate-700 bg-[#10172E] text-slate-100 hover:bg-slate-800'
              }`}
            >
              {sirenPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-amber-300" />}
              <span>{sirenPlaying ? 'Stop Siren' : 'Loud Siren'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Actionable Safety Modules */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {/* AI Safety Assistant */}
          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-4 text-left transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-white">SHE-SHIELD Guardian AI</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  English &amp; తెలుగు safety guidance, unsafe route advice, and scam text scanner.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
          </button>

          {/* Safe Journey Tracker */}
          <button
            type="button"
            onClick={() => onNavigate('journey')}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-4 text-left transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-300">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-white">Safe Journey Tracker</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {activeJourney
                    ? `Active route to ${activeJourney.destinationName}`
                    : 'Set destination, arrival timer, and automatic missed check-in alerts.'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
          </button>

          {/* Nearby Police Stations */}
          <button
            type="button"
            onClick={() => onNavigate('police')}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-4 text-left transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600/20 text-sky-300">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-white">Nearby Police Stations</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {nearestPolice
                    ? `Nearest: ${nearestPolice.name} (${nearestPolice.distanceKm} km)`
                    : 'Find closest police stations, phone numbers, and directions.'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
          </button>

          {/* Trusted Contacts & Quick Parent Dial */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0D1328] p-4">
            <button
              type="button"
              onClick={() => onNavigate('contacts')}
              className="flex min-w-0 flex-1 items-start gap-3.5 text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-600/20 text-amber-300">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-white">
                  Trusted Contacts ({contacts.length})
                </h2>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {contacts.length > 0
                    ? contacts
                        .slice(0, 2)
                        .map((c) => `${c.name} (${c.relationship})`)
                        .join(' · ')
                    : 'Add Father, Mother, Brother, Sister, or Friends'}
                </p>
              </div>
            </button>

            {parentContact && (
              <a
                href={`tel:${parentContact.phone.replace(/[^+\d]/g, '')}`}
                className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Call {parentContact.relationship}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Safety Quick Actions Grid */}
      <section aria-labelledby="safety-quick-actions-heading" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 id="safety-quick-actions-heading" className="font-display text-sm font-semibold text-slate-200 sm:text-base">
            Safety Quick Actions
          </h2>
          <span className="text-xs text-slate-400">Immediate 1-tap response</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <button
            type="button"
            onClick={onQuickShareLocation}
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-[#0D1328] p-3 text-center transition-colors hover:border-sky-500/50 hover:bg-[#121A35] sm:flex-row sm:justify-start sm:gap-3.5 sm:p-4 sm:text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
              {shareFeedback ? <Check className="h-5 w-5 text-emerald-300" /> : <Share2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug text-white sm:text-sm">
                {shareFeedback ? 'Location Shared' : 'Share Live Location'}
              </p>
              <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">
                Copy or send your live Google Maps GPS link
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenVoiceReport}
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-[#0D1328] p-3 text-center transition-colors hover:border-amber-500/50 hover:bg-[#121A35] sm:flex-row sm:justify-start sm:gap-3.5 sm:p-4 sm:text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <Mic className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug text-white sm:text-sm">Voice Report</p>
              <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">
                Dictate incident details with instant SOS option
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenRecordEvidence}
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-[#0D1328] p-3 text-center transition-colors hover:border-red-500/50 hover:bg-[#121A35] sm:flex-row sm:justify-start sm:gap-3.5 sm:p-4 sm:text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-300">
              <FileAudio className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug text-white sm:text-sm">Record Evidence</p>
              <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">
                Capture encrypted audio &amp; timestamped notes
              </p>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
