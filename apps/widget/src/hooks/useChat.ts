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
}

export function useChat({ widgetId, apiUrl }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`${apiUrl}/api/widgets/${widgetId}`);
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
        const res = await fetch(`${apiUrl}/api/widgets/${widgetId}/sessions`, {
          method: 'POST',
        });
        const data = await res.json();
        if (data.success) {
          setSessionId(data.data.id);
          setTenantId(data.data.tenantId);
          // Don't set connected here - wait for WS onopen (W7)
          connectStream(data.data.id, data.data.tenantId);
        } else {
          setConnectionState('error');
        }
      } catch {
        setConnectionState('error');
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
                const res = await fetch(`${apiUrl}/api/widgets/${widgetId}/sessions`, {
                  method: 'POST',
                });
                const data = await res.json();
                if (data.success) {
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
          const res = await fetch(`${apiUrl}/api/widgets/${widgetId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
          const res = await fetch(`${apiUrl}/api/widgets/${widgetId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

  const suggestedPrompts = config?.chat?.suggestedPrompts || [];
  const greeting = config?.chat?.greeting || null;

  return {
    messages,
    input,
    setInput,
    sendMessage,
    retryMessage,
    isTyping,
    connectionState,
    suggestedPrompts,
    greeting,
    config,
  };
}
