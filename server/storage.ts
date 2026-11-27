import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  EmergencyIncident,
  SafeJourney,
  SafetyPreferences,
  TrustedContact,
  UserPermissionsConsent,
  UserProfile,
} from '../src/types.ts';

interface StoredUserRecord {
  profile: UserProfile;
  passwordSalt: string;
  passwordHash: string;
  contacts: TrustedContact[];
  incidents: EmergencyIncident[];
  journeys: SafeJourney[];
}

interface EncryptedStorePayload {
  version: number;
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface StoreData {
  users: Record<string, StoredUserRecord>;
  sessions: Record<string, { userId: string; expiresAt: number }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'she_shield_store.json');
const KEY_PATH = path.join(DATA_DIR, '.key');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function getEncryptionKey(): Buffer {
  const envSecret = process.env.ENCRYPTION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }
  ensureDataDir();
  if (fs.existsSync(KEY_PATH)) {
    const hex = fs.readFileSync(KEY_PATH, 'utf8').trim();
    if (/^[a-f0-9]{64}$/i.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, key.toString('hex'), { mode: 0o600 });
  return key;
}

const ENCRYPTION_KEY = getEncryptionKey();

function encryptText(plaintext: string): EncryptedStorePayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    version: 1,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

function decryptText(payload: EncryptedStorePayload): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

const DEFAULT_PREFERENCES: SafetyPreferences = {
  sosCountdownSeconds: 5,
  shakeToSosEnabled: true,
  voiceSosEnabled: false,
  distressPhrase: 'help me shield',
  sirenEnabled: true,
  preferredLanguage: 'auto',
  fakeCallerName: 'Amma (Mom)',
  fakeCallerLabel: 'Mobile · Calling...',
  autoCallTarget: 'primary_contact',
  autoGatewayCallEnabled: true,
};

function buildSampleUser(): StoredUserRecord {
  const id = 'user-sample-ananya';
  const now = new Date().toISOString();
  const { salt, hash } = hashPassword('SampleSafety#2026');
  const profile: UserProfile = {
    id,
    fullName: 'Ananya Rao',
    mobile: '+91 98490 11223',
    email: 'ananya@sheshield.app',
    photoUrl: '/src/assets/images/user_profile_avatar_1795711489913.jpg',
    isDemoProfile: true,
    consent: {
      privacyAccepted: true,
      privacyAcceptedAt: now,
      locationConsent: true,
      microphoneConsent: false,
      notificationsConsent: false,
    },
    preferences: { ...DEFAULT_PREFERENCES },
    createdAt: now,
  };

  const contacts: TrustedContact[] = [
    {
      id: 'c-father',
      name: 'Srinivas Rao',
      relationship: 'Father',
      phone: '+91 98490 44556',
      isPrimaryParent: true,
      notes: 'Primary emergency parent contact',
      createdAt: now,
    },
    {
      id: 'c-mother',
      name: 'Lakshmi Rao',
      relationship: 'Mother',
      phone: '+91 98490 77889',
      isPrimaryParent: true,
      notes: 'Home landline backup available',
      createdAt: now,
    },
    {
      id: 'c-sister',
      name: 'Kavya Rao',
      relationship: 'Sister',
      phone: '+91 97012 33445',
      isPrimaryParent: false,
      createdAt: now,
    },
    {
      id: 'c-friend',
      name: 'Meera Reddy',
      relationship: 'Trusted Friend',
      phone: '+91 99891 55667',
      isPrimaryParent: false,
      notes: 'Colleague from Madhapur campus',
      createdAt: now,
    },
  ];

  const sampleIncidentTime = new Date(Date.now() - 86400000 * 3).toISOString();
  const incidents: EmergencyIncident[] = [
    {
      id: 'inc-drill-01',
      triggerSource: 'manual_log',
      status: 'resolved',
      startedAt: sampleIncidentTime,
      resolvedAt: new Date(Date.now() - 86400000 * 3 + 420000).toISOString(),
      coordinates: {
        lat: 17.4435,
        lng: 78.3772,
        accuracy: 18,
        timestamp: sampleIncidentTime,
        source: 'manual_preview',
      },
      locationHistory: [
        {
          lat: 17.4435,
          lng: 78.3772,
          accuracy: 18,
          timestamp: sampleIncidentTime,
          source: 'manual_preview',
        },
      ],
      googleMapsLink: 'https://www.google.com/maps?q=17.4435,78.3772',
      emergencyMessage:
        'Sample readiness drill near HITEC City Metro. Verified family phone numbers and safe drop-off point.',
      deliveries: [],
      evidenceNotes: [
        {
          id: 'note-drill-01',
          text: 'Tested SOS siren and confirmed parent phone numbers are reachable.',
          createdAt: sampleIncidentTime,
        },
      ],
    },
  ];

  return {
    profile,
    passwordSalt: salt,
    passwordHash: hash,
    contacts,
    incidents,
    journeys: [],
  };
}

let storeCache: StoreData | null = null;

function loadStore(): StoreData {
  if (storeCache) return storeCache;
  ensureDataDir();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as EncryptedStorePayload;
      const decrypted = decryptText(parsed);
      const data = JSON.parse(decrypted) as StoreData;
      // Clean expired sessions & backfill new preference defaults
      const now = Date.now();
      for (const [token, session] of Object.entries(data.sessions)) {
        if (session.expiresAt < now) {
          delete data.sessions[token];
        }
      }
      for (const user of Object.values(data.users)) {
        user.profile.preferences = { ...DEFAULT_PREFERENCES, ...user.profile.preferences };
      }
      storeCache = data;
      return data;
    } catch {
      // If key changed or file corrupted, re-initialize cleanly
    }
  }
  const sample = buildSampleUser();
  storeCache = {
    users: {
      [sample.profile.id]: sample,
    },
    sessions: {},
  };
  persistStore(storeCache);
  return storeCache;
}

