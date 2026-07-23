import { AuthError } from '@ai-agent/shared';

export interface WidgetTokenPayload {
  sub: string;
  agentId: string | null;
  tenantId: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const paddedStr = pad === 0 ? padded : padded + '='.repeat(4 - pad);
  return atob(paddedStr);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export class TokenService {
  private secret: string;

  constructor(secret: string) {
    if (!secret) throw new Error('Token secret is required');
    this.secret = secret;
  }

  async generateWidgetToken(
    widgetId: string,
    agentId: string | null,
    tenantId: string,
    expiresInMs: number = 24 * 60 * 60 * 1000
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: widgetId,
      tenantId,
      agentId: agentId ?? null,
      iss: 'ai-agent-platform',
      aud: 'widget',
      iat: now,
      exp: now + Math.floor(expiresInMs / 1000),
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    const key = await hmacKey(this.secret);
    const encoder = new TextEncoder();
    const signatureInput = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, signatureInput);
    const signatureArray = new Uint8Array(signatureBuffer);
    const signature = base64UrlEncode(
      String.fromCharCode(...signatureArray)
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async verifyWidgetToken(token: string): Promise<WidgetTokenPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new AuthError('Invalid widget token format');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const key = await hmacKey(this.secret);
    const encoder = new TextEncoder();
    const signatureInput = encoder.encode(`${encodedHeader}.${encodedPayload}`);

    const signatureBytes = Uint8Array.from(
      base64UrlDecode(encodedSignature),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      signatureInput
    );

    if (!valid) {
      throw new AuthError('Invalid widget token signature');
    }

    const payload: WidgetTokenPayload = JSON.parse(
      base64UrlDecode(encodedPayload)
    );

    if (payload.iss !== 'ai-agent-platform') {
      throw new AuthError('Invalid widget token issuer');
    }
    if (payload.aud !== 'widget') {
      throw new AuthError('Invalid widget token audience');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new AuthError('Widget token has expired');
    }

    return payload;
  }
}
