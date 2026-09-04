import { env } from '../../config/env'
import { subscribeToTopupEvents } from './topup.events'
import {
  createTopup,
  findTopupById,
  processTmweasyWebhook,
  TopupError,
} from './topup.service'

interface TopupSocket {
  id: string
  send(message: string): unknown
  close(code?: number, reason?: string): unknown
}

const socketUnsubscribers = new Map<string, () => void>()

function clientIpFromRequest(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim()
  if (cloudflareIp) return cloudflareIp

  const forwardedIp = request.headers.get('x-forwarded-for')
    ?.split(',', 1)[0]
    ?.trim()
  return forwardedIp || '127.0.0.1'
}

function topupErrorResponse(error: unknown) {
  if (error instanceof TopupError) {
    return Response.json({ message: error.message }, { status: error.statusCode })
  }

  console.error('Unable to process topup request', error)
  return Response.json(
    { message: 'ไม่สามารถดำเนินการเติมเงินได้ กรุณาลองใหม่อีกครั้ง' },
    { status: 500 },
  )
}

export async function createUserTopup(
  currentUserId: string,
  amount: number,
  request: Request,
) {
  try {
    const result = await createTopup(
      currentUserId,
      amount,
      clientIpFromRequest(request),
    )
    return Response.json(result, { status: 201 })
  } catch (error) {
    return topupErrorResponse(error)
  }
}

export async function getUserTopup(currentUserId: string, topupId: string) {
  try {
    const transaction = await findTopupById(currentUserId, topupId)
    if (!transaction) {
      return Response.json({ message: 'ไม่พบรายการเติมเงิน' }, { status: 404 })
    }

    return { transaction }
  } catch (error) {
    return topupErrorResponse(error)
  }
}

export async function receiveTmweasyWebhook(
  data: string | Record<string, unknown>,
  signature: string,
) {
  try {
    const serializedData = typeof data === 'string' ? data : JSON.stringify(data)
    await processTmweasyWebhook(serializedData, signature)
    return Response.json({ status: 1 })
  } catch (error) {
    if (error instanceof TopupError) {
      return Response.json(
        { status: 0, message: error.message },
        { status: error.statusCode },
      )
    }

    console.error('Unable to process TMW Easy webhook', error)
    return Response.json(
      { status: 0, message: 'ไม่สามารถยืนยันการชำระเงินได้' },
      { status: 500 },
    )
  }
}

export async function authorizeTopupSocket(
  currentUserId: string | null | undefined,
  topupId: string,
  origin: string | null,
) {
  if (origin !== new URL(env.WEB_ORIGIN).origin) {
    return Response.json({ message: 'ไม่อนุญาตให้เชื่อมต่อ' }, { status: 403 })
  }

  if (!currentUserId) {
    return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  }

  const transaction = await findTopupById(currentUserId, topupId)
  if (!transaction) {
    return Response.json({ message: 'ไม่พบรายการเติมเงิน' }, { status: 404 })
  }
}

export async function openTopupSocket(
  socket: TopupSocket,
  currentUserId: string,
  topupId: string,
) {
  const sendTransaction = (transaction: Awaited<ReturnType<typeof findTopupById>>) => {
    if (!transaction) return
    socket.send(JSON.stringify({ type: 'topup.updated', transaction }))
  }
  const unsubscribe = subscribeToTopupEvents(topupId, sendTransaction)

  socketUnsubscribers.get(socket.id)?.()
  socketUnsubscribers.set(socket.id, unsubscribe)

  try {
    const transaction = await findTopupById(currentUserId, topupId)
    if (!transaction) {
      closeTopupSocket(socket.id)
      socket.close(1008, 'Topup not found')
      return
    }

    if (socketUnsubscribers.has(socket.id)) sendTransaction(transaction)
  } catch (error) {
    console.error('Unable to open topup WebSocket', error)
    closeTopupSocket(socket.id)
    socket.close(1011, 'Unable to load topup')
  }
}

export function closeTopupSocket(socketId: string) {
  socketUnsubscribers.get(socketId)?.()
  socketUnsubscribers.delete(socketId)
}
