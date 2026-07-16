'use client';

import { useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import MessageBubble from './MessageBubble';

interface ChatWidgetProps {
  widgetId: string;
  apiUrl: string;
}

export default function ChatWidget({ widgetId, apiUrl }: ChatWidgetProps) {
  const {
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
    voiceEnabled,
    voiceState,
    toggleRecording,
  } = useChat({ widgetId, apiUrl });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || connectionState === 'disconnected' || connectionState === 'error' || isSendingRef.current) return;
    isSendingRef.current = true;
    sendMessage(input.trim());
    setInput('');
    // Reset sending guard after a short delay
    setTimeout(() => { isSendingRef.current = false; }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && config?.chat?.enterToSend !== false) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderBottomColor: config?.theme?.secondaryColor || '#e5e7eb' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: config?.theme?.primaryColor || '#3B82F6' }}
        >
          AI
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold" style={{ color: config?.theme?.textColor || '#1E293B' }}>
            {config?.branding?.companyName || 'AI Agent'}
          </h2>
          <p className="text-xs text-gray-400">
            {connectionState === 'connected' ? 'Online' : connectionState === 'connecting' ? 'Connecting...' : 'Offline'}
          </p>
        </div>
        <div
          className={`w-2 h-2 rounded-full ${
            connectionState === 'connected'
              ? 'bg-green-500'
              : connectionState === 'connecting'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {greeting && messages.length === 0 && (
          <div className="text-center py-8">
            <div
              className="inline-block px-4 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: config?.theme?.surfaceColor || '#F8FAFC',
                color: config?.theme?.textColor || '#1E293B',
              }}
            >
              {greeting}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            primaryColor={config?.theme?.primaryColor || '#3B82F6'}
            textColor={config?.theme?.textColor || '#1E293B'}
            onRetry={retryMessage}
          />
        ))}

        {isTyping && (
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-100 rounded-lg w-fit">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {suggestedPrompts && suggestedPrompts.length > 0 && messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="px-3 py-1.5 text-xs rounded-full border hover:bg-gray-50 transition-colors"
                style={{
                  borderColor: config?.theme?.primaryColor || '#3B82F6',
                  color: config?.theme?.primaryColor || '#3B82F6',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {voiceEnabled && voiceState !== 'idle' && (
        <div className="px-4 pt-2 text-center text-xs text-gray-500">
          {voiceState === 'recording' && 'Listening… tap the mic to send'}
          {voiceState === 'processing' && 'Thinking…'}
          {voiceState === 'speaking' && 'Speaking… tap the mic to interrupt'}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t flex items-end gap-2"
        style={{ borderTopColor: config?.theme?.secondaryColor || '#e5e7eb' }}
      >
        {voiceEnabled && (
          <button
            type="button"
            onClick={toggleRecording}
            disabled={connectionState === 'disconnected' || connectionState === 'error' || voiceState === 'processing'}
            aria-label={voiceState === 'recording' ? 'Stop recording and send' : 'Start voice recording'}
            title={voiceState === 'recording' ? 'Stop and send' : 'Speak'}
            className={`p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
              voiceState === 'recording' ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor:
                voiceState === 'recording' ? '#ef4444' : config?.theme?.primaryColor || '#3B82F6',
            }}
          >
            {voiceState === 'processing' ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : voiceState === 'recording' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              </svg>
            )}
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config?.chat?.placeholder || 'Type a message...'}
          rows={1}
          maxLength={10000}
          className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{
            borderColor: config?.theme?.secondaryColor || '#e5e7eb',
            color: config?.theme?.textColor || '#1E293B',
            ['--tw-ring-color' as string]: config?.theme?.primaryColor || '#3B82F6',
          }}
          disabled={connectionState === 'disconnected'}
        />
        <button
          type="submit"
          disabled={!input.trim() || connectionState === 'disconnected' || connectionState === 'error'}
          className="p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ backgroundColor: config?.theme?.primaryColor || '#3B82F6' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}
