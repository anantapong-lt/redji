const revenueCards = [
  { label: 'รายได้ทั้งหมด (รวม)', value: '฿40,982.50' },
  { label: 'ยอดขายทั้งหมด', value: '฿49,382.00' },
  { label: 'รายได้ทั้งหมด (ขาย)', value: '฿39,760.69' },
  { label: 'จำนวนการขาย', value: '11,618' },
] as const

export function WriterRevenueSection() {
  return (
    <section className="mt-8" aria-labelledby="writer-revenue-heading">
      <h2 id="writer-revenue-heading" className="text-lg font-bold">
        รายได้และยอดขาย
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {revenueCards.map(({ label, value }) => (
          <article key={label} className="readji-surface rounded-2xl p-5">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-[-0.025em]">{value}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
