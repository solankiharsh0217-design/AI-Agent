import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:8787'),

  // Clerk
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),

  // Groq
  GROQ_API_KEY: z.string().min(1),

  // Sarvam
  SARVAM_API_KEY: z.string().min(1),

  // Workers AI
  CF_ACCOUNT_ID: z.string().min(1),
  CF_API_TOKEN: z.string().min(1),

  // Twilio (optional for dev)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),

  // PostHog
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),

  // JWT
  JWT_SECRET: z.string().optional(),

  // Widget
  WIDGET_SECRET: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().optional().transform((val) => val?.split(',') ?? []),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Twilio Webhook
  TWILIO_WEBHOOK_BASE_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}

export function getEnvSafe() {
  return envSchema.safeParse(process.env);
}
