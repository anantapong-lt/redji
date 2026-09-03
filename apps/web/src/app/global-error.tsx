'use client'

import './globals.css'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="th">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-bold text-foreground">เกิดข้อผิดพลาดบางอย่าง</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            หน้าเว็บโหลดไม่สำเร็จ กรุณาลองอีกครั้งหรือกลับไปหน้าแรก
          </p>
          {error?.message && (
            <p className="max-w-md rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {error.message}
            </p>
          )}
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              ลองอีกครั้ง
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/'
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              กลับหน้าแรก
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
