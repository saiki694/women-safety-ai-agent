import React, { useState } from 'react';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  LocateFixed,
  Navigation,
  PhoneCall,
  RefreshCw,
  Send,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import type { Coordinates, PoliceStation } from '../types';
import { SafetyMap } from './SafetyMap';

interface LiveMapViewProps {
  coords: Coordinates | null;
  gpsStatus: string;
  policeStations: PoliceStation[];
  onRequestGps: () => void;
  onSetPreviewCoords: (lat: number, lng: number) => void;
}

export const LiveMapView: React.FC<LiveMapViewProps> = ({
  coords,
  gpsStatus,
  policeStations,
  onRequestGps,
  onSetPreviewCoords,
}) => {
  const [copied, setCopied] = useState(false);

  const mapsUrl = coords ? `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}` : '';

  const handleShareLocation = async () => {
    if (!coords) return;
    const text = `My live SHE-SHIELD AI location: ${mapsUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SHE-SHIELD Live Location', text, url: mapsUrl });
        return;
      } catch {
        // Fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Live Location Map</h1>
          <p className="mt-1 text-xs text-slate-400">
            Private real-time GPS positioning · Never published publicly · {gpsStatus}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRequestGps}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <LocateFixed className="h-4 w-4" />
            <span>Update Live GPS</span>
          </button>

          {coords && (
            <>
              <button
                type="button"
                onClick={() => void handleShareLocation()}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
              >
                <Share2 className="h-4 w-4 text-violet-300" />
                <span>{copied ? 'Link Copied' : 'Share Live Location'}</span>
              </button>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4 text-sky-300" />
                <span>Google Maps</span>
              </a>
            </>
          )}
        </div>
      </div>

      <SafetyMap coords={coords} policeStations={policeStations} heightClass="h-[420px] md:h-[500px]" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0D1328] p-4 text-xs text-slate-300">
        <div>
          {coords ? (
            <span>
              Coordinates:{' '}
              <strong className="font-mono-tabular text-white">
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </strong>{' '}
              ({coords.source === 'gps' ? 'Device GPS' : 'Preview Test Coordinates'})
            </span>
          ) : (
            <span>Browser location not granted yet. Allow GPS or test with sample city coordinates:</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSetPreviewCoords(17.4435, 78.3772)}
            className="rounded-lg border border-slate-700 bg-[#070B19] px-3 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            Preview: Hyderabad (HITEC City)
          </button>
          <button
            type="button"
            onClick={() => onSetPreviewCoords(12.9716, 77.5946)}
            className="rounded-lg border border-slate-700 bg-[#070B19] px-3 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            Preview: Bengaluru
          </button>
        </div>
      </div>
    </div>
  );
};

interface PoliceEmergencyViewProps {
  coords: Coordinates | null;
  stations: PoliceStation[];
  isSimulatedFallback: boolean;
  loading: boolean;
  onRefresh: () => void;
  onRequestGps: () => void;
}

export const PoliceEmergencyView: React.FC<PoliceEmergencyViewProps> = ({
  coords,
  stations,
  isSimulatedFallback,
  loading,
  onRefresh,
  onRequestGps,
}) => {
  const [copiedPoliceMsg, setCopiedPoliceMsg] = useState(false);

  const mapsLink = coords
    ? `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`
    : 'Location unavailable';
  const preparedPoliceMsg = `EMERGENCY ASSISTANCE NEEDED. Time: ${new Date().toLocaleString()}. My current location is: ${mapsLink}. Please respond immediately.`;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(preparedPoliceMsg);
      setCopiedPoliceMsg(true);
      setTimeout(() => setCopiedPoliceMsg(false), 2500);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Direct 112 Police Emergency Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-red-500/50 bg-gradient-to-r from-red-950/80 to-[#0D1328] p-6">
        <div>
          <p className="text-xs font-semibold text-red-300">National Emergency Helpline · India</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-white">Police Emergency &amp; Nearby Stations</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-200">
            Important: This app does not automatically transmit alerts to police stations. Always call{' '}
            <strong>112</strong> directly or contact a verified station phone number below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="tel:112"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-red-500"
          >
            <PhoneCall className="h-4 w-4" />
            <span>Call 112 Emergency</span>
          </a>
          <a
            href="tel:1091"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-700 bg-[#10172E] px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <ShieldAlert className="h-4 w-4 text-amber-300" />
            <span>Women Helpline 1091</span>
          </a>
        </div>
      </div>

      {isSimulatedFallback && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/35 p-4 text-xs text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Live OpenStreetMap police data was unavailable or returned zero entries here, so clearly labeled{' '}
            <strong>Demo Reference</strong> stations are shown. Tap <strong>Call 112</strong> for real police dispatch.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Nearby Police Stations ({stations.length})
            </h2>
            <div className="flex items-center gap-2">
              {!coords && (
                <button
                  type="button"
                  onClick={onRequestGps}
                  className="min-h-[36px] rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
                >
                  Use My GPS
                </button>
              )}
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#10172E] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {stations.map((station) => (
              <div
                key={station.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono-tabular font-semibold text-sky-300">{station.distanceKm} km away</span>
                    <span aria-hidden="true">·</span>
                    <span>{station.isVerifiedSource ? 'OpenStreetMap Location' : 'Simulated Demo Reference'}</span>
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold text-white">{station.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{station.address}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {station.phone && (
                    <a
                      href={`tel:${station.phone.replace(/[^+\d]/g, '')}`}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>{station.phone}</span>
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>Navigate</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
            <h2 className="font-display text-base font-semibold text-white">Prepared Police Report Message</h2>
            <p className="mt-1 text-xs text-slate-400">
              Includes your latest GPS coordinates and timestamp so you can paste or text quickly when speaking to
              dispatchers.
            </p>
            <div className="mt-3 rounded-xl border border-slate-800 bg-[#070B19] p-3.5 text-xs leading-relaxed text-slate-200">
              {preparedPoliceMsg}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyMessage()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copiedPoliceMsg ? 'Copied Message' : 'Copy Message'}</span>
              </button>
              <a
                href={`sms:112?body=${encodeURIComponent(preparedPoliceMsg)}`}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-[#10172E] px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Open SMS Draft</span>
              </a>
            </div>
          </div>

          <SafetyMap coords={coords} policeStations={stations} heightClass="h-[280px]" />
        </div>
      </div>
    </div>
  );
};
