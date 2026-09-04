Get-ChildItem apps\api\migrations\*.sql | Sort-Object Name | ForEach-Object {
  Get-Content $_.FullName | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d "redji-DB"
}