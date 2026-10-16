# ─── Anthers Obsidian Makefile ───
# The publishing stack's front door: build, run, deploy, verify.
#
# Local development runs the server straight on the host (no Docker needed to hack on
# the app); the Docker targets are for the droplet deployment and for proving the image.

UNAME_S := $(shell uname -s 2>/dev/null || echo Unknown)

OBSIDIAN_DIR ?= /srv/anthers-obsidian

VAULT_PATH ?= ./vault
PORT ?= 3000

# ─── Help ───
.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ─── Local development (no Docker) ───
.PHONY: install
install: ## Install workspace dependencies
	bun install

.PHONY: dev
dev: ## Run the server locally against VAULT_PATH (default ./vault)
	bun run dev:server

.PHONY: build
build: ## Build the frontend into ./build
	bun run build

.PHONY: typecheck
typecheck: ## Typecheck the workspace
	bunx --bun tsc --noEmit

.PHONY: test
test: ## Run the unit suites
	bun test

# ─── The droplet stack ───
.PHONY: up
up: ## Build and start the whole stack (needs scripts/setup.sh to have run on the host)
	docker compose up -d --build

.PHONY: down
down: ## Stop the stack
	docker compose down

.PHONY: logs
logs: ## Tail the app's logs
	docker compose logs -f app

.PHONY: pull
pull: ## Update the running images to their pinned versions
	docker compose pull && docker compose up -d --no-build

.PHONY: restart
restart: ## Restart the app container (the vault re-indexes on boot)
	docker compose restart app

.PHONY: tunnel
tunnel: ## Print the SSH command that reaches the sync GUI over loopback
	@echo "ssh -L 8384:127.0.0.1:8384 $(shell whoami)@$(WIKI_HOSTNAME)  — then open http://localhost:8384 (set WIKI_HOSTNAME=... or edit this target)"

.PHONY: status
status: ## Health, and what the server's boundary is currently serving
	@curl -s http://127.0.0.1:3000/health && echo
	@docker compose ps

# ─── Verification ───
.PHONY: verify
verify: typecheck test build ## The pre-push gate: typecheck, suites, and a clean build