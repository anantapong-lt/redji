import Link from 'next/link'

interface SectionPaginationProps {
  page: number
  totalPages: number
  pageParam: 'latestPage' | 'popularPage'
  otherPage: number
  otherPageParam: 'latestPage' | 'popularPage'
}

function pageHref(
  pageParam: SectionPaginationProps['pageParam'],
  page: number,
  otherPageParam: SectionPaginationProps['otherPageParam'],
  otherPage: number,
) {
  const params = new URLSearchParams()
  if (page > 1) params.set(pageParam, String(page))
  if (otherPage > 1) params.set(otherPageParam, String(otherPage))
  const query = params.toString()
  return query ? `/?${query}` : '/'
}

export function SectionPagination({
  page,
  totalPages,
  pageParam,
  otherPage,
  otherPageParam,
}: SectionPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="เลือกหน้า" className="mt-8 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link
          href={pageHref(pageParam, page - 1, otherPageParam, otherPage)}
          scroll={false}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-950"
        >
          ก่อนหน้า
        </Link>
      ) : null}

      <span className="text-sm tabular-nums text-zinc-500">
        {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={pageHref(pageParam, page + 1, otherPageParam, otherPage)}
          scroll={false}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-950"
        >
          ถัดไป
        </Link>
      ) : null}
    </nav>
  )
}
