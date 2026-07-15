import { AIAgentSDKConfig, Message, ConnectionState } from './types';

export class AIAgentSDK {
  private config: AIAgentSDKConfig;
  private container: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private isOpenState = false;
  private messages: Message[] = [];
  private connectionState: ConnectionState = 'disconnected';
  private messageCallbacks: Array<(message: Message) => void> = [];
  private stateCallbacks: Array<(state: ConnectionState) => void> = [];

  constructor(config: AIAgentSDKConfig) {
    this.config = config;
  }

  init(): void {
    this.createIframe();
    this.setupEventListeners();
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    this.iframe?.remove();
    this.container?.remove();
    this.iframe = null;
    this.container = null;
    this.messageCallbacks = [];
    this.stateCallbacks = [];
    this.isOpenState = false;
  }

  sendMessage(content: string): void {
    if (!this.iframe?.contentWindow) return;

    const message: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    this.messages.push(message);
    this.notifyMessageCallbacks(message);

    const targetOrigin = new URL(this.config.apiUrl).origin;
    this.iframe.contentWindow.postMessage(
      { type: 'chat:send', payload: { content, widgetId: this.config.widgetId } },
      targetOrigin
    );
  }

  open(): void {
    if (this.iframe) {
      this.iframe.style.display = 'block';
      this.isOpenState = true;
      const targetOrigin = new URL(this.config.apiUrl).origin;
      this.iframe.contentWindow?.postMessage(
        { type: 'widget:open', payload: { widgetId: this.config.widgetId } },
        targetOrigin
      );
    }
  }

  close(): void {
    if (this.iframe) {
      this.iframe.style.display = 'none';
      this.isOpenState = false;
      const targetOrigin = new URL(this.config.apiUrl).origin;
      this.iframe.contentWindow?.postMessage(
        { type: 'widget:close', payload: { widgetId: this.config.widgetId } },
        targetOrigin
      );
    }
  }

  isOpen(): boolean {
    return this.isOpenState;
  }

  onMessage(callback: (message: Message) => void): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback);
    };
  }

  private createIframe(): void {
    if (this.iframe) return; // Already initialized

    this.container = document.createElement('div');
    this.container.id = 'ai-agent-sdk-container';
    this.container.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;';

    const positionStyles = this.getPositionStyles();
    Object.assign(this.container.style, positionStyles);

    this.iframe = document.createElement('iframe');

    const params = new URLSearchParams({
      widgetId: this.config.widgetId,
      apiUrl: this.config.apiUrl,
    });

    if (this.config.theme) params.set('theme', this.config.theme);
    if (this.config.greeting) params.set('greeting', this.config.greeting);
    if (this.config.placeholder) params.set('placeholder', this.config.placeholder);

    this.iframe.src = `${this.config.apiUrl}/widget?${params.toString()}`;
    this.iframe.style.cssText =
      'width:400px;height:600px;border:none;display:none;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);pointer-events:auto;';

    if (this.config.position === 'bottom-left' || this.config.position === 'top-left') {
      this.iframe.style.right = 'auto';
    }

    this.container.appendChild(this.iframe);
    document.body.appendChild(this.container);
  }

  private getPositionStyles(): Record<string, string> {
    const pos = this.config.position || 'bottom-right';
    const offset = 20;
    const styles: Record<string, string> = { position: 'fixed' };

    if (pos.includes('bottom')) styles.bottom = offset + 'px';
    if (pos.includes('top')) styles.top = offset + 'px';
    if (pos.includes('right')) styles.right = offset + 'px';
    if (pos.includes('left')) styles.left = offset + 'px';

    return styles;
  }

  private setupEventListeners(): void {
    window.addEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent): void => {
    if (!this.iframe || event.source !== this.iframe.contentWindow) return;

    const { type, payload } = event.data;

    switch (type) {
      case 'chat:message': {
        const message: Message = {
          id: payload.id,
          role: payload.role,
          content: payload.content,
          timestamp: payload.timestamp,
        };
        this.messages.push(message);
        this.notifyMessageCallbacks(message);
        break;
      }
      case 'widget:state': {
        this.connectionState = payload.state;
        this.notifyStateCallbacks(payload.state);
        break;
      }
    }
  };

  private notifyMessageCallbacks(message: Message): void {
    for (const cb of this.messageCallbacks) cb(message);
  }

  private notifyStateCallbacks(state: ConnectionState): void {
    for (const cb of this.stateCallbacks) cb(state);
  }
}
