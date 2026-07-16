/**
 * Twilio Media Streams don't include an X-Twilio-Signature header on the WebSocket
 * upgrade, so we can't authenticate the media socket the same way as the HTTP webhook.
 *
 * Instead, the (Twilio-signature-verified) voice webhook issues a short HMAC token
 * bound to the CallSid, embeds it in the <Stream> URL, and the /twilio/media handler
 * verifies it. This proves the media connection was initiated by our own webhook.
 */

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Sign a CallSid with the internal secret, producing a URL-safe token. */
export async function signCallToken(secret: string, callSid: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(callSid));
  return base64Url(new Uint8Array(sig));
}

/** Verify a CallSid token in (near) constant time. */
export async function verifyCallToken(secret: string, callSid: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await signCallToken(secret, callSid);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
