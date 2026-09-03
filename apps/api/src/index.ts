import { Elysia } from 'elysia'

const port = Number(process.env.PORT ?? 3001)

const app = new Elysia()

app.listen(port)

console.log(`API server is running on http://localhost:${port}`)
