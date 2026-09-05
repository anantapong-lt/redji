import { SQL } from 'bun'
import { env, isDev } from '../config/env'

export const db = new SQL({
  url: env.DATABASE_URL,
  prepare: isDev ? false : true,
})
