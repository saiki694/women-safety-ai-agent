import React, { useState } from 'react';
import {
  AlertOctagon,
  Compass,
  MapPin,
  Phone,
  PhoneCall,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../utils/api';
import type {
  AppView,
  Coordinates,
  GuardianChatMessage,
  PoliceStation,
  ThreatAnalysisResult,
} from '../types';

interface GuardianAiViewProps {
  language: 'en' | 'te' | 'auto';
  onChangeLanguage: (lang: 'en' | 'te' | 'auto') => void;
  coords: Coordinates | null;
  sosActive: boolean;
  nearestPolice?: PoliceStation;
  activeDestination?: string;
  onTriggerSos: () => void;
  onTriggerFakeCall: () => void;
  onNavigate: (view: AppView) => void;
}

const QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  { label: 'Someone is following me', prompt: 'I think someone is following me while walking home at night. What should I do right now?' },
  { label: 'Unsafe cab or auto', prompt: 'My cab driver took an unfamiliar route at night. Give me immediate steps.' },
  { label: 'Telugu Emergency Help', prompt: 'నేను రాత్రి ఒంటరిగా ప్రయాణిస్తున్నాను, భయంగా ఉంది. వెంటనే నేను ఏమి చేయాలి?' },
  { label: 'Safe late-night commute plan', prompt: 'Help me prepare a safe late-night commute checklist from office to home.' },
];

