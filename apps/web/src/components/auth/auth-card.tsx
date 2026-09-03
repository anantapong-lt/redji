import Link from 'next/link'

export function AuthCard({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="readji-surface w-full max-w-[600px] rounded-[2rem] p-8 shadow-[0_30px_80px_-42px_rgb(45_29_32_/_0.62)] sm:p-10">
      <Link href="/" className="flex items-center justify-center">
        <span
          role="img"
          aria-label="Readji"
          className="aspect-[1147/925] h-32 bg-gradient-to-r from-[#54252b] to-[#b56871] [mask-image:url(/readji-logo-full.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url(/readji-logo-full.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
        />
      </Link>
      <div className="my-7 border-t border-border/80" />
      <h1 className="mb-6 text-center text-lg font-bold tracking-[-0.02em] text-foreground">{heading}</h1>
      {children}
    </div>
  )
}
