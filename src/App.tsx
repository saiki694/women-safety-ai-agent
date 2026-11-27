import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Compass,
  History,
  Home,
  Map as MapIcon,
  Menu,
  PhoneCall,
  Settings,
  Shield,
  ShieldAlert,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { SafeJourneyView, TrustedContactsView } from './components/ContactsAndJourneyViews';
import { EmergencySosView } from './components/EmergencySosView';
import { FakeCallModal } from './components/FakeCallModal';
import { GuardianAiView } from './components/GuardianAiView';
import { EmergencyHistoryView, ProfileSettingsView } from './components/HistoryAndProfileViews';
import { MainDashboardView } from './components/MainDashboardView';
import { LiveMapView, PoliceEmergencyView } from './components/MapAndPoliceViews';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QuickSafetyCaptureModal, type QuickCaptureMode } from './components/QuickSafetyCaptureModal';
import { SplashAndAuth } from './components/SplashAndAuth';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type {
  AppView,
  Coordinates,
  EmergencyIncident,
  PoliceStation,
  RelationshipRole,
  SafeJourney,
  SafetyPreferences,
  TrustedContact,
  UserProfile,
} from './types';
import {
  api,
  clearOfflineSafetySnapshot,
  loadOfflineSafetySnapshot,
  saveOfflineSafetySnapshot,
  setAuthToken,
  type AuthSessionResponse,
} from './utils/api';
import { safetyAudio } from './utils/audio';

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

