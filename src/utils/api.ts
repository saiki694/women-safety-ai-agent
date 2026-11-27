import type {
  Coordinates,
  EmergencyIncident,
  GuardianChatMessage,
  PoliceStation,
  SafeJourney,
  ThreatAnalysisResult,
  TrustedContact,
  UserProfile,
} from '../types';

// Auth token kept strictly in JS memory (never written to localStorage/sessionStorage)
let memoryAuthToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryAuthToken = token;
}

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export interface OfflineSafetySnapshot {
  userName: string;
  contacts: TrustedContact[];
  lastCoords: Coordinates | null;
  updatedAt: string;
}

const OFFLINE_CACHE_KEY = 'she_shield_offline_safety_snapshot_v1';

export function saveOfflineSafetySnapshot(snapshot: OfflineSafetySnapshot): void {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineSafetySnapshot(): OfflineSafetySnapshot | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSafetySnapshot;
  } catch {
    return null;
  }
}

export function clearOfflineSafetySnapshot(): void {
  try {
    localStorage.removeItem(OFFLINE_CACHE_KEY);
  } catch {
    // Ignore
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryAuthToken) {
    headers.set('Authorization', `Bearer ${memoryAuthToken}`);
  }

  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export interface AuthSessionResponse {
  token: string;
  profile: UserProfile;
  contacts: TrustedContact[];
  incidents: EmergencyIncident[];
  journeys: SafeJourney[];
}

export const api = {
  health: () => apiFetch<{ ok: boolean; smsGatewayConfigured: boolean }>('/api/health'),

  register: (payload: {
    fullName: string;
    mobile: string;
    email: string;
    password: string;
    photoUrl?: string;
    privacyAccepted: boolean;
    locationConsent?: boolean;
    initialContact?: { name: string; relationship: TrustedContact['relationship']; phone: string };
  }) => apiFetch<AuthSessionResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (email: string, password: string) =>
    apiFetch<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  startSampleSession: () => apiFetch<AuthSessionResponse>('/api/auth/sample-session', { method: 'POST' }),

  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  updateProfile: (patch: Record<string, unknown>) =>
    apiFetch<{ profile: UserProfile }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteAccount: () => apiFetch<{ ok: boolean }>('/api/profile', { method: 'DELETE' }),

  addContact: (payload: {
    name: string;
    relationship: TrustedContact['relationship'];
    phone: string;
    isPrimaryParent?: boolean;
    notes?: string;
  }) =>
    apiFetch<{ contact: TrustedContact; contacts: TrustedContact[] }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteContact: (id: string) =>
    apiFetch<{ contacts: TrustedContact[] }>(`/api/contacts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  triggerSos: (payload: {
    coordinates: Coordinates | null;
    triggerSource: EmergencyIncident['triggerSource'];
    note?: string;
  }) =>
    apiFetch<{ incident: EmergencyIncident; incidents: EmergencyIncident[]; gatewayConfigured: boolean }>(
      '/api/sos/trigger',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  updateSosLocation: (incidentId: string, coordinates: Coordinates) =>
    apiFetch<{ incident: EmergencyIncident }>(`/api/sos/${encodeURIComponent(incidentId)}/location`, {
      method: 'POST',
      body: JSON.stringify({ coordinates }),
    }),

  addIncidentEvidence: (
    incidentId: string,
    payload: {
      text: string;
      audioDataUrl?: string;
      audioDurationSec?: number;
      hasExplicitAudioConsent?: boolean;
    },
  ) =>
    apiFetch<{ incident: EmergencyIncident; incidents: EmergencyIncident[] }>(
      `/api/sos/${encodeURIComponent(incidentId)}/evidence`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  resolveSos: (incidentId: string, status: 'resolved' | 'cancelled' = 'resolved') =>
    apiFetch<{ incident: EmergencyIncident; incidents: EmergencyIncident[] }>(
      `/api/sos/${encodeURIComponent(incidentId)}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
    ),

  startJourney: (payload: {
    destinationName: string;
    destinationCoords: { lat: number; lng: number };
    originCoords: { lat: number; lng: number };
    checkInMinutes: number;
    sharedWithContactIds: string[];
  }) =>
    apiFetch<{ journey: SafeJourney; journeys: SafeJourney[] }>('/api/journeys', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateJourneyStatus: (journeyId: string, status: 'checked_in' | 'overdue' | 'cancelled') =>
    apiFetch<{ journey: SafeJourney; journeys: SafeJourney[] }>(
      `/api/journeys/${encodeURIComponent(journeyId)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
    ),

  nearbyPolice: (lat: number, lng: number) =>
    apiFetch<{ stations: PoliceStation[]; isSimulatedFallback: boolean }>(
      `/api/police/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    ),

  geocode: (q: string) =>
    apiFetch<{ results: Array<{ displayName: string; lat: number; lng: number }> }>(
      `/api/geocode?q=${encodeURIComponent(q)}`,
    ),

  chatGuardian: (payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; text: string }>;
    language: 'en' | 'te' | 'auto';
    context?: {
      lat?: number;
      lng?: number;
      sosActive?: boolean;
      nearestPolice?: string;
      activeDestination?: string;
    };
  }) =>
    apiFetch<{ reply: string; recommendedActions: GuardianChatMessage['recommendedActions'] }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  analyzeMessage: (text: string, language: 'en' | 'te' | 'auto') =>
    apiFetch<ThreatAnalysisResult>('/api/ai/analyze-message', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    }),
};
