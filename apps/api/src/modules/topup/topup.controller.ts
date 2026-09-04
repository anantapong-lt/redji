import {
  createTopup,
  findTopupById,
  processTmweasyWebhook,
  TopupError,
} from './topup.service'

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

export async function receiveTmweasyWebhook(data: string, signature: string) {
  try {
    await processTmweasyWebhook(data, signature)
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
