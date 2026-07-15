import { AIAgentSDK } from './sdk';
import { AIAgentSDKConfig } from './types';

(function initAIAgentSDK() {
  if (typeof window === 'undefined') return;

  const scriptTag = document.querySelector<HTMLScriptElement>('script[data-ai-agent]');
  if (!scriptTag) return;

  const apiUrl = scriptTag.dataset.apiUrl;
  if (!apiUrl) {
    console.error('AI Agent Widget: data-api-url attribute is required');
    return;
  }

  const config: AIAgentSDKConfig = {
    apiUrl,
    widgetId: scriptTag.dataset.widgetId || '',
    agentId: scriptTag.dataset.agentId || '',
    tenantId: scriptTag.dataset.tenantId || '',
    theme: (scriptTag.dataset.theme as AIAgentSDKConfig['theme']) || undefined,
    position: (scriptTag.dataset.position as AIAgentSDKConfig['position']) || undefined,
    greeting: scriptTag.dataset.greeting || undefined,
    placeholder: scriptTag.dataset.placeholder || undefined,
  };

  if (!config.widgetId || !config.agentId || !config.tenantId) {
    console.error('[AIAgentSDK] Missing required data attributes: data-widget-id, data-agent-id, data-tenant-id');
    return;
  }

  const sdk = new AIAgentSDK(config);
  sdk.init();

  (window as any).AIAgentSDK = sdk;
})();