export const GuardianAiView: React.FC<GuardianAiViewProps> = ({
  language,
  onChangeLanguage,
  coords,
  sosActive,
  nearestPolice,
  activeDestination,
  onTriggerSos,
  onTriggerFakeCall,
  onNavigate,
}) => {
  const [tab, setTab] = useState<'chat' | 'scam'>('chat');
  const [messages, setMessages] = useState<GuardianChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: 'I am SHE-SHIELD Guardian. Ask me for immediate safety guidance, safe travel planning, or switch to Telugu anytime. If you are in immediate physical danger, tap Call 112 or Activate SOS right away.',
      timestamp: new Date().toISOString(),
      recommendedActions: ['open_police', 'start_journey'],
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Suspicious Message / Scam Analyzer state
  const [suspiciousText, setSuspiciousText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ThreatAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;
    setChatError(null);

    const userMsg: GuardianChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const res = await api.chatGuardian({
        message: trimmed,
        history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        language,
        context: {
          lat: coords?.lat,
          lng: coords?.lng,
          sosActive,
          nearestPolice: nearestPolice ? `${nearestPolice.name} (${nearestPolice.distanceKm} km)` : undefined,
          activeDestination,
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          timestamp: new Date().toISOString(),
          recommendedActions: res.recommendedActions,
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to reach SHE-SHIELD Guardian AI.');
    } finally {
      setSending(false);
    }
  };

  const handleAnalyzeMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspiciousText.trim() || analyzing) return;
    setAnalysisError(null);
    setAnalyzing(true);
    try {
      const res = await api.analyzeMessage(suspiciousText.trim(), language);
      setAnalysis(res);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const renderActionButton = (action: NonNullable<GuardianChatMessage['recommendedActions']>[number]) => {
    switch (action) {
      case 'call_112':
        return (
          <a
            key={action}
            href="tel:112"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Call 112</span>
          </a>
        );
      case 'activate_sos':
        return (
          <button
            key={action}
            type="button"
            onClick={onTriggerSos}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-950/80 px-3 py-1.5 text-xs font-semibold text-red-200 ring-1 ring-red-500/50 hover:bg-red-900"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Activate SOS</span>
          </button>
        );
      case 'open_police':
        return (
          <button
            key={action}
            type="button"
            onClick={() => onNavigate('police')}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#10172E] px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-slate-800"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Nearby Police</span>
          </button>
        );
      case 'start_journey':
        return (
          <button
            key={action}
            type="button"
            onClick={() => onNavigate('journey')}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#10172E] px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-slate-800"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Safe Journey Tracker</span>
          </button>
        );
      case 'fake_call':
        return (
          <button
            key={action}
            type="button"
            onClick={onTriggerFakeCall}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#10172E] px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-slate-800"
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Fake Incoming Call</span>
          </button>
        );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">SHE-SHIELD Guardian AI</h1>
            <p className="text-xs text-slate-400">
              Bilingual English &amp; తెలుగు safety intelligence · Prioritizes immediate physical safety
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-[#070B19] p-1">
            {(['auto', 'en', 'te'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onChangeLanguage(lang)}
                className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  language === lang ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'auto' ? 'Auto' : lang === 'en' ? 'English' : 'తెలుగు'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#070B19] p-1">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Safety Chat
            </button>
            <button
              type="button"
              onClick={() => setTab('scam')}
              className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'scam' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Scam &amp; Threat Scanner
            </button>
          </div>
        </div>
      </div>

      {tab === 'chat' ? (
        <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#0D1328]">
          <div className="flex flex-wrap gap-2 border-b border-slate-800 px-5 py-3">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => void sendMessage(item.prompt)}
                className="min-h-[36px] rounded-lg border border-slate-700/80 bg-[#070B19] px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-violet-500/60 hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="max-h-[420px] min-h-[320px] space-y-4 overflow-y-auto p-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : 'border border-slate-800 bg-[#070B19] text-slate-100'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.role === 'assistant' && msg.recommendedActions && msg.recommendedActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.recommendedActions.map((act) => renderActionButton(act))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#070B19] px-4 py-2.5 text-xs text-slate-300">
                Thinking through safest steps...
              </div>
            )}
          </div>

          {chatError && (
            <div className="mx-5 mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2.5 text-xs text-red-200">
              {chatError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="flex items-center gap-2 border-t border-slate-800 p-4"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                language === 'te'
                  ? 'మీ భద్రతా ప్రశ్నను తెలుగు లేదా ఇంగ్లీష్‌లో అడగండి...'
                  : 'Ask SHE-SHIELD Guardian in English or తెలుగు...'
              }
              className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-[#070B19] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleAnalyzeMessage}
            className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1328] p-5 lg:col-span-6"
          >
            <div>
              <h2 className="font-display text-base font-semibold text-white">Suspicious Message &amp; Scam Analyzer</h2>
              <p className="mt-1 text-xs text-slate-400">
                Paste an unknown SMS, WhatsApp message, fake job offer, blackmail threat, or phishing link for AI threat
                assessment.
              </p>
            </div>
            <textarea
              rows={6}
              value={suspiciousText}
              onChange={(e) => setSuspiciousText(e.target.value)}
              placeholder="Paste the suspicious text here..."
              className="w-full rounded-xl border border-slate-700 bg-[#070B19] p-3.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
            {analysisError && (
              <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {analysisError}
              </p>
            )}
            <button
              type="submit"
              disabled={analyzing || suspiciousText.trim().length < 4}
              className="min-h-[44px] w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {analyzing ? 'Analyzing Risk...' : 'Analyze Message Safety'}
            </button>
          </form>

          <div className="rounded-2xl border border-slate-800 bg-[#0D1328] p-5 lg:col-span-6">
            {!analysis ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                <ShieldCheck className="h-10 w-10 text-violet-400" />
                <p className="mt-3 text-sm font-semibold text-white">Ready to Inspect Suspicious Texts</p>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  Detects extortion, impersonation, OTP theft, stalking threats, and fake ride/job offers.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <p className="text-xs text-slate-400">{analysis.category}</p>
                    <h3 className="font-display text-lg font-bold text-white">
                      Risk Level:{' '}
                      <span
                        className={
                          analysis.riskLevel === 'critical' || analysis.riskLevel === 'high'
                            ? 'text-red-400'
                            : analysis.riskLevel === 'moderate'
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                        }
                      >
                        {analysis.riskLevel.toUpperCase()}
                      </span>
                    </h3>
                  </div>
                  {analysis.recommendEmergencyServices && (
                    <a
                      href="tel:112"
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      <AlertOctagon className="h-4 w-4" />
                      <span>Call 112 / 1930</span>
                    </a>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-slate-200">{analysis.summary}</p>

                {analysis.redFlags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-300">Detected Red Flags</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-300">
                      {analysis.redFlags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-emerald-300">Recommended Actions</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-200">
                    {analysis.immediateActions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
