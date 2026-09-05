# Backend architecture

- Keep route files declarative. Routes should only define the HTTP path and method, bind request schemas, and forward validated input to a controller.
- Do not place business logic, default-value normalization, service orchestration, or error handling in route files. Keep those responsibilities in controllers.
- Keep database access and data queries in services, and keep request validation definitions in schema files.

# Web UI conventions

- Use shadcn/ui components when building or updating Web UI. Reuse existing shadcn/ui components in the project instead of creating custom equivalents.
- Use `GiTwoCoins` from `react-icons/gi` whenever displaying a coin icon.
- Use `SITE_CONFIG.coinName` instead of hardcoding the coin name in user-facing text.

# Coin amounts and revenue rounding

- Keep coin amounts and revenue consistent with the chapter-purchase balance update: use PostgreSQL `NUMERIC` and `ROUND(amount, 2)` (nearest two decimal places; halfway values round up for non-negative amounts), not `CEIL` or always-round-up behavior.
- Calculate and round writer revenue per purchase: `ROUND(price * (1 - writer_commission_percent / 100), 2)`. Calculate platform revenue as `price - writer_revenue` so the two amounts always sum to the purchase price.
- Use the stored purchase revenue to credit the writer balance. Dashboard statistics and reports must sum the stored `price`, `writer_revenue`, and `platform_revenue`; do not recalculate historical revenue from the current commission config or apply a commission to an aggregated sales total.
- Return monetary aggregates as decimal strings rounded to two places, including `0.00` for empty totals. All Web pages must display coin amounts with exactly two decimal places and must not independently recalculate commissions. Counts remain integers.
