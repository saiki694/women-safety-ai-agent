import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { analyzeSuspiciousMessage, chatWithGuardian } from './server/ai.ts';
import { computeSafeRoute, findNearbyPoliceStations, searchPlaces } from './server/geo.ts';
import { dispatchEmergencySms } from './server/sms.ts';
import {
  createSession,
  deleteUserAccount,
  findUserByEmail,
  getSampleUserProfile,
  getUserBySessionToken,
  registerNewUser,
  revokeSession,
  updateUserRecord,
  verifyPassword,
} from './server/storage.ts';
import type {
  Coordinates,
  EmergencyIncident,
  IncidentEvidenceNote,
  RelationshipRole,
  SafeJourney,
  SafetyPreferences,
  TrustedContact,
} from './src/types.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const VALID_ROLES = new Set<RelationshipRole>([
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Trusted Friend',
  'Partner',
  'Colleague',
]);

function extractBearerToken(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return undefined;
  return auth.slice(7).trim();
}

function sanitizeCoordinates(raw: unknown): Coordinates | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const lat = Number(obj.lat);
  const lng = Number(obj.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const accuracy = typeof obj.accuracy === 'number' && Number.isFinite(obj.accuracy) ? obj.accuracy : undefined;
  return {
    lat,
    lng,
    accuracy,
    timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : new Date().toISOString(),
    source: obj.source === 'manual_preview' ? 'manual_preview' : 'gps',
  };
}