function persistStore(data: StoreData): void {
  ensureDataDir();
  const payload = encryptText(JSON.stringify(data));
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload), { mode: 0o600 });
  fs.renameSync(tmpPath, STORE_PATH);
}

export function createSession(userId: string): string {
  const store = loadStore();
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions[token] = {
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  persistStore(store);
  return token;
}

export function getUserBySessionToken(token: string | undefined): StoredUserRecord | null {
  if (!token) return null;
  const store = loadStore();
  const session = store.sessions[token];
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      delete store.sessions[token];
      persistStore(store);
    }
    return null;
  }
  return store.users[session.userId] ?? null;
}

export function revokeSession(token: string): void {
  const store = loadStore();
  if (store.sessions[token]) {
    delete store.sessions[token];
    persistStore(store);
  }
}

export function getSampleUserProfile(): StoredUserRecord {
  const store = loadStore();
  const existing = store.users['user-sample-ananya'];
  if (existing) return existing;
  const sample = buildSampleUser();
  store.users[sample.profile.id] = sample;
  persistStore(store);
  return sample;
}

export function findUserByEmail(email: string): StoredUserRecord | null {
  const store = loadStore();
  const normalized = email.trim().toLowerCase();
  for (const user of Object.values(store.users)) {
    if (user.profile.email.trim().toLowerCase() === normalized) {
      return user;
    }
  }
  return null;
}

export function registerNewUser(input: {
  fullName: string;
  mobile: string;
  email: string;
  password: string;
  photoUrl?: string;
  initialContact?: {
    name: string;
    relationship: TrustedContact['relationship'];
    phone: string;
  };
  consent: UserPermissionsConsent;
}): StoredUserRecord {
  const store = loadStore();
  const id = `user-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const { salt, hash } = hashPassword(input.password);
  const profile: UserProfile = {
    id,
    fullName: input.fullName.trim(),
    mobile: input.mobile.trim(),
    email: input.email.trim().toLowerCase(),
    photoUrl: input.photoUrl?.trim() || '/src/assets/images/user_profile_avatar_1795711489913.jpg',
    isDemoProfile: false,
    consent: input.consent,
    preferences: { ...DEFAULT_PREFERENCES },
    createdAt: now,
  };

  const contacts: TrustedContact[] = [];
  if (input.initialContact && input.initialContact.name.trim() && input.initialContact.phone.trim()) {
    contacts.push({
      id: `c-${crypto.randomUUID()}`,
      name: input.initialContact.name.trim(),
      relationship: input.initialContact.relationship,
      phone: input.initialContact.phone.trim(),
      isPrimaryParent:
        input.initialContact.relationship === 'Father' || input.initialContact.relationship === 'Mother',
      createdAt: now,
    });
  }

  const record: StoredUserRecord = {
    profile,
    passwordSalt: salt,
    passwordHash: hash,
    contacts,
    incidents: [],
    journeys: [],
  };

  store.users[id] = record;
  persistStore(store);
  return record;
}

export function updateUserRecord(userId: string, mutator: (record: StoredUserRecord) => void): StoredUserRecord | null {
  const store = loadStore();
  const record = store.users[userId];
  if (!record) return null;
  mutator(record);
  persistStore(store);
  return record;
}

export function deleteUserAccount(userId: string): boolean {
  const store = loadStore();
  if (!store.users[userId]) return false;
  delete store.users[userId];
  for (const [token, session] of Object.entries(store.sessions)) {
    if (session.userId === userId) {
      delete store.sessions[token];
    }
  }
  persistStore(store);
  return true;
}
