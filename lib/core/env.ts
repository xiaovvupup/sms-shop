import { z } from "zod";

const WRAPPING_QUOTES_REGEX = /^[`"'“”‘’]+|[`"'“”‘’]+$/g;

function sanitizeEnvString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  return value.trim().replace(WRAPPING_QUOTES_REGEX, "");
}

function parseBooleanEnv(value: string, defaultValue: boolean) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return defaultValue;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/activation_sms?schema=public"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32).default("local_dev_only_jwt_secret_change_before_production"),
  SMS_API_BASE_URL: z.string().url().default("https://hero-sms.com/stubs/handler_api.php"),
  SMS_API_KEY: z.string().min(1).default("DUMMY_SMS_API_KEY"),
  SMS_SERVICE_CODE: z.string().min(1).default("ot"),
  SMS_COUNTRY_CODE: z.coerce.number().int().default(6),
  SMS_MAX_PRICE: z.coerce.number().positive().optional(),
  SMS_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SESSION_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(5),
  CHANGE_NUMBER_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(150),
  MAX_NUMBER_CHANGES: z.coerce.number().int().min(0).default(5),
  ACTIVATION_CODES_TXT_PATH: z.string().default("./data/activation-codes.txt"),
  REDEEM_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  SESSION_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  ADMIN_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  WEBHOOK_TOKEN: z.string().optional(),
  WEBHOOK_IP_WHITELIST: z.string().default("84.32.223.53,185.138.88.87"),
  ADMIN_SEED_EMAIL: z.preprocess(sanitizeEnvString, z.string().email().default("admin@example.com")).transform((value) =>
    value.toLowerCase()
  ),
  ADMIN_SEED_PASSWORD: z.preprocess(sanitizeEnvString, z.string().min(8).default("ChangeMe123!")),
  ADMIN_SINGLE_ACCOUNT_MODE: z.preprocess(sanitizeEnvString, z.string().default("true")).transform((value) =>
    parseBooleanEnv(value, true)
  ),
  AUTO_GENERATE_UNUSED_THRESHOLD: z.coerce.number().int().min(1).default(20),
  AUTO_GENERATE_BATCH_SIZE: z.coerce.number().int().min(1).default(400),
  LOW_BALANCE_THRESHOLD_USD: z.coerce.number().positive().default(1),
  CRON_SECRET: z.preprocess(sanitizeEnvString, z.string().optional()),
  MAIL_ENABLED: z.preprocess(sanitizeEnvString, z.string().default("false")).transform((value) =>
    parseBooleanEnv(value, false)
  ),
  MAIL_SMTP_HOST: z.preprocess(sanitizeEnvString, z.string().optional()),
  MAIL_SMTP_PORT: z.coerce.number().int().positive().default(587),
  MAIL_SMTP_SECURE: z.preprocess(sanitizeEnvString, z.string().default("false")).transform((value) =>
    parseBooleanEnv(value, false)
  ),
  MAIL_SMTP_USER: z.preprocess(sanitizeEnvString, z.string().optional()),
  MAIL_SMTP_PASS: z.preprocess(sanitizeEnvString, z.string().optional()),
  MAIL_FROM: z.preprocess(sanitizeEnvString, z.string().optional()),
  MAIL_TO: z.preprocess(sanitizeEnvString, z.string().optional())
});

export const env = envSchema.parse(process.env);
