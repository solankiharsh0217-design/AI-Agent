export interface AIAgentSDKConfig {
  apiUrl: string;
  widgetId: string;
  agentId: string;
  tenantId: string;
  theme?: 'light' | 'dark' | 'system';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  greeting?: string;
  placeholder?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';
