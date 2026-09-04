# Backend architecture

- Keep route files declarative. Routes should only define the HTTP path and method, bind request schemas, and forward validated input to a controller.
- Do not place business logic, default-value normalization, service orchestration, or error handling in route files. Keep those responsibilities in controllers.
- Keep database access and data queries in services, and keep request validation definitions in schema files.

# Web UI conventions

- Use `GiTwoCoins` from `react-icons/gi` whenever displaying a coin icon.
- Use `SITE_CONFIG.coinName` instead of hardcoding the coin name in user-facing text.
