import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().regex(/^mailto:.+/),
  VISITOR_COOKIE_SECRET: z.string().min(64, 'VISITOR_COOKIE_SECRET must be at least 64 hex chars'),
  OPERATOR_PASSWORD_PEPPER: z.string().min(64, 'OPERATOR_PASSWORD_PEPPER must be at least 64 hex chars'),
  DATABASE_PATH: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8080),
  GEOIP_DB_PATH: z.string().default('/var/lib/tidio-remake/GeoLite2-City.mmdb'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment:\n${msg}`);
  }
  return result.data;
}
