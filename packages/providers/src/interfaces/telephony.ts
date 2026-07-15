export interface CreateCallParams {
  to: string;
  from: string;
  url: string;
  statusCallback?: string;
  statusCallbackEvent?: string[];
  machineDetection?: 'Enable' | 'DetectMessageEnd';
  timeout?: number;
}

export interface CallStatus {
  sid: string;
  status: string;
  to: string;
  from: string;
  duration: number | null;
  startTime: Date | null;
  endTime: Date | null;
}

export interface TwilioProvider {
  readonly name: string;
  createCall(params: CreateCallParams): Promise<CallStatus>;
  getCallStatus(sid: string): Promise<CallStatus>;
  endCall(sid: string): Promise<CallStatus>;
  validateWebhook(signature: string, url: string, params: Record<string, string>): Promise<boolean>;
}

export interface PhoneNumbersProvider {
  listNumbers(country?: string): Promise<Array<{ phoneNumber: string; friendlyName: string; monthlyCost: number }>>;
  buyNumber(phoneNumber: string): Promise<{ sid: string; phoneNumber: string; monthlyCost: number }>;
  releaseNumber(sid: string): Promise<void>;
}
