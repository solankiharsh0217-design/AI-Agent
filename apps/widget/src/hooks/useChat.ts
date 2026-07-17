'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status?: 'sending' | 'sent' | 'failed';
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseChatOptions {
  widgetId: string;
  apiUrl: string;
}

interface WidgetConfig {
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
    surfaceColor?: string;
  };
  branding?: {
    companyName?: string;
    logo?: string | null;
    tagline?: string | null;
  };
  chat?: {
    greeting?: string | null;
    placeholder?: string;
    suggestedPrompts?: string[];
    enterToSend?: boolean;
  };
  voice?: {
    enabled?: boolean;
    language?: string;
    showVisualizer?: boolean;
  };
  features?: {
    chat?: boolean;
    voice?: boolean;
  };
}

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

export function useChat({ widgetId, apiUrl }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const parentUrl = typeof document !== 'undefined' ? document.referrer : '';
        const url = new URL(`${apiUrl}/api/widgets/${widgetId}`);
        if (parentUrl) {
          url.searchParams.set('parentUrl', parentUrl);
        }
        const res = await fetch(url.toString(), {
          headers: parentUrl ? { 'X-Parent-Origin': parentUrl } : {},
          cache: 'no-store'
        });
        const data = await res.json();
        if (data.success) {
          setConfig(data.data.config);
        }
      } catch {
        // config loading failed, continue with defaults
      }
    }
    loadConfig();
  }, [widgetId, apiUrl]);

