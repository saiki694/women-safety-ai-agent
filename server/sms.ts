import type { ContactDeliveryStatus, TrustedContact } from '../src/types.ts';

function buildSmsUri(phone: string, body: string): string {
  const sanitized = phone.replace(/[^+\d]/g, '');
  return `sms:${sanitized}?body=${encodeURIComponent(body)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface EmergencyDispatchOptions {
  autoCall?: boolean;
  userName?: string;
}

export async function dispatchEmergencySms(
  contacts: TrustedContact[],
  message: string,
  options: EmergencyDispatchOptions = {},
): Promise<{
  deliveries: ContactDeliveryStatus[];
  gatewayConfigured: boolean;
}> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  const gatewayConfigured = Boolean(sid && token && fromNumber);

  if (!gatewayConfigured) {
    return {
      gatewayConfigured: false,
      deliveries: contacts.map((contact) => ({
        contactId: contact.id,
        contactName: contact.name,
        relationship: contact.relationship,
        phone: contact.phone,
        status: 'manual_required',
        provider: 'manual_sms',
        detail: 'SMS gateway secrets not set; tap Send SMS or use Device Auto-Dialer.',
        smsUri: buildSmsUri(contact.phone, message),
        callStatus: 'manual_required',
        callDetail: 'Twilio voice gateway not configured; device phone dialer used instead.',
      })),
    };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const shouldAutoCall = options.autoCall !== false;
  const primaryContactIds = new Set(
    contacts
      .filter((c) => c.isPrimaryParent || c.relationship === 'Father' || c.relationship === 'Mother')
      .map((c) => c.id),
  );
  if (primaryContactIds.size === 0 && contacts[0]) {
    primaryContactIds.add(contacts[0].id);
  }

  const twiml = `<Response><Say voice="alice">${escapeXml(
    `Emergency SOS alert from ${options.userName || 'SHE-SHIELD AI user'}. ${message}. Please call back immediately or dial 112.`,
  )}</Say></Response>`;

  const deliveries = await Promise.all(
    contacts.map(async (contact): Promise<ContactDeliveryStatus> => {
      const smsUri = buildSmsUri(contact.phone, message);
      let smsStatus: ContactDeliveryStatus['status'] = 'failed';
      let smsDetail = 'Unable to send SMS';

      try {
        const params = new URLSearchParams({
          To: contact.phone,
          From: fromNumber!,
          Body: message,
        });

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const payload = (await res.json()) as { sid?: string; status?: string; message?: string };
        if (!res.ok) {
          smsStatus = 'failed';
          smsDetail = payload.message || `Gateway returned HTTP ${res.status}`;
        } else {
          smsStatus = payload.status === 'delivered' ? 'delivered' : 'queued';
          smsDetail = `Auto-sent via SMS gateway (Ref: ${payload.sid ?? 'queued'})`;
        }
      } catch (err) {
        smsStatus = 'failed';
        smsDetail = err instanceof Error ? err.message : 'Network error contacting SMS gateway';
      }

      let callStatus: ContactDeliveryStatus['callStatus'];
      let callDetail: string | undefined;

      if (shouldAutoCall && primaryContactIds.has(contact.id)) {
        try {
          const callParams = new URLSearchParams({
            To: contact.phone,
            From: fromNumber!,
            Twiml: twiml,
          });
          const callRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: callParams.toString(),
          });
          const callPayload = (await callRes.json()) as { sid?: string; status?: string; message?: string };
          if (!callRes.ok) {
            callStatus = 'failed';
            callDetail = callPayload.message || `Voice gateway returned HTTP ${callRes.status}`;
          } else {
            callStatus = callPayload.status === 'queued' ? 'queued' : 'initiated';
            callDetail = `Auto-calling via Voice gateway (Ref: ${callPayload.sid ?? 'initiated'})`;
          }
        } catch (err) {
          callStatus = 'failed';
          callDetail = err instanceof Error ? err.message : 'Network error initiating voice call';
        }
      }

      return {
        contactId: contact.id,
        contactName: contact.name,
        relationship: contact.relationship,
        phone: contact.phone,
        status: smsStatus,
        provider: 'twilio',
        detail: smsDetail,
        smsUri,
        callStatus,
        callDetail,
      };
    }),
  );

  return {
    gatewayConfigured: true,
    deliveries,
  };
}
