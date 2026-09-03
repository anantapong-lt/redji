import { SQL } from 'bun'
import { env } from '../config/env'

export const db = new SQL(env.DATABASE_URL)
