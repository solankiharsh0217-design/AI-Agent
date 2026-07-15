'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status?: 'sending' | 'sent' | 'failed';
}

interface MessageBubbleProps {
  message: Message;
  primaryColor: string;
  textColor: string;
  onRetry?: (messageId: string) => void;
}

export default function MessageBubble({ message, primaryColor, textColor, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'failed';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] px-4 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: isUser ? primaryColor : isError ? '#FEF2F2' : '#F1F5F9',
          color: isUser ? '#FFFFFF' : isError ? '#DC2626' : textColor,
          border: isError ? '1px solid #FECACA' : undefined,
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: ({ children, ...props }) => (
              <code
                {...props}
                className="px-1.5 py-0.5 rounded text-sm font-mono bg-gray-100 dark:bg-gray-800"
                style={{ color: isUser ? '#FFFFFF' : isError ? '#DC2626' : textColor }}
              >
                {children}
              </code>
            ),
            pre: ({ children, ...props }) => (
              <pre
                {...props}
                className="p-2 rounded bg-gray-100 dark:bg-gray-800 overflow-x-auto"
                style={{ color: isUser ? '#FFFFFF' : isError ? '#DC2626' : textColor }}
              >
                {children}
              </pre>
            ),
            a: ({ children, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-400"
                style={{ color: isUser ? '#93C5FD' : isError ? '#FCA5A5' : '#3B82F6' }}
              >
                {children}
              </a>
            ),
            strong: ({ children, ...props }) => (
              <strong {...props} style={{ color: isUser ? '#FFFFFF' : isError ? '#DC2626' : textColor }}>{children}</strong>
            ),
            em: ({ children, ...props }) => (
              <em {...props} style={{ color: isUser ? '#FFFFFF' : isError ? '#DC2626' : textColor }}>{children}</em>
            ),
            ul: ({ children, ...props }) => (
              <ul {...props} className="list-disc list-inside mt-1 mb-1">{children}</ul>
            ),
            ol: ({ children, ...props }) => (
              <ol {...props} className="list-decimal list-inside mt-1 mb-1">{children}</ol>
            ),
            li: ({ children, ...props }) => (
              <li {...props} style={{ color: isUser ? '#FFFFFF' : isError ? '#DC2626' : textColor }}>{children}</li>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote {...props} className="border-l-4 pl-2 my-1 italic" style={{ borderColor: isUser ? '#93C5FD' : isError ? '#FCA5A5' : '#3B82F6', color: isUser ? '#FFFFFF' : isError ? '#DC2626' : textColor }}>
                {children}
              </blockquote>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
        {isError && onRetry && (
          <button
            onClick={() => onRetry(message.id)}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        )}
        <p
          className="text-[10px] mt-1 opacity-60"
          style={{ color: isUser ? '#FFFFFF' : isError ? '#DC2626' : '#64748B' }}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
