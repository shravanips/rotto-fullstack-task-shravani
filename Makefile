
.PHONY: setup dev

setup:
	npm ci
	npx supabase start
	npx supabase migration up --local
	npx supabase db query --local --file supabase/seed.sql
	node scripts/setup-local.mjs

dev:
	npm run dev
