export type RelationshipRole =
  | 'Father'
  | 'Mother'
  | 'Brother'
  | 'Sister'
  | 'Trusted Friend'
  | 'Partner'
  | 'Colleague';

export interface TrustedContact {
  id: string;
  name: string;
  relationship: RelationshipRole;
  phone: string;
  isPrimaryParent: boolean;
  notes?: string;
  createdAt: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: string;
  source: 'gps' | 'manual_preview';
}

export interface UserPermissionsConsent {
  privacyAccepted: boolean;
  privacyAcceptedAt: string;
  locationConsent: boolean;
  microphoneConsent: boolean;
  notificationsConsent: boolean;
}

export interface SafetyPreferences {
  sosCountdownSeconds: number;
  shakeToSosEnabled: boolean;
  voiceSosEnabled: boolean;
  distressPhrase: string;
  sirenEnabled: boolean;
  preferredLanguage: 'en' | 'te' | 'auto';
  fakeCallerName: string;
  fakeCallerLabel: string;
  autoCallTarget?: 'primary_contact' | '112' | 'off';
  autoGatewayCallEnabled?: boolean;
}

export interface UserProfile {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  photoUrl: string;
  isDemoProfile?: boolean;
  consent: UserPermissionsConsent;
  preferences: SafetyPreferences;
  createdAt: string;
}

export interface ContactDeliveryStatus {
  contactId: string;
  contactName: string;
  relationship: RelationshipRole;
  phone: string;
  status: 'delivered' | 'queued' | 'failed' | 'manual_required';
  provider: 'twilio' | 'manual_sms';
  detail: string;
  smsUri: string;
  callStatus?: 'initiated' | 'queued' | 'failed' | 'manual_required';
  callDetail?: string;
}

export interface IncidentEvidenceNote {
  id: string;
  text: string;
  createdAt: string;
  audioDataUrl?: string;
  audioDurationSec?: number;
  hasExplicitAudioConsent?: boolean;
}

export interface EmergencyIncident {
  id: string;
  triggerSource: 'sos_button' | 'shake' | 'voice' | 'missed_checkin' | 'manual_log';
  status: 'active' | 'resolved' | 'cancelled';
  startedAt: string;
  resolvedAt?: string;
  coordinates: Coordinates | null;
  locationHistory: Coordinates[];
  googleMapsLink: string;
  emergencyMessage: string;
  deliveries: ContactDeliveryStatus[];
  evidenceNotes: IncidentEvidenceNote[];
}

export interface SafeJourney {
  id: string;
  destinationName: string;
  destinationCoords: { lat: number; lng: number };
  originCoords: { lat: number; lng: number };
  expectedArrivalIso: string;
  checkInMinutes: number;
  status: 'active' | 'checked_in' | 'overdue' | 'cancelled';
  startedAt: string;
  checkedInAt?: string;
  sharedWithContactIds: string[];
  routeCoordinates: [number, number][];
  distanceKm: number;
  estimatedMinutes: number;
}

export interface PoliceStation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  phone?: string;
  isVerifiedSource: boolean;
}

export interface GuardianChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  language?: 'en' | 'te' | 'auto';
  recommendedActions?: Array<'call_112' | 'activate_sos' | 'open_police' | 'start_journey' | 'fake_call'>;
}

export interface ThreatAnalysisResult {
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  category: string;
  summary: string;
  redFlags: string[];
  immediateActions: string[];
  recommendEmergencyServices: boolean;
}

export type AppView =
  | 'splash'
  | 'auth'
  | 'dashboard'
  | 'sos'
  | 'assistant'
  | 'map'
  | 'police'
  | 'contacts'
  | 'journey'
  | 'history'
  | 'profile';
