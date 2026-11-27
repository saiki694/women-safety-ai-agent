import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  Navigation,
  PhoneCall,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { api } from '../utils/api';
import type { Coordinates, RelationshipRole, SafeJourney, TrustedContact } from '../types';
import { SafetyMap } from './SafetyMap';

interface TrustedContactsViewProps {
  contacts: TrustedContact[];
  coords: Coordinates | null;
  onAddContact: (payload: {
    name: string;
    relationship: RelationshipRole;
    phone: string;
    notes?: string;
  }) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
}

export const TrustedContactsView: React.FC<TrustedContactsViewProps> = ({
  contacts,
  coords,
  onAddContact,
  onDeleteContact,
}) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<RelationshipRole>('Father');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapsLink = coords
    ? `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`
    : 'Location pending';
  const emergencyMsg = `EMERGENCY! I NEED HELP. My current location is: ${mapsLink}. Please contact me immediately. This is an SOS alert from SHE-SHIELD AI.`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onAddContact({ name, relationship, phone, notes: notes || undefined });
      setName('');
      setPhone('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save contact.');
    } finally {
      setSaving(false);
    }
  };

  const parents = contacts.filter(
    (c) => c.isPrimaryParent || c.relationship === 'Father' || c.relationship === 'Mother',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Trusted Family &amp; Contacts</h1>
          <p className="mt-1 text-xs text-slate-400">
            Saved locally for offline emergency dialing and included in SOS alerts.
          </p>
        </div>

        {parents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {parents.map((p) => (
              <a
                key={p.id}
                href={`tel:${p.phone.replace(/[^+\d]/g, '')}`}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Call {p.relationship}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5 lg:col-span-5"
        >
          <div className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5 text-violet-400" />
            <h2 className="font-display text-base font-semibold">Add Trusted Contact</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300" htmlFor="c-name">
              Full Name
            </label>
            <input
              id="c-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Srinivas Rao"
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="c-rel">
                Relationship
              </label>
              <select
                id="c-rel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as RelationshipRole)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Brother">Brother</option>
                <option value="Sister">Sister</option>
                <option value="Trusted Friend">Trusted Friend</option>
                <option value="Partner">Partner</option>
                <option value="Colleague">Colleague</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="c-phone">
                Mobile Number
              </label>
              <input
                id="c-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98490 00000"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300" htmlFor="c-notes">
              Optional Note
            </label>
            <input
              id="c-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Lives 10 mins away"
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Trusted Contact'}</span>
          </button>
        </form>

        <div className="space-y-3 lg:col-span-7">
          {contacts.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0D1328] p-8 text-center">
              <p className="text-sm font-semibold text-white">No trusted contacts added yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Add your Father, Mother, Brother, Sister, or Trusted Friends so SOS alerts can reach them.
              </p>
            </div>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-violet-300">{contact.relationship}</span>
                    {contact.notes && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{contact.notes}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-0.5 font-display text-base font-semibold text-white">{contact.name}</h3>
                  <p className="font-mono-tabular text-xs text-slate-300">{contact.phone}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`sms:${contact.phone.replace(/[^+\d]/g, '')}?body=${encodeURIComponent(emergencyMsg)}`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-[#10172E] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    <Send className="h-3.5 w-3.5 text-violet-300" />
                    <span>SMS</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void onDeleteContact(contact.id)}
                    aria-label={`Remove ${contact.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#070B19] text-slate-400 hover:border-red-500/40 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface SafeJourneyViewProps {
  coords: Coordinates | null;
  contacts: TrustedContact[];
  activeJourney: SafeJourney | null;
  journeys: SafeJourney[];
  onStartJourney: (payload: {
    destinationName: string;
    destinationCoords: { lat: number; lng: number };
    originCoords: { lat: number; lng: number };
    checkInMinutes: number;
    sharedWithContactIds: string[];
  }) => Promise<void>;
  onUpdateJourneyStatus: (journeyId: string, status: 'checked_in' | 'cancelled') => Promise<void>;
  onTriggerSos: () => void;
  onRequestGps: () => void;
}

const PRESET_DESTINATIONS = [
  { displayName: 'HITEC City Metro Station, Hyderabad', lat: 17.4488, lng: 78.3831 },
  { displayName: 'Secunderabad Railway Station, Hyderabad', lat: 17.4344, lng: 78.5013 },
  { displayName: 'MG Road Metro Station, Bengaluru', lat: 12.9756, lng: 77.6066 },
];

export const SafeJourneyView: React.FC<SafeJourneyViewProps> = ({
  coords,
  contacts,
  activeJourney,
  journeys,
  onStartJourney,
  onUpdateJourneyStatus,
  onTriggerSos,
  onRequestGps,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ displayName: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDest, setSelectedDest] = useState<{ displayName: string; lat: number; lng: number } | null>(null);
  const [checkInMinutes, setCheckInMinutes] = useState(25);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(() => contacts.slice(0, 2).map((c) => c.id));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedFeedback, setSharedFeedback] = useState(false);

  const handleSearchPlaces = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await api.geocode(searchQuery.trim());
      setSearchResults(res.results);
    } finally {
      setSearching(false);
    }
  };

  const toggleContactShare = (id: string) => {
    setSelectedContactIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleStart = async () => {
    if (!selectedDest) {
      setError('Select a destination first.');
      return;
    }
    const origin = coords ?? { lat: 17.4435, lng: 78.3772 };
    setError(null);
    setStarting(true);
    try {
      await onStartJourney({
        destinationName: selectedDest.displayName,
        destinationCoords: { lat: selectedDest.lat, lng: selectedDest.lng },
        originCoords: { lat: origin.lat, lng: origin.lng },
        checkInMinutes,
        sharedWithContactIds: selectedContactIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start safe journey.');
    } finally {
      setStarting(false);
    }
  };

  const handleShareJourney = async () => {
    if (!activeJourney) return;
    const text = `SHE-SHIELD Safe Journey: Heading to ${activeJourney.destinationName}. Expected check-in by ${new Date(
      activeJourney.expectedArrivalIso,
    ).toLocaleTimeString()}. Live start point: https://www.google.com/maps?q=${activeJourney.originCoords.lat},${activeJourney.originCoords.lng}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'SHE-SHIELD Safe Journey', text });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setSharedFeedback(true);
      setTimeout(() => setSharedFeedback(false), 2500);
    } catch {
      // Ignore
    }
  };

  const remainingMin = activeJourney
    ? Math.max(0, Math.ceil((new Date(activeJourney.expectedArrivalIso).getTime() - Date.now()) / 60_000))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Safe Journey &amp; Route Tracker</h1>
          <p className="mt-1 text-xs text-slate-400">
            Plan your destination, share your route, and trigger an automatic alert if you miss your check-in.
          </p>
        </div>

        <button
          type="button"
          onClick={onTriggerSos}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-500"
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Emergency SOS</span>
        </button>
      </div>

      {activeJourney ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-2xl border border-violet-500/40 bg-[#0D1328] p-6 lg:col-span-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-300">
              <Compass className="h-4 w-4" />
              <span>{activeJourney.status === 'overdue' ? 'CHECK-IN OVERDUE — ALERT TRIGGERED' : 'ACTIVE SAFE JOURNEY'}</span>
            </div>
            <h2 className="font-display text-xl font-bold text-white">{activeJourney.destinationName}</h2>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-[#070B19] p-4 text-xs">
              <div>
                <p className="text-slate-400">Distance / Route ETA</p>
                <p className="mt-1 font-mono-tabular text-base font-semibold text-white">
                  {activeJourney.distanceKm} km · {activeJourney.estimatedMinutes}m
                </p>
              </div>
              <div>
                <p className="text-slate-400">Check-In Deadline</p>
                <p className="mt-1 font-mono-tabular text-base font-semibold text-amber-300">
                  {remainingMin}m left
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => void onUpdateJourneyStatus(activeJourney.id, 'checked_in')}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>I&apos;ve Arrived — Check In Safe</span>
              </button>

              <button
                type="button"
                onClick={() => void handleShareJourney()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Share2 className="h-4 w-4 text-violet-300" />
                <span>{sharedFeedback ? 'Journey Details Copied' : 'Share Journey with Family'}</span>
              </button>

              <button
                type="button"
                onClick={() => void onUpdateJourneyStatus(activeJourney.id, 'cancelled')}
                className="min-h-[40px] rounded-xl border border-slate-800 px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel Journey
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <SafetyMap
              coords={coords ?? { ...activeJourney.originCoords, timestamp: activeJourney.startedAt, source: 'manual_preview' }}
              routeCoordinates={activeJourney.routeCoordinates}
              destination={{ ...activeJourney.destinationCoords, name: activeJourney.destinationName }}
              heightClass="h-[400px]"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5 lg:col-span-5">
            <h2 className="font-display text-base font-semibold text-white">Plan Your Safe Route</h2>

            {!coords && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-amber-950/30 p-3 text-xs text-amber-100">
                <span>Enable GPS for accurate start point.</span>
                <button
                  type="button"
                  onClick={onRequestGps}
                  className="rounded-lg bg-amber-500 px-3 py-1 font-semibold text-slate-950"
                >
                  Allow GPS
                </button>
              </div>
            )}

            <form onSubmit={handleSearchPlaces} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search destination (metro, college, street)..."
                className="min-h-[42px] flex-1 rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-700"
              >
                <Search className="h-3.5 w-3.5" />
                <span>{searching ? '...' : 'Find'}</span>
              </button>
            </form>

            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">
                {searchResults.length > 0 ? 'Search Results' : 'Quick Destination Examples'}
              </p>
              {(searchResults.length > 0 ? searchResults : PRESET_DESTINATIONS).map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDest(item)}
                  className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left text-xs transition-colors ${
                    selectedDest?.displayName === item.displayName
                      ? 'border-violet-500 bg-violet-950/40 text-white'
                      : 'border-slate-800 bg-[#070B19] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                  <span className="line-clamp-2">{item.displayName}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="checkin-mins">
                <Clock className="h-3.5 w-3.5 text-violet-300" />
                <span>Expected Arrival / Check-In Timer (minutes)</span>
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[15, 25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setCheckInMinutes(mins)}
                    className={`min-h-[36px] rounded-lg px-3 py-1.5 font-mono-tabular text-xs font-semibold ${
                      checkInMinutes === mins
                        ? 'bg-violet-600 text-white'
                        : 'border border-slate-700 bg-[#070B19] text-slate-300'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {contacts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-300">Notify if Check-In Missed</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contacts.map((c) => {
                    const checked = selectedContactIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleContactShare(c.id)}
                        className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-xs ${
                          checked
                            ? 'border-violet-500 bg-violet-950/50 text-violet-200'
                            : 'border-slate-800 bg-[#070B19] text-slate-400'
                        }`}
                      >
                        {c.name} ({c.relationship})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-300">{error}</p>}

            <button
              type="button"
              disabled={starting || !selectedDest}
              onClick={() => void handleStart()}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Navigation className="h-4 w-4" />
              <span>{starting ? 'Calculating Safe Route...' : 'Start Safe Journey Tracker'}</span>
            </button>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <SafetyMap
              coords={coords}
              destination={selectedDest ? { lat: selectedDest.lat, lng: selectedDest.lng, name: selectedDest.displayName } : null}
              heightClass="h-[380px]"
            />

            {journeys.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-[#0D1328] p-4">
                <h3 className="text-xs font-semibold text-slate-300">Recent Safe Journeys</h3>
                <div className="mt-2.5 space-y-2">
                  {journeys.slice(0, 3).map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#070B19] px-3 py-2 text-xs"
                    >
                      <span className="truncate text-slate-200">{j.destinationName}</span>
                      <span className="font-mono-tabular text-slate-400 shrink-0">
                        {j.status.replace('_', ' ')} · {new Date(j.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
