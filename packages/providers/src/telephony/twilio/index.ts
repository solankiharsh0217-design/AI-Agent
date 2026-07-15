import type { TwilioProvider as ITwilioProvider, PhoneNumbersProvider, CreateCallParams, CallStatus } from '../../interfaces/telephony';
import { fetchWithRetry } from '../../fetch-retry';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  webhookBaseUrl: string;
  timeout?: number;
}

export class TwilioProvider implements ITwilioProvider, PhoneNumbersProvider {
  readonly name = 'twilio';
  private accountSid: string;
  private authToken: string;
  private webhookBaseUrl: string;
  private timeout: number;

  constructor(config: TwilioConfig) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.webhookBaseUrl = config.webhookBaseUrl;
    this.timeout = config.timeout ?? 30000;
  }

  private getAuthHeader(): string {
    return 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`);
  }

  async createCall(params: CreateCallParams): Promise<CallStatus> {
    const formData = new URLSearchParams();
    formData.append('To', params.to);
    formData.append('From', params.from);
    formData.append('Url', params.url);
    if (params.statusCallback) formData.append('StatusCallback', params.statusCallback);
    if (params.statusCallbackEvent) {
      params.statusCallbackEvent.forEach(e => formData.append('StatusCallbackEvent', e));
    }
    if (params.machineDetection) formData.append('MachineDetection', params.machineDetection);
    if (params.timeout) formData.append('Timeout', params.timeout.toString());

    const response = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      },
      { maxRetries: 3, timeoutMs: this.timeout }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio create call error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      sid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
      duration: data.duration ? parseInt(data.duration) : null,
      startTime: data.start_time ? new Date(data.start_time) : null,
      endTime: data.end_time ? new Date(data.end_time) : null,
    };
  }

  async getCallStatus(sid: string): Promise<CallStatus> {
    const response = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${sid}.json`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      },
      { maxRetries: 3, timeoutMs: this.timeout }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio get call status error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      sid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
      duration: data.duration ? parseInt(data.duration) : null,
      startTime: data.start_time ? new Date(data.start_time) : null,
      endTime: data.end_time ? new Date(data.end_time) : null,
    };
  }

  async endCall(sid: string): Promise<CallStatus> {
    const formData = new URLSearchParams();
    formData.append('Status', 'completed');

    const response = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${sid}.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      },
      { maxRetries: 3, timeoutMs: this.timeout }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio end call error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      sid: data.sid,
      status: 'completed',
      to: data.to,
      from: data.from,
      duration: data.duration ? parseInt(data.duration) : null,
      startTime: data.start_time ? new Date(data.start_time) : null,
      endTime: new Date(),
    };
  }

  async validateWebhook(signature: string, url: string, params: Record<string, string>): Promise<boolean> {
    const paramsWithoutSignature = { ...params };
    delete paramsWithoutSignature['signature'];
    delete paramsWithoutSignature['X-Twilio-Signature'];

    const sortedKeys = Object.keys(paramsWithoutSignature).sort();
    let data = url;
    for (const key of sortedKeys) {
      data += key + paramsWithoutSignature[key];
    }
    const encoder = new TextEncoder();

    try {
      const keyData = encoder.encode(this.authToken);
      const dataToVerify = encoder.encode(data);

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign', 'verify']
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', key, dataToVerify);

      const computedHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const computedBase64 = btoa(
        Array.from(new Uint8Array(signatureBuffer))
          .map(b => String.fromCharCode(b))
          .join('')
      );

      if (signature.length === 40 && /^[0-9a-f]+$/i.test(signature)) {
        return timingSafeEqual(computedHex.toLowerCase(), signature.toLowerCase());
      }

      return timingSafeEqual(computedBase64, signature);
    } catch {
      return false;
    }
  }

  async listNumbers(country?: string): Promise<Array<{ phoneNumber: string; friendlyName: string; monthlyCost: number }>> {
    const params = new URLSearchParams();
    if (country) params.append('Country', country);

    const response = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers.json?${params}`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      },
      { maxRetries: 3, timeoutMs: this.timeout }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio list numbers error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return (data.incoming_phone_numbers ?? []).map((num: any) => ({
      phoneNumber: num.phone_number,
      friendlyName: num.friendly_name,
      monthlyCost: parseFloat(num.monthly_cost ?? '0'),
    }));
  }

  async buyNumber(phoneNumber: string): Promise<{ sid: string; phoneNumber: string; monthlyCost: number }> {
    const formData = new URLSearchParams();
    formData.append('PhoneNumber', phoneNumber);

    const response = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      },
      { maxRetries: 3, timeoutMs: this.timeout }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio buy number error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      sid: data.sid,
      phoneNumber: data.phone_number,
      monthlyCost: parseFloat(data.monthly_cost ?? '0'),
    };
  }

  async releaseNumber(sid: string): Promise<void> {
    const response = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/IncomingPhoneNumbers/${sid}.json`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      },
      { maxRetries: 3, timeoutMs: this.timeout }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio release number error: ${response.status} - ${error}`);
    }
  }
}