function buildMapsLink(coords: Coordinates | null): string {
  if (!coords) return 'Location unavailable — please call immediately';
  return `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
}

function buildEmergencyMessage(coords: Coordinates | null, customNote?: string): string {
  const link = buildMapsLink(coords);
  const base = `EMERGENCY! I NEED HELP. My current location is: ${link}. Please contact me immediately. This is an SOS alert from SHE-SHIELD AI.`;
  return customNote ? `${base} Note: ${customNote}` : base;
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '6mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      smsGatewayConfigured: Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER,
      ),
    });
  });

  // Auth routes
  app.post('/api/auth/register', (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const fullName = String(body.fullName ?? '').trim();
      const mobile = String(body.mobile ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl : undefined;
      const privacyAccepted = Boolean(body.privacyAccepted);

      if (fullName.length < 2) {
        res.status(400).json({ error: 'Please enter your full name.' });
        return;
      }
      if (mobile.length < 7) {
        res.status(400).json({ error: 'Please enter a valid mobile number.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }
      if (!privacyAccepted) {
        res.status(400).json({ error: 'You must accept the privacy policy and data consent notice.' });
        return;
      }
      if (findUserByEmail(email)) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const rawContact = body.initialContact as Record<string, unknown> | undefined;
      const contactRole = String(rawContact?.relationship ?? 'Father') as RelationshipRole;
      const initialContact =
        rawContact && typeof rawContact.name === 'string' && typeof rawContact.phone === 'string'
          ? {
              name: rawContact.name,
              relationship: VALID_ROLES.has(contactRole) ? contactRole : ('Father' as RelationshipRole),
              phone: rawContact.phone,
            }
          : undefined;

      const user = registerNewUser({
        fullName,
        mobile,
        email,
        password,
        photoUrl,
        initialContact,
        consent: {
          privacyAccepted: true,
          privacyAcceptedAt: new Date().toISOString(),
          locationConsent: Boolean(body.locationConsent),
          microphoneConsent: false,
          notificationsConsent: false,
        },
      });

      const token = createSession(user.profile.id);
      res.status(201).json({
        token,
        profile: user.profile,
        contacts: user.contacts,
        incidents: user.incidents,
        journeys: user.journeys,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = createSession(user.profile.id);
    res.json({
      token,
      profile: user.profile,
      contacts: user.contacts,
      incidents: user.incidents,
      journeys: user.journeys,
    });
  });

  app.post('/api/auth/sample-session', (_req, res) => {
    const sample = getSampleUserProfile();
    const token = createSession(sample.profile.id);
    res.json({
      token,
      profile: sample.profile,
      contacts: sample.contacts,
      incidents: sample.incidents,
      journeys: sample.journeys,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) revokeSession(token);
    res.json({ ok: true });
  });

  // Auth guard middleware for user state routes
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const token = extractBearerToken(req);
    const user = getUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    (req as express.Request & { authUserId: string }).authUserId = user.profile.id;
    next();
  };

  app.get('/api/me', requireAuth, (req, res) => {
    const token = extractBearerToken(req);
    const user = getUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: 'Session expired.' });
      return;
    }
    res.json({
      profile: user.profile,
      contacts: user.contacts,
      incidents: user.incidents,
      journeys: user.journeys,
    });
  });

  app.patch('/api/profile', requireAuth, (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const body = req.body as Record<string, unknown>;
    const updated = updateUserRecord(userId, (record) => {
      if (typeof body.fullName === 'string' && body.fullName.trim().length >= 2) {
        record.profile.fullName = body.fullName.trim();
      }
      if (typeof body.mobile === 'string' && body.mobile.trim().length >= 7) {
        record.profile.mobile = body.mobile.trim();
      }
      if (typeof body.photoUrl === 'string' && body.photoUrl.trim()) {
        const photo = body.photoUrl.trim();
        if (photo.startsWith('data:image/') || photo.startsWith('/src/assets/')) {
          record.profile.photoUrl = photo;
        }
      }
      if (body.consent && typeof body.consent === 'object') {
        const c = body.consent as Record<string, unknown>;
        if (typeof c.locationConsent === 'boolean') record.profile.consent.locationConsent = c.locationConsent;
        if (typeof c.microphoneConsent === 'boolean') record.profile.consent.microphoneConsent = c.microphoneConsent;
        if (typeof c.notificationsConsent === 'boolean') record.profile.consent.notificationsConsent = c.notificationsConsent;
      }
      if (body.preferences && typeof body.preferences === 'object') {
        const p = body.preferences as Partial<SafetyPreferences>;
        if (typeof p.sosCountdownSeconds === 'number' && [0, 3, 5, 10].includes(p.sosCountdownSeconds)) {
          record.profile.preferences.sosCountdownSeconds = p.sosCountdownSeconds;
        }
        if (typeof p.shakeToSosEnabled === 'boolean') record.profile.preferences.shakeToSosEnabled = p.shakeToSosEnabled;
        if (typeof p.voiceSosEnabled === 'boolean') record.profile.preferences.voiceSosEnabled = p.voiceSosEnabled;
        if (typeof p.distressPhrase === 'string' && p.distressPhrase.trim().length >= 3) {
          record.profile.preferences.distressPhrase = p.distressPhrase.trim().toLowerCase();
        }
        if (typeof p.sirenEnabled === 'boolean') record.profile.preferences.sirenEnabled = p.sirenEnabled;
        if (p.preferredLanguage && ['en', 'te', 'auto'].includes(p.preferredLanguage)) {
          record.profile.preferences.preferredLanguage = p.preferredLanguage;
        }
        if (typeof p.fakeCallerName === 'string' && p.fakeCallerName.trim()) {
          record.profile.preferences.fakeCallerName = p.fakeCallerName.trim().slice(0, 40);
        }
        if (typeof p.fakeCallerLabel === 'string' && p.fakeCallerLabel.trim()) {
          record.profile.preferences.fakeCallerLabel = p.fakeCallerLabel.trim().slice(0, 40);
        }
        if (p.autoCallTarget && ['primary_contact', '112', 'off'].includes(p.autoCallTarget)) {
          record.profile.preferences.autoCallTarget = p.autoCallTarget;
        }
        if (typeof p.autoGatewayCallEnabled === 'boolean') {
          record.profile.preferences.autoGatewayCallEnabled = p.autoGatewayCallEnabled;
        }
      }
    });
    if (!updated) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({ profile: updated.profile });
  });

  app.delete('/api/profile', requireAuth, (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    deleteUserAccount(userId);
    res.json({ ok: true });
  });

  // Trusted Contacts CRUD
  app.post('/api/contacts', requireAuth, (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const rel = String(body.relationship ?? 'Trusted Friend') as RelationshipRole;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 140) : undefined;

    if (name.length < 2 || phone.length < 7) {
      res.status(400).json({ error: 'Contact name and valid phone number are required.' });
      return;
    }
    const relationship: RelationshipRole = VALID_ROLES.has(rel) ? rel : 'Trusted Friend';
    const isPrimaryParent =
      typeof body.isPrimaryParent === 'boolean'
        ? body.isPrimaryParent
        : relationship === 'Father' || relationship === 'Mother';

    const contact: TrustedContact = {
      id: `c-${crypto.randomUUID()}`,
      name,
      relationship,
      phone,
      isPrimaryParent,
      notes,
      createdAt: new Date().toISOString(),
    };

    const updated = updateUserRecord(userId, (record) => {
      record.contacts.unshift(contact);
    });
    res.status(201).json({ contact, contacts: updated?.contacts ?? [] });
  });

  app.delete('/api/contacts/:id', requireAuth, (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const contactId = req.params.id;
    const updated = updateUserRecord(userId, (record) => {
      record.contacts = record.contacts.filter((c) => c.id !== contactId);
    });
    res.json({ contacts: updated?.contacts ?? [] });
  });

  // SOS Emergency Workflow
  app.post('/api/sos/trigger', requireAuth, async (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const body = req.body as Record<string, unknown>;
    const coords = sanitizeCoordinates(body.coordinates);
    const triggerSource = String(body.triggerSource ?? 'sos_button');
    const customNote = typeof body.note === 'string' ? body.note.trim().slice(0, 240) : undefined;

    const validSources = new Set(['sos_button', 'shake', 'voice', 'missed_checkin', 'manual_log']);
    const normalizedSource = validSources.has(triggerSource)
      ? (triggerSource as EmergencyIncident['triggerSource'])
      : 'sos_button';

    const user = getUserBySessionToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'Session invalid.' });
      return;
    }

    const message = buildEmergencyMessage(coords, customNote);
    const { deliveries, gatewayConfigured } = await dispatchEmergencySms(user.contacts, message, {
      autoCall: user.profile.preferences.autoGatewayCallEnabled !== false,
      userName: user.profile.fullName,
    });

    const incident: EmergencyIncident = {
      id: `inc-${crypto.randomUUID()}`,
      triggerSource: normalizedSource,
      status: normalizedSource === 'manual_log' ? 'resolved' : 'active',
      startedAt: new Date().toISOString(),
      resolvedAt: normalizedSource === 'manual_log' ? new Date().toISOString() : undefined,
      coordinates: coords,
      locationHistory: coords ? [coords] : [],
      googleMapsLink: buildMapsLink(coords),
      emergencyMessage: message,
      deliveries,
      evidenceNotes: customNote
        ? [{ id: `note-${crypto.randomUUID()}`, text: customNote, createdAt: new Date().toISOString() }]
        : [],
    };

    const updated = updateUserRecord(userId, (record) => {
      record.incidents.unshift(incident);
    });

    res.status(201).json({
      incident,
      incidents: updated?.incidents ?? [],
      gatewayConfigured,
    });
  });

  app.post('/api/sos/:id/location', requireAuth, (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const incidentId = req.params.id;
    const coords = sanitizeCoordinates(req.body?.coordinates);
    if (!coords) {
      res.status(400).json({ error: 'Valid coordinates required.' });
      return;
    }

    let target: EmergencyIncident | undefined;
    updateUserRecord(userId, (record) => {
      const inc = record.incidents.find((i) => i.id === incidentId);
      if (inc && inc.status === 'active') {
        inc.coordinates = coords;
        inc.googleMapsLink = buildMapsLink(coords);
        inc.locationHistory.push(coords);
        if (inc.locationHistory.length > 50) {
          inc.locationHistory = inc.locationHistory.slice(-50);
        }
        target = inc;
      }
    });

    if (!target) {
      res.status(404).json({ error: 'Active SOS incident not found.' });
      return;
    }
    res.json({ incident: target });
  });

  app.post('/api/sos/:id/evidence', requireAuth, (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const incidentId = req.params.id;
    const body = req.body as Record<string, unknown>;
    const text = String(body.text ?? '').trim().slice(0, 1000);
    const audioDataUrl =
      typeof body.audioDataUrl === 'string' && body.audioDataUrl.startsWith('data:audio/')
        ? body.audioDataUrl
        : undefined;
    const hasExplicitAudioConsent = Boolean(body.hasExplicitAudioConsent);
    const audioDurationSec = typeof body.audioDurationSec === 'number' ? body.audioDurationSec : undefined;

    if (!text && !audioDataUrl) {
      res.status(400).json({ error: 'Provide an incident note or audio recording.' });
      return;
    }
    if (audioDataUrl && !hasExplicitAudioConsent) {
      res.status(400).json({ error: 'Explicit user consent is required to save audio evidence.' });
      return;
    }

    const note: IncidentEvidenceNote = {
      id: `note-${crypto.randomUUID()}`,
      text: text || 'Audio evidence recorded with explicit consent',
      createdAt: new Date().toISOString(),
      audioDataUrl,
      audioDurationSec,
      hasExplicitAudioConsent: audioDataUrl ? true : undefined,
    };

    let updatedIncident: EmergencyIncident | undefined;
    const updatedUser = updateUserRecord(userId, (record) => {
      const inc = record.incidents.find((i) => i.id === incidentId);
      if (inc) {
        inc.evidenceNotes.unshift(note);
        updatedIncident = inc;
      }
    });

    if (!updatedIncident) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    res.json({ incident: updatedIncident, incidents: updatedUser?.incidents ?? [] });
  });

  app.post('/api/sos/:id/resolve', requireAuth, (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const incidentId = req.params.id;
    const status = req.body?.status === 'cancelled' ? 'cancelled' : 'resolved';

    let target: EmergencyIncident | undefined;
    const updatedUser = updateUserRecord(userId, (record) => {
      const inc = record.incidents.find((i) => i.id === incidentId);
      if (inc) {
        inc.status = status;
        inc.resolvedAt = new Date().toISOString();
        target = inc;
      }
    });

    if (!target) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    res.json({ incident: target, incidents: updatedUser?.incidents ?? [] });
  });

  // Safe Journey Tracker
  app.post('/api/journeys', requireAuth, async (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const body = req.body as Record<string, unknown>;
    const destinationName = String(body.destinationName ?? '').trim();
    const dest = body.destinationCoords as { lat?: number; lng?: number } | undefined;
    const origin = body.originCoords as { lat?: number; lng?: number } | undefined;
    const checkInMinutes = Math.max(2, Math.min(240, Number(body.checkInMinutes || 20)));
    const sharedWithContactIds = Array.isArray(body.sharedWithContactIds)
      ? body.sharedWithContactIds.map(String)
      : [];

    if (
      !destinationName ||
      !dest ||
      !origin ||
      !Number.isFinite(dest.lat) ||
      !Number.isFinite(dest.lng) ||
      !Number.isFinite(origin.lat) ||
      !Number.isFinite(origin.lng)
    ) {
      res.status(400).json({ error: 'Origin, destination name, and destination coordinates are required.' });
      return;
    }

    const route = await computeSafeRoute(origin.lat!, origin.lng!, dest.lat!, dest.lng!);
    const now = Date.now();
    const journey: SafeJourney = {
      id: `jrn-${crypto.randomUUID()}`,
      destinationName,
      destinationCoords: { lat: dest.lat!, lng: dest.lng! },
      originCoords: { lat: origin.lat!, lng: origin.lng! },
      expectedArrivalIso: new Date(now + checkInMinutes * 60_000).toISOString(),
      checkInMinutes,
      status: 'active',
      startedAt: new Date(now).toISOString(),
      sharedWithContactIds,
      routeCoordinates: route.coordinates,
      distanceKm: route.distanceKm,
      estimatedMinutes: route.estimatedMinutes,
    };

    const updated = updateUserRecord(userId, (record) => {
      // Mark previous active journeys cancelled to avoid stale state
      for (const j of record.journeys) {
        if (j.status === 'active') j.status = 'cancelled';
      }
      record.journeys.unshift(journey);
    });

    res.status(201).json({ journey, journeys: updated?.journeys ?? [] });
  });

  app.post('/api/journeys/:id/status', requireAuth, async (req, res) => {
    const userId = (req as express.Request & { authUserId: string }).authUserId;
    const journeyId = req.params.id;
    const nextStatus = req.body?.status;
    if (!['checked_in', 'overdue', 'cancelled'].includes(nextStatus)) {
      res.status(400).json({ error: 'Invalid journey status.' });
      return;
    }

    let updatedJourney: SafeJourney | undefined;
    const updatedUser = updateUserRecord(userId, (record) => {
      const j = record.journeys.find((item) => item.id === journeyId);
      if (j) {
        j.status = nextStatus;
        if (nextStatus === 'checked_in') {
          j.checkedInAt = new Date().toISOString();
        }
        updatedJourney = j;
      }
    });

    if (!updatedJourney) {
      res.status(404).json({ error: 'Journey not found.' });
      return;
    }
    res.json({ journey: updatedJourney, journeys: updatedUser?.journeys ?? [] });
  });

  // Geo & Police discovery routes
  app.get('/api/police/nearby', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
      return;
    }
    const result = await findNearbyPoliceStations(lat, lng);
    res.json(result);
  });

  app.get('/api/geocode', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json({ results: [] });
      return;
    }
    const results = await searchPlaces(q);
    res.json({ results });
  });

  app.get('/api/route', async (req, res) => {
    const fromLat = Number(req.query.fromLat);
    const fromLng = Number(req.query.fromLng);
    const toLat = Number(req.query.toLat);
    const toLng = Number(req.query.toLng);
    if ([fromLat, fromLng, toLat, toLng].some((n) => !Number.isFinite(n))) {
      res.status(400).json({ error: 'Valid origin and destination coordinates are required.' });
      return;
    }
    const route = await computeSafeRoute(fromLat, fromLng, toLat, toLng);
    res.json(route);
  });

  // AI Safety Guardian routes (server-side Gemini SDK)
  app.post('/api/ai/chat', requireAuth, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const message = String(body.message ?? '').trim();
      const language = ['en', 'te', 'auto'].includes(String(body.language))
        ? (String(body.language) as 'en' | 'te' | 'auto')
        : 'auto';
      const history = Array.isArray(body.history)
        ? body.history
            .filter((m): m is { role: 'user' | 'assistant'; text: string } =>
              Boolean(m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string'),
            )
            .slice(-10)
        : [];
      const context = body.context && typeof body.context === 'object' ? (body.context as Record<string, unknown>) : undefined;

      if (!message) {
        res.status(400).json({ error: 'Message cannot be empty.' });
        return;
      }

      const result = await chatWithGuardian({
        message,
        history,
        language,
        context: context
          ? {
              lat: typeof context.lat === 'number' ? context.lat : undefined,
              lng: typeof context.lng === 'number' ? context.lng : undefined,
              sosActive: Boolean(context.sosActive),
              nearestPolice: typeof context.nearestPolice === 'string' ? context.nearestPolice : undefined,
              activeDestination: typeof context.activeDestination === 'string' ? context.activeDestination : undefined,
            }
          : undefined,
      });

      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI assistant request failed.';
      res.status(502).json({ error: msg });
    }
  });

  app.post('/api/ai/analyze-message', requireAuth, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const text = String(body.text ?? '').trim();
      const language = ['en', 'te', 'auto'].includes(String(body.language))
        ? (String(body.language) as 'en' | 'te' | 'auto')
        : 'auto';

      if (text.length < 4) {
        res.status(400).json({ error: 'Enter the suspicious message text to analyze.' });
        return;
      }

      const analysis = await analyzeSuspiciousMessage(text, language);
      res.json(analysis);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Threat analysis failed.';
      res.status(502).json({ error: msg });
    }
  });

  const httpServer = http.createServer(app);

  // Frontend mounting
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SHE-SHIELD AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SHE-SHIELD AI server:', err);
  process.exit(1);
});
