'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ApiError } from '@/lib/api-client'
import { verifyRegistrationEmail } from '@/controllers/auth.controller'

type VerificationState =
  | { status: 'loading'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

const verificationRequests = new Map<string, Promise<{ message: string }>>()

function requestEmailVerification(token: string): Promise<{ message: string }> {
  const existingRequest = verificationRequests.get(token)
  if (existingRequest) return existingRequest

  const request = verifyRegistrationEmail(token).finally(() => {
    verificationRequests.delete(token)
  })
  verificationRequests.set(token, request)
  return request
}

export function VerifyEmailResult({ token }: { token: string }) {
  const [state, setState] = useState<VerificationState>({
    status: 'loading',
    message: 'กำลังยืนยันอีเมล...',
  })

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'ไม่พบรหัสยืนยันอีเมล' })
      return
    }

    let active = true
    void requestEmailVerification(token)
      .then((result) => {
        if (active) setState({ status: 'success', message: result.message })
      })
      .catch((error) => {
        if (!active) return
        setState({
          status: 'error',
          message: error instanceof ApiError
            ? error.message
            : 'ไม่สามารถยืนยันอีเมลได้ กรุณาลองใหม่อีกครั้ง',
        })
      })

    return () => {
      active = false
    }
  }, [token])

  return (
    <div className="flex flex-col gap-4 text-center">
      <p
        role={state.status === 'error' ? 'alert' : 'status'}
        className={state.status === 'error' ? 'text-destructive' : 'text-foreground'}
      >
        {state.message}
      </p>
      {state.status === 'success' && (
        <Link
          href="/login"
          className="flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          ไปหน้าเข้าสู่ระบบ
        </Link>
      )}
      {state.status === 'error' && (
        <Link href="/register" className="text-sm text-primary hover:underline">
          กลับไปหน้าสมัครสมาชิก
        </Link>
      )}
    </div>
  )
}
