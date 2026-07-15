'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseChatOptions {
  widgetId: string;
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

export function useChat({ widgetId }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

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
          setConnectionState('connected');
          connectStream(data.data.id);
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
    (sid: string) => {
      try {
        const wsUrl = apiUrl.replace(/^http/, 'ws');
        const ws = new WebSocket(`${wsUrl}/ws/widget?sessionId=${sid}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionState('connected');
          reconnectAttempts.current = 0;
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
          setConnectionState('disconnected');
          if (reconnectAttempts.current < 5) {
            setTimeout(() => {
              reconnectAttempts.current += 1;
              setConnectionState('connecting');
              connectStream(sid);
            }, 3000 * (reconnectAttempts.current + 1));
          }
        };
      } catch {
        setConnectionState('error');
      }
    },
    [apiUrl]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
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
      } else {
        try {
          await fetch(`${apiUrl}/api/widgets/${widgetId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, sessionId }),
          });
        } catch {
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
    isTyping,
    connectionState,
    suggestedPrompts,
    greeting,
    config,
  };
}
