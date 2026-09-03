function required(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function requiredSecret(name: string): string {
  const value = required(name)

  if (value.length < 32) {
    throw new Error(`${name} must contain at least 32 characters`)
  }

  return value
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3001),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  DATABASE_URL: required('DATABASE_URL'),
  JWT_ACCESS_SECRET: requiredSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requiredSecret('JWT_REFRESH_SECRET'),
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID?.trim() ?? '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID?.trim() ?? '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY?.trim() ?? '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME?.trim() ?? '',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL?.trim() ?? '',
} as const
