'use client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MessageBubbleProps {
  message: Message;
  primaryColor: string;
  textColor: string;
}

export default function MessageBubble({ message, primaryColor, textColor }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] px-4 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: isUser ? primaryColor : '#F1F5F9',
          color: isUser ? '#FFFFFF' : textColor,
        }}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className="text-[10px] mt-1 opacity-60"
          style={{ color: isUser ? '#FFFFFF' : '#64748B' }}
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