useEffect(() => {
    async function createSession() {
      try {
        const parentUrl = typeof document !== 'undefined' ? document.referrer : '';
        const url = new URL(`${apiUrl}/api/widgets/${widgetId}/sessions`);
        if (parentUrl) {
          url.searchParams.set('parentUrl', parentUrl);
        }
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: parentUrl ? { 'X-Parent-Origin': parentUrl } : {},
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (data && data.success) {
          setConnectionError(null);
          setSessionId(data.data.id);
          setTenantId(data.data.tenantId);
          // Don't set connected here - wait for WS onopen (W7)
          connectStream(data.data.id, data.data.tenantId);
        } else {
          setConnectionState('error');
          setConnectionError(
            data?.error?.code === 'UNAUTHORIZED_DOMAIN'
              ? 'This website is not authorized for this widget. Add its address to the widget’s allowed domains in the dashboard.'
              : data?.error?.message || 'Unable to connect to the assistant.'
          );
        }
      } catch {
        setConnectionState('error');
        setConnectionError('Could not reach the assistant service. Check your connection and try again.');
      }
    }
    createSession();

    return () => {
      if (wsRef.current) {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [widgetId, apiUrl]);

  const connectStream = useCallback(
    (sid: string, tenantId?: string) => {
      try {
        const wsUrl = apiUrl.replace(/^http/, 'ws');
        const params = new URLSearchParams({ sessionId: sid });
        if (tenantId) params.set('tenantId', tenantId);
        const ws = new WebSocket(`${wsUrl}/ws/widget?${params.toString()}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionState('connected');
          reconnectAttempts.current = 0;

          // Heartbeat ping every 60s to keep connection alive (Cloudflare DO idle timeout ~100s)
          const pingInterval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            } else {
              clearInterval(pingInterval);
            }
          }, 60000);
          pingIntervalRef.current = pingInterval;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
            case 'message':
              setIsTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  id: data.payload.id || crypto.randomUUID(),
                  role: 'assistant',
                  content: data.payload.content,
                  timestamp: data.payload.timestamp || Date.now(),
                },
              ]);
              break;

            case 'stream':
              if (data.payload.finished) {
                setIsTyping(false);
              } else {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.id === data.payload.id) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: last.content + data.payload.delta },
                    ];
                  }
                  return [
                    ...prev,
                    {
                      id: data.payload.id,
                      role: 'assistant',
                      content: data.payload.delta,
                      timestamp: Date.now(),
                    },
                  ];
                });
              }
              break;

            case 'typing':
              setIsTyping(data.payload.isTyping);
              break;

            case 'error':
              setIsTyping(false);
              if (data.payload?.message) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `Error: ${data.payload.message}`,
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;

            case 'connected':
              // Session is ready on DO side
              console.log('[WS] Session connected:', data.sessionId);
              break;

            case 'session:ended':
              setConnectionState('disconnected');
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: 'Session ended. Please refresh to start a new conversation.',
                  timestamp: Date.now(),
                },
              ]);
              break;

            case 'pong':
              // Heartbeat acknowledgment
              break;

            default:
              console.log('[WS] Unknown message type:', data.type, data);
              break;
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onerror = () => {
          setConnectionState('error');
        };

        ws.onclose = () => {
          // Clear heartbeat interval
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }

          setConnectionState('disconnected');
          if (reconnectAttempts.current < 5) {
            setTimeout(async () => {
              reconnectAttempts.current += 1;
              setConnectionState('connecting');
              // W5: Create new session on reconnect instead of reusing stale sessionId
              try {
                const parentUrl = typeof document !== 'undefined' ? document.referrer : '';
                const url = new URL(`${apiUrl}/api/widgets/${widgetId}/sessions`);
                if (parentUrl) {
                  url.searchParams.set('parentUrl', parentUrl);
                }
                const res = await fetch(url.toString(), {
                  method: 'POST',
                  headers: parentUrl ? { 'X-Parent-Origin': parentUrl } : {},
                  cache: 'no-store',
                });
                const data = await res.json().catch(() => null);
                if (data && data.success) {
                  setConnectionError(null);
                  setSessionId(data.data.id);
                  setTenantId(data.data.tenantId);
                  connectStream(data.data.id, data.data.tenantId);
                } else {
                  setConnectionState('error');
                }
              } catch {
                setConnectionState('error');
              }
            }, 3000 * (reconnectAttempts.current + 1));
          }
        };
      } catch {
        setConnectionState('error');
      }
},
    [widgetId, sessionId, apiUrl]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find(m => m.id === messageId);
      if (!message || message.role !== 'user' || message.status !== 'failed') return;

      // Update status to sending
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'sending' } : m));
      setIsTyping(true);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'chat:send',
            payload: { content: message.content, sessionId },
          })
        );
      } else {
        try {
          const parentUrl = typeof document !== 'undefined' ? document.referrer : '';
          const url = new URL(`${apiUrl}/api/widgets/${widgetId}/messages`);
          if (parentUrl) {
            url.searchParams.set('parentUrl', parentUrl);
          }
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (parentUrl) headers['X-Parent-Origin'] = parentUrl;
          const res = await fetch(url.toString(), {
            method: 'POST',
            headers,
            body: JSON.stringify({ content: message.content, sessionId }),
          });
          const data = await res.json();
          if (data.success && data.data) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'sent' } : m));
            setMessages(prev => [
              ...prev.filter(m => m.id !== messageId),
              {
                id: data.data.id || crypto.randomUUID(),
                role: 'assistant',
                content: data.data.content,
                timestamp: data.data.timestamp || Date.now(),
              },
            ]);
          } else {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'failed' } : m));
          }
          setIsTyping(false);
        } catch {
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'failed' } : m));
          setIsTyping(false);
        }
      }
    },
    [messages, widgetId, sessionId, apiUrl]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'chat:send',
            payload: { content, sessionId },
          })
        );
        // Mark as sent optimistically
        setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, status: 'sent' } : m));
      } else {
        try {
          const parentUrl = typeof document !== 'undefined' ? document.referrer : '';
          const url = new URL(`${apiUrl}/api/widgets/${widgetId}/messages`);
          if (parentUrl) {
            url.searchParams.set('parentUrl', parentUrl);
          }
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (parentUrl) headers['X-Parent-Origin'] = parentUrl;
          const res = await fetch(url.toString(), {
            method: 'POST',
            headers,
            body: JSON.stringify({ content, sessionId }),
          });
          const data = await res.json();
          if (data.success && data.data) {
            setMessages(prev => [
              ...prev.map(m => m.id === userMessage.id ? { ...m, status: 'sent' as const } : m),
              {
                id: data.data.id || crypto.randomUUID(),
                role: 'assistant',
                content: data.data.content,
                timestamp: data.data.timestamp || Date.now(),
              },
            ]);
          } else {
            setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, status: 'failed' as const } : m));
          }
          setIsTyping(false);
        } catch {
          setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, status: 'failed' as const } : m));
          setIsTyping(false);
        }
      }
    },
    [widgetId, sessionId, apiUrl]
  );

  // Keep a ref of the latest sessionId so voice callbacks aren't stale
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const playAudio = useCallback((base64: string, format: string) => {
    try {
      const mime = format === 'mp3' ? 'audio/mpeg' : format === 'opus' ? 'audio/ogg' : 'audio/wav';
      const audio = new Audio(`data:${mime};base64,${base64}`);
      audioElRef.current = audio;
      setVoiceState('speaking');
      audio.onended = () => setVoiceState('idle');
      audio.onerror = () => setVoiceState('idle');
      audio.play().catch(() => setVoiceState('idle'));
    } catch {
      setVoiceState('idle');
    }
  }, []);

  const sendVoice = useCallback(
    async (audioBlob: Blob) => {
      const sid = sessionIdRef.current;
      if (!sid) {
        setVoiceState('idle');
        return;
      }
      setVoiceState('processing');
      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('sessionId', sid);

        const parentUrl = typeof document !== 'undefined' ? document.referrer : '';
        const url = new URL(`${apiUrl}/api/widgets/${widgetId}/voice`);
        if (parentUrl) {
          url.searchParams.set('parentUrl', parentUrl);
        }
        const headers: Record<string, string> = {};
        if (parentUrl) headers['X-Parent-Origin'] = parentUrl;
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: formData,
        });
        const data = await res.json();

        if (data.success && data.data) {
          const { transcript, reply, audio, audioFormat } = data.data;
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'user',
              content: transcript,
              timestamp: Date.now(),
              status: 'sent',
            },
            {
              id: reply?.id || crypto.randomUUID(),
              role: 'assistant',
              content: reply?.content || '',
              timestamp: reply?.timestamp || Date.now(),
            },
          ]);
          if (audio) {
            playAudio(audio, audioFormat || 'wav');
          } else {
            setVoiceState('idle');
          }
        } else {
          const msg = data.error?.message || 'Voice request failed';
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${msg}`, timestamp: Date.now() },
          ]);
          setVoiceState('idle');
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: 'Error: could not reach voice service.', timestamp: Date.now() },
        ]);
        setVoiceState('idle');
      }
    },
    [apiUrl, widgetId, playAudio]
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    // If audio is playing, stop it before recording a new turn
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    if (voiceState === 'processing') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        let finalMimeType = recorder.mimeType || 'audio/webm';
        if (finalMimeType.includes(';')) {
          finalMimeType = finalMimeType.split(';')[0].trim();
        }
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        audioChunksRef.current = [];
        if (blob.size > 0) {
          sendVoice(blob);
        } else {
          setVoiceState('idle');
        }
      };

      recorder.start();
      setVoiceState('recording');
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Error: microphone access was denied.', timestamp: Date.now() },
      ]);
      setVoiceState('idle');
    }
  }, [voiceState, sendVoice]);

  // Tap-to-talk toggle: start when idle, stop-and-send when recording
  const toggleRecording = useCallback(() => {
    if (voiceState === 'recording') {
      stopRecording();
    } else if (voiceState === 'idle') {
      startRecording();
    }
  }, [voiceState, startRecording, stopRecording]);

  // Clean up mic + audio on unmount
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioElRef.current) audioElRef.current.pause();
    };
  }, []);

  const suggestedPrompts = config?.chat?.suggestedPrompts || [];
  const greeting = config?.chat?.greeting || null;
  const voiceEnabled = config?.voice?.enabled === true;
  // Voice-only widget: features.chat explicitly false and voice on. Otherwise
  // chat is available (default true for backward compatibility).
  const chatEnabled = config?.features?.chat !== false || !voiceEnabled;

  return {
    messages,
    input,
    setInput,
    sendMessage,
    retryMessage,
    isTyping,
    connectionState,
    connectionError,
    suggestedPrompts,
    greeting,
    config,
    voiceEnabled,
    chatEnabled,
    voiceState,
    toggleRecording,
  };
}
