
.PHONY: setup dev

setup:
	npm ci
	npx supabase start
	npx supabase migration up --local
	node scripts/setup-local.mjs

dev:
	npm run dev