export default function App() {
  const isOnline = useOnlineStatus();

  const [view, setView] = useState<AppView>('splash');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [journeys, setJourneys] = useState<SafeJourney[]>([]);

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('Ready to request GPS');
  const [policeStations, setPoliceStations] = useState<PoliceStation[]>([]);
  const [policeFallback, setPoliceFallback] = useState(false);
  const [policeLoading, setPoliceLoading] = useState(false);

  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [pendingTriggerSource, setPendingTriggerSource] = useState<EmergencyIncident['triggerSource']>('sos_button');
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [fakeCallOpen, setFakeCallOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [autoDialNotice, setAutoDialNotice] = useState<string | null>(null);
  const [quickCaptureMode, setQuickCaptureMode] = useState<QuickCaptureMode | null>(null);
  const [shareFeedback, setShareFeedback] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastShakeRef = useRef<number>(0);
  const shakeCountRef = useRef<number>(0);

  const activeIncident = useMemo(
    () => incidents.find((inc) => inc.status === 'active') ?? null,
    [incidents],
  );
  const activeJourney = useMemo(
    () => journeys.find((j) => j.status === 'active' || j.status === 'overdue') ?? null,
    [journeys],
  );

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }, []);

  // Persist non-secret emergency contacts offline for Offline Safety mode
  useEffect(() => {
    if (!profile) return;
    saveOfflineSafetySnapshot({
      userName: profile.fullName,
      contacts,
      lastCoords: coords,
      updatedAt: new Date().toISOString(),
    });
  }, [profile, contacts, coords]);

  const fetchPoliceStations = useCallback(async (lat: number, lng: number) => {
    setPoliceLoading(true);
    try {
      const res = await api.nearbyPolice(lat, lng);
      setPoliceStations(res.stations);
      setPoliceFallback(res.isSimulatedFallback);
    } catch {
      // Keep previous list if offline
    } finally {
      setPoliceLoading(false);
    }
  }, []);

  const requestGpsLocation = useCallback((): Promise<Coordinates | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setGpsStatus('Geolocation unavailable in browser');
        resolve(null);
        return;
      }
      setGpsStatus('Acquiring GPS lock...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next: Coordinates = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: new Date().toISOString(),
            source: 'gps',
          };
          setCoords(next);
          setGpsStatus(`Locked (±${Math.round(pos.coords.accuracy)}m)`);
          void fetchPoliceStations(next.lat, next.lng);
          resolve(next);
        },
        (err) => {
          setGpsStatus(err.code === 1 ? 'GPS permission denied' : 'GPS signal unavailable');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
      );
    });
  }, [fetchPoliceStations]);

  const setPreviewCoords = useCallback(
    (lat: number, lng: number) => {
      const next: Coordinates = {
        lat,
        lng,
        accuracy: 25,
        timestamp: new Date().toISOString(),
        source: 'manual_preview',
      };
      setCoords(next);
      setGpsStatus('Preview test coordinates active');
      void fetchPoliceStations(lat, lng);
    },
    [fetchPoliceStations],
  );

  const handleAuthenticated = useCallback(
    (session: AuthSessionResponse) => {
      setProfile(session.profile);
      setContacts(session.contacts);
      setIncidents(session.incidents);
      setJourneys(session.journeys);
      setView('dashboard');
      if (session.profile.consent.locationConsent) {
        void requestGpsLocation();
      } else {
        // Load baseline preview police stations for initial empty map coordinates until user grants GPS
        void fetchPoliceStations(17.4435, 78.3772);
      }
    },
    [fetchPoliceStations, requestGpsLocation],
  );

  // Execute SOS activation immediately
  const executeSosNow = useCallback(
    async (triggerSource: EmergencyIncident['triggerSource']) => {
      setCountdownRemaining(null);
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      if (profile?.preferences.sirenEnabled !== false) {
        const started = safetyAudio.startSiren();
        setSirenPlaying(started);
      }

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('SHE-SHIELD AI Emergency SOS Active', {
            body: 'Emergency mode activated. Sharing live location and preparing trusted contact alerts.',
          });
        } catch {
          // Ignore notification restrictions in iframe
        }
      }

      const freshCoords = coords ?? (await requestGpsLocation());
      const callTargetPref = profile?.preferences.autoCallTarget ?? 'primary_contact';
      const primaryParent =
        contacts.find((c) => c.isPrimaryParent || c.relationship === 'Father' || c.relationship === 'Mother') ??
        contacts[0];

      const launchDeviceCall = (phone: string, label: string) => {
        try {
          const sanitized = phone.replace(/[^+\d]/g, '');
          const link = document.createElement('a');
          link.href = `tel:${sanitized}`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setAutoDialNotice(`Device phone dialer auto-launched for ${label} (${sanitized}).`);
        } catch {
          setAutoDialNotice(`Tap Call ${label} below to connect immediately.`);
        }
      };

      try {
        const res = await api.triggerSos({
          coordinates: freshCoords,
          triggerSource,
        });
        setIncidents(res.incidents);

        if (res.gatewayConfigured) {
          setAutoDialNotice(
            'Auto-SMS dispatched to all trusted contacts and automated Twilio voice call initiated to your primary contact.',
          );
        } else if (callTargetPref === '112') {
          launchDeviceCall('112', 'Emergency 112');
        } else if (callTargetPref === 'primary_contact') {
          if (primaryParent) {
            launchDeviceCall(primaryParent.phone, `${primaryParent.relationship} (${primaryParent.name})`);
          } else {
            launchDeviceCall('112', 'Emergency 112');
          }
        } else {
          setAutoDialNotice('Auto-dial is turned off in Settings; use Call 112 or Send SMS below.');
        }
      } catch {
        setBannerNotice('Network unavailable — SOS screen active in Offline Mode. Call 112 or dial family below.');
        if (callTargetPref === '112') {
          launchDeviceCall('112', 'Emergency 112');
        } else if (callTargetPref === 'primary_contact' && primaryParent) {
          launchDeviceCall(primaryParent.phone, `${primaryParent.relationship} (${primaryParent.name})`);
        }
      }
      setView('sos');
    },
    [contacts, coords, profile?.preferences.autoCallTarget, profile?.preferences.sirenEnabled, requestGpsLocation],
  );

  const initiateSos = useCallback(
    (triggerSource: EmergencyIncident['triggerSource'] = 'sos_button') => {
      if (activeIncident) {
        setView('sos');
        return;
      }
      const delay = profile?.preferences.sosCountdownSeconds ?? 5;
      setPendingTriggerSource(triggerSource);
      setView('sos');

      if (delay <= 0) {
        void executeSosNow(triggerSource);
        return;
      }

      setCountdownRemaining(delay);
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = window.setInterval(() => {
        setCountdownRemaining((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              window.clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            void executeSosNow(triggerSource);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [activeIncident, executeSosNow, profile?.preferences.sosCountdownSeconds],
  );

  const handleCancelCountdown = () => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownRemaining(null);
    setView('dashboard');
  };

  // Continuous live GPS tracking while Emergency SOS is active
  useEffect(() => {
    if (!activeIncident || typeof navigator === 'undefined' || !navigator.geolocation) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const updated: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
          source: 'gps',
        };
        setCoords(updated);
        setGpsStatus(`Live SOS Lock (±${Math.round(pos.coords.accuracy)}m)`);
        void api.updateSosLocation(activeIncident.id, updated).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeIncident]);

  // Shake-to-SOS device motion listener
  useEffect(() => {
    if (!profile?.preferences.shakeToSosEnabled || typeof window === 'undefined') return;

    const handleMotion = (ev: DeviceMotionEvent) => {
      const acc = ev.accelerationIncludingGravity;
      if (!acc) return;
      const total = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0);
      if (total > 26) {
        const now = Date.now();
        if (now - lastShakeRef.current < 1500) {
          shakeCountRef.current += 1;
        } else {
          shakeCountRef.current = 1;
        }
        lastShakeRef.current = now;
        if (shakeCountRef.current >= 2) {
          shakeCountRef.current = 0;
          initiateSos('shake');
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [initiateSos, profile?.preferences.shakeToSosEnabled]);

  // Voice SOS distress phrase listener (only runs when explicitly enabled by user)
  useEffect(() => {
    if (!profile?.preferences.voiceSosEnabled || !speechSupported) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
      setVoiceListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechCtor) return;

    const rec = new SpeechCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';
    const targetPhrase = profile.preferences.distressPhrase.toLowerCase();

    rec.onresult = (ev) => {
      for (let i = 0; i < ev.results.length; i += 1) {
        const transcript = ev.results[i]?.[0]?.transcript?.toLowerCase() ?? '';
        if (transcript.includes(targetPhrase)) {
          initiateSos('voice');
          break;
        }
      }
    };

    rec.onerror = () => {
      setVoiceListening(false);
    };
    rec.onend = () => {
      setVoiceListening(false);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setVoiceListening(true);
    } catch {
      setVoiceListening(false);
    }

    return () => {
      try {
        rec.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
      setVoiceListening(false);
    };
  }, [initiateSos, profile?.preferences.distressPhrase, profile?.preferences.voiceSosEnabled, speechSupported]);

  // Safe Journey missed check-in monitor
  useEffect(() => {
    if (!activeJourney || activeJourney.status !== 'active') return;
    const id = window.setInterval(() => {
      const deadline = new Date(activeJourney.expectedArrivalIso).getTime();
      if (Date.now() > deadline) {
        void api.updateJourneyStatus(activeJourney.id, 'overdue').then((res) => {
          setJourneys(res.journeys);
        });
        setBannerNotice('Safe Journey check-in time elapsed. Triggering SOS alert to trusted contacts.');
        void executeSosNow('missed_checkin');
      }
    }, 8000);
    return () => window.clearInterval(id);
  }, [activeJourney, executeSosNow]);

  const handleToggleSiren = () => {
    if (sirenPlaying) {
      safetyAudio.stopSiren();
      setSirenPlaying(false);
    } else {
      const ok = safetyAudio.startSiren();
      setSirenPlaying(ok);
    }
  };

  const handleResolveSos = async (status: 'resolved' | 'cancelled') => {
    safetyAudio.stopSiren();
    setSirenPlaying(false);
    if (!activeIncident) {
      setView('dashboard');
      return;
    }
    try {
      const res = await api.resolveSos(activeIncident.id, status);
      setIncidents(res.incidents);
    } finally {
      setView('dashboard');
    }
  };

  const handleUpdateProfile = async (patch: {
    fullName?: string;
    mobile?: string;
    photoUrl?: string;
    preferences?: Partial<SafetyPreferences>;
    consent?: Partial<UserProfile['consent']>;
  }) => {
    const res = await api.updateProfile(patch);
    setProfile(res.profile);
  };

  const handleRequestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setBannerNotice('Browser notifications are not supported on this device.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await handleUpdateProfile({ consent: { notificationsConsent: true } });
      setBannerNotice('Emergency alerts and journey check-in notifications enabled.');
    } else {
      setBannerNotice('Notification permission was declined.');
    }
  };

  const handleLogout = () => {
    safetyAudio.stopSiren();
    safetyAudio.stopRingtone();
    setSirenPlaying(false);
    void api.logout().catch(() => {});
    setAuthToken(null);
    setProfile(null);
    setContacts([]);
    setIncidents([]);
    setJourneys([]);
    setView('auth');
  };

  const handleDeleteAccount = async () => {
    await api.deleteAccount();
    clearOfflineSafetySnapshot();
    handleLogout();
  };

  const handleQuickShareLocation = async () => {
    const activeCoords = coords ?? (await requestGpsLocation());
    if (!activeCoords) {
      setBannerNotice('Enable GPS permission or open Live Map to share your live coordinates.');
      return;
    }
    const mapsUrl = `https://www.google.com/maps?q=${activeCoords.lat.toFixed(6)},${activeCoords.lng.toFixed(6)}`;
    const text = `SHE-SHIELD AI Live Location: ${mapsUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'SHE-SHIELD Live Location', text, url: mapsUrl });
        setShareFeedback(true);
        setTimeout(() => setShareFeedback(false), 2500);
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback(true);
      setBannerNotice(`Live location link copied: ${mapsUrl}`);
      setTimeout(() => setShareFeedback(false), 2500);
    } catch {
      setBannerNotice(`Live GPS ready: ${mapsUrl}`);
    }
  };

  const handleSaveQuickCapture = async (payload: {
    text: string;
    audioDataUrl?: string;
    audioDurationSec?: number;
    hasExplicitAudioConsent?: boolean;
    triggerSosAfter?: boolean;
  }) => {
    let targetIncidentId = activeIncident?.id;
    if (!targetIncidentId) {
      const created = await api.triggerSos({
        coordinates: coords,
        triggerSource: 'manual_log',
        note: payload.text,
      });
      setIncidents(created.incidents);
      targetIncidentId = created.incident.id;
      if (payload.audioDataUrl) {
        const updated = await api.addIncidentEvidence(targetIncidentId, {
          text: payload.text,
          audioDataUrl: payload.audioDataUrl,
          audioDurationSec: payload.audioDurationSec,
          hasExplicitAudioConsent: payload.hasExplicitAudioConsent,
        });
        setIncidents(updated.incidents);
      }
    } else {
      const updated = await api.addIncidentEvidence(targetIncidentId, {
        text: payload.text,
        audioDataUrl: payload.audioDataUrl,
        audioDurationSec: payload.audioDurationSec,
        hasExplicitAudioConsent: payload.hasExplicitAudioConsent,
      });
      setIncidents(updated.incidents);
    }

    if (payload.triggerSosAfter) {
      setQuickCaptureMode(null);
      initiateSos(quickCaptureMode === 'voice' ? 'voice' : 'sos_button');
    } else {
      setBannerNotice('Report & evidence encrypted and saved to Emergency History.');
    }
  };

  if (!profile || view === 'splash' || view === 'auth') {
    return (
      <SplashAndAuth
        mode={view === 'auth' ? 'auth' : 'splash'}
        isOnline={isOnline}
        onNavigateAuth={() => setView('auth')}
        onNavigateSplash={() => setView('splash')}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const navItems: Array<{ id: AppView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'sos', label: 'SOS Screen', icon: ShieldAlert },
    { id: 'assistant', label: 'Guardian AI', icon: Bot },
    { id: 'map', label: 'Live Map', icon: MapIcon },
    { id: 'police', label: 'Nearby Police', icon: Shield },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'journey', label: 'Safe Journey', icon: Compass },
    { id: 'history', label: 'History', icon: History },
    { id: 'profile', label: 'Settings', icon: Settings },
  ];

  const offlineSnapshot = !isOnline ? loadOfflineSafetySnapshot() : null;

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#060A17] text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800/80 bg-[#080D1F] lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-4">
          <img
            src="/src/assets/images/she_shield_emblem_1795711489465.jpg"
            alt="SHE-SHIELD AI"
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-xl object-cover ring-1 ring-violet-400/30"
          />
          <span className="font-display text-lg font-bold tracking-tight text-white">SHE-SHIELD AI</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            const isSosItem = item.id === 'sos' && (Boolean(activeIncident) || countdownRemaining !== null);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? isSosItem
                      ? 'bg-red-600/20 text-red-200 ring-1 ring-red-500/40'
                      : 'bg-violet-600/20 text-white ring-1 ring-violet-500/40'
                    : isSosItem
                      ? 'text-red-300 hover:bg-red-950/40'
                      : 'text-slate-400 hover:bg-[#10172E] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800/80 p-4 space-y-2.5">
          <a
            href="tel:112"
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500"
          >
            <PhoneCall className="h-4 w-4" />
            <span>Emergency Call 112</span>
          </a>
          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex min-h-[100dvh] flex-col lg:pl-64">
        {/* Top Bar (Strictly 3 zones, <= 56px mobile height) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-800/80 bg-[#060A17]/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0 lg:hidden">
            <img
              src="/src/assets/images/she_shield_emblem_1795711489465.jpg"
              alt="SHE-SHIELD AI"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="font-display text-base font-bold text-white">SHE-SHIELD AI</span>
          </div>

          <div className="hidden text-xs text-slate-400 lg:block truncate">
            {navItems.find((n) => n.id === view)?.label} ·{' '}
            {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : gpsStatus}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => initiateSos('sos_button')}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-red-500 whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>{activeIncident ? 'SOS Active' : 'SOS'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open all safety modules"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#10172E] text-slate-200 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Offline Safety Banner */}
        {!isOnline && (
          <div className="border-b border-amber-500/40 bg-amber-950/60 px-4 py-3 text-xs text-amber-100 sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Offline Safety Mode:</strong> Internet unavailable. Saved contacts &amp; 112 calling remain
                  available.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href="tel:112" className="rounded-lg bg-red-600 px-3 py-1 font-semibold text-white">
                  Call 112
                </a>
                {offlineSnapshot?.contacts.slice(0, 2).map((c) => (
                  <a
                    key={c.id}
                    href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}
                    className="rounded-lg border border-amber-400/40 bg-[#070B19] px-2.5 py-1 text-amber-200"
                  >
                    Call {c.relationship}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {bannerNotice && (
          <div className="border-b border-violet-500/30 bg-violet-950/50 px-4 py-2.5 text-xs text-violet-100 sm:px-6">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <span>{bannerNotice}</span>
              <button
                type="button"
                onClick={() => setBannerNotice(null)}
                aria-label="Dismiss notice"
                className="text-violet-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Viewport Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {view === 'dashboard' && (
            <MainDashboardView
              profile={profile}
              isOnline={isOnline}
              coords={coords}
              gpsStatus={gpsStatus}
              activeIncident={activeIncident}
              activeJourney={activeJourney}
              contacts={contacts}
              policeStations={policeStations}
              sirenPlaying={sirenPlaying}
              voiceListening={voiceListening}
              shareFeedback={shareFeedback}
              onTriggerSos={() => initiateSos('sos_button')}
              onToggleSiren={handleToggleSiren}
              onTriggerFakeCall={() => setFakeCallOpen(true)}
              onRequestGps={() => void requestGpsLocation()}
              onQuickShareLocation={() => void handleQuickShareLocation()}
              onOpenVoiceReport={() => setQuickCaptureMode('voice')}
              onOpenRecordEvidence={() => setQuickCaptureMode('evidence')}
              onNavigate={setView}
            />
          )}

          {view === 'sos' && (
            <EmergencySosView
              countdownRemaining={countdownRemaining}
              activeIncident={activeIncident}
              contacts={contacts}
              coords={coords}
              sirenPlaying={sirenPlaying}
              autoDialNotice={autoDialNotice}
              onCancelCountdown={handleCancelCountdown}
              onSkipCountdownNow={() => void executeSosNow(pendingTriggerSource)}
              onToggleSiren={handleToggleSiren}
              onResolveIncident={(st) => void handleResolveSos(st)}
              onSaveEvidence={async (incidentId, payload) => {
                const res = await api.addIncidentEvidence(incidentId, payload);
                setIncidents(res.incidents);
              }}
              onRefreshLocation={() => void requestGpsLocation()}
            />
          )}

          {view === 'assistant' && (
            <GuardianAiView
              language={profile.preferences.preferredLanguage}
              onChangeLanguage={(lang) => void handleUpdateProfile({ preferences: { preferredLanguage: lang } })}
              coords={coords}
              sosActive={Boolean(activeIncident)}
              nearestPolice={policeStations[0]}
              activeDestination={activeJourney?.destinationName}
              onTriggerSos={() => initiateSos('sos_button')}
              onTriggerFakeCall={() => setFakeCallOpen(true)}
              onNavigate={setView}
            />
          )}

          {view === 'map' && (
            <LiveMapView
              coords={coords}
              gpsStatus={gpsStatus}
              policeStations={policeStations}
              onRequestGps={() => void requestGpsLocation()}
              onSetPreviewCoords={setPreviewCoords}
            />
          )}

          {view === 'police' && (
            <PoliceEmergencyView
              coords={coords}
              stations={policeStations}
              isSimulatedFallback={policeFallback}
              loading={policeLoading}
              onRefresh={() => {
                const target = coords ?? { lat: 17.4435, lng: 78.3772 };
                void fetchPoliceStations(target.lat, target.lng);
              }}
              onRequestGps={() => void requestGpsLocation()}
            />
          )}

          {view === 'contacts' && (
            <TrustedContactsView
              contacts={contacts}
              coords={coords}
              onAddContact={async (payload: {
                name: string;
                relationship: RelationshipRole;
                phone: string;
                notes?: string;
              }) => {
                const res = await api.addContact(payload);
                setContacts(res.contacts);
              }}
              onDeleteContact={async (id) => {
                const res = await api.deleteContact(id);
                setContacts(res.contacts);
              }}
            />
          )}

          {view === 'journey' && (
            <SafeJourneyView
              coords={coords}
              contacts={contacts}
              activeJourney={activeJourney}
              journeys={journeys}
              onStartJourney={async (payload) => {
                const res = await api.startJourney(payload);
                setJourneys(res.journeys);
              }}
              onUpdateJourneyStatus={async (journeyId, status) => {
                const res = await api.updateJourneyStatus(journeyId, status);
                setJourneys(res.journeys);
              }}
              onTriggerSos={() => initiateSos('sos_button')}
              onRequestGps={() => void requestGpsLocation()}
            />
          )}

          {view === 'history' && (
            <EmergencyHistoryView
              incidents={incidents}
              coords={coords}
              onCreateEvidenceLog={async (note) => {
                const res = await api.triggerSos({
                  coordinates: coords,
                  triggerSource: 'manual_log',
                  note,
                });
                setIncidents(res.incidents);
              }}
              onAddEvidence={async (incidentId, payload) => {
                const res = await api.addIncidentEvidence(incidentId, payload);
                setIncidents(res.incidents);
              }}
            />
          )}

          {view === 'profile' && (
            <ProfileSettingsView
              profile={profile}
              voiceSupported={speechSupported}
              voiceListening={voiceListening}
              onUpdateProfile={handleUpdateProfile}
              onTestShakeSos={() => initiateSos('shake')}
              onTestSiren={handleToggleSiren}
              onTriggerFakeCall={() => setFakeCallOpen(true)}
              onRequestNotifications={handleRequestNotifications}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Ergonomic Thumb Tab Bar (compact 60px to preserve >= 85% content space) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-5 items-center border-t border-slate-800/90 bg-[#080D1F]/95 backdrop-blur-md pb-safe lg:hidden"
      >
        {[
          { id: 'dashboard' as AppView, label: 'Home', icon: Home },
          { id: 'assistant' as AppView, label: 'AI Help', icon: Bot },
          { id: 'sos' as AppView, label: 'SOS', icon: ShieldAlert },
          { id: 'police' as AppView, label: 'Police', icon: Shield },
          { id: 'journey' as AppView, label: 'Journey', icon: Compass },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id;
          const isSos = tab.id === 'sos';
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => (isSos ? initiateSos('sos_button') : setView(tab.id))}
              className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                isSos
                  ? 'text-red-400'
                  : active
                    ? 'text-violet-300'
                    : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className={`h-5 w-5 ${isSos ? 'text-red-500' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile Full Modules Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-sm lg:hidden">
          <div className="flex h-full w-72 flex-col border-l border-slate-800 bg-[#080D1F] p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="font-display text-base font-bold text-white">Safety Modules</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium ${
                      view === item.id ? 'bg-violet-600/20 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-800 pt-4">
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}

      {/* Fake Incoming Call Overlay */}
      {fakeCallOpen && (
        <FakeCallModal
          callerName={profile.preferences.fakeCallerName}
          callerLabel={profile.preferences.fakeCallerLabel}
          onClose={() => setFakeCallOpen(false)}
          onTriggerSos={() => initiateSos('sos_button')}
        />
      )}

      {/* Quick Voice Report / Record Evidence Modal */}
      {quickCaptureMode && (
        <QuickSafetyCaptureModal
          mode={quickCaptureMode}
          coords={coords}
          speechSupported={speechSupported}
          onClose={() => setQuickCaptureMode(null)}
          onSaveReport={handleSaveQuickCapture}
        />
      )}
    </div>
  );
}
