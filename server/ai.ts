import { GoogleGenAI, Type } from '@google/genai';
import type { GuardianChatMessage, ThreatAnalysisResult } from '../src/types.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface GuardianChatInput {
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
}

export async function chatWithGuardian(input: GuardianChatInput): Promise<{
  reply: string;
  recommendedActions: GuardianChatMessage['recommendedActions'];
}> {
  const ai = getAiClient();

  const languageRule =
    input.language === 'te'
      ? 'Respond primarily in natural, clear Telugu (తెలుగు script), keeping emergency numbers (112, 100, 1091, 181) clearly visible.'
      : input.language === 'en'
        ? 'Respond in clear, calm, actionable English.'
        : 'Match the user language: if the user writes in Telugu or asks in Telugu/Tenglish, respond in natural Telugu (తెలుగు script) with clear action steps; otherwise respond in clear English.';

  const contextLines: string[] = [];
  if (input.context?.sosActive) {
    contextLines.push('CRITICAL: User currently has SOS Emergency Mode ACTIVE.');
  }
  if (typeof input.context?.lat === 'number' && typeof input.context?.lng === 'number') {
    contextLines.push(
      `Current GPS coordinates: ${input.context.lat.toFixed(5)}, ${input.context.lng.toFixed(5)} (Google Maps: https://www.google.com/maps?q=${input.context.lat},${input.context.lng})`,
    );
  }
  if (input.context?.nearestPolice) {
    contextLines.push(`Nearest detected police station: ${input.context.nearestPolice}`);
  }
  if (input.context?.activeDestination) {
    contextLines.push(`Active Safe Journey destination: ${input.context.activeDestination}`);
  }

  const systemInstruction = `You are SHE-SHIELD Guardian, an urgent, calm, authoritative personal AI safety guardian for women traveling alone (especially returning from offices, colleges, and public transit at night).

CORE PRIORITIES:
1. Immediate physical safety overrides ordinary conversation. If the user expresses fear, being followed, harassment, assault, unsafe cab/auto travel, or medical/crime danger, give short, numbered immediate actions FIRST:
   - Move to a brightly lit, populated public area (open shop, fuel station, pharmacy, security desk, metro station).
   - Call India national emergency number 112 (or Women Helpline 181 / 1091) immediately.
   - Activate SHE-SHIELD SOS to alert trusted family members and share live GPS.
2. Never claim that this app automatically alerts police directly—always instruct the user to dial 112 or call a verified station number.
3. Help with: emergency instructions, escape/de-escalation strategies, spotting suspicious messages/scams, planning safer transit routes, and using Nearby Police Stations.
4. Keep responses concise, structured, calm, and immediately readable on a smartphone screen (no fluff, no markdown tables).
5. ${languageRule}

LIVE CONTEXT:
${contextLines.length > 0 ? contextLines.join('\n') : 'No active GPS or SOS telemetry attached.'}`;

  const contents = [
    ...input.history.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    {
      role: 'user',
      parts: [{ text: input.message }],
    },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Calm, practical, safety-first guidance in the requested language (English or Telugu).',
          },
          recommendedActions: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description:
              'Subset of action keys relevant to the user situation: call_112, activate_sos, open_police, start_journey, fake_call',
          },
        },
        required: ['reply', 'recommendedActions'],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    reply?: string;
    recommendedActions?: string[];
  };

  const allowed = new Set(['call_112', 'activate_sos', 'open_police', 'start_journey', 'fake_call']);
  const actions = (parsed.recommendedActions ?? []).filter((a): a is NonNullable<GuardianChatMessage['recommendedActions']>[number] =>
    allowed.has(a),
  );

  return {
    reply: parsed.reply || 'Stay in a brightly lit, populated place and dial 112 if you feel unsafe.',
    recommendedActions: actions,
  };
}

export async function analyzeSuspiciousMessage(
  suspiciousText: string,
  language: 'en' | 'te' | 'auto',
): Promise<ThreatAnalysisResult> {
  const ai = getAiClient();

  const langHint =
    language === 'te'
      ? 'Write summary, redFlags, and immediateActions in Telugu (తెలుగు script).'
      : language === 'en'
        ? 'Write summary, redFlags, and immediateActions in English.'
        : 'Respond in Telugu if the input text is in Telugu, otherwise respond in English.';

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze this suspicious message, SMS, WhatsApp text, job/cab offer, or threat received by a woman:\n\n"""${suspiciousText}"""`,
    config: {
      systemInstruction: `You are SHE-SHIELD Guardian Threat & Scam Intelligence. Evaluate messages for stalking, extortion/sextortion, fake job/cab/police scams, phishing links, impersonation, OTP theft, or physical coercion. ${langHint}`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskLevel: {
            type: Type.STRING,
            description: 'One of: critical, high, moderate, low',
          },
          category: {
            type: Type.STRING,
            description: 'Short category label such as Financial Scam, Stalking / Coercion, Fake Job Offer, Phishing Link, or Safe / Benign',
          },
          summary: {
            type: Type.STRING,
            description: 'Concise assessment of why this message is dangerous or safe.',
          },
          redFlags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Specific manipulation tactics, urgency traps, or suspicious details detected.',
          },
          immediateActions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Practical steps: preserve screenshots, block/report, do not share OTP, contact Cyber Crime 1930 or 112 if threatened.',
          },
          recommendEmergencyServices: {
            type: Type.BOOLEAN,
            description: 'True if there is an immediate physical threat, blackmail, or stalking risk.',
          },
        },
        required: [
          'riskLevel',
          'category',
          'summary',
          'redFlags',
          'immediateActions',
          'recommendEmergencyServices',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<ThreatAnalysisResult>;
  const validRisks = new Set(['critical', 'high', 'moderate', 'low']);

  return {
    riskLevel: validRisks.has(parsed.riskLevel ?? '') ? (parsed.riskLevel as ThreatAnalysisResult['riskLevel']) : 'moderate',
    category: parsed.category || 'Suspicious Communication',
    summary: parsed.summary || 'Unable to classify clearly; treat unsolicited requests cautiously.',
    redFlags: parsed.redFlags ?? [],
    immediateActions: parsed.immediateActions ?? [
      'Do not click links or share OTPs.',
      'Save screenshots as evidence.',
      'Report cyber fraud at 1930 or cybercrime.gov.in, or call 112 if physically threatened.',
    ],
    recommendEmergencyServices: Boolean(parsed.recommendEmergencyServices),
  };
}
