# Forex Analyzer — нэгдсэн dev команд
#   make setup    — бүх орчинг бэлдэнэ
#   make dev-api  — backend  (http://localhost:8000)
#   make dev-web  — frontend (http://localhost:3000)
#   make test     — pytest smoke тест
# Windows: WSL эсвэл Git Bash ашиглана уу.

PYTHON ?= python3

.PHONY: setup backend-init frontend-init dev-api dev-web test lint typecheck clean

setup: backend-init frontend-init
	@echo "✔ Setup дууслаа: make dev-api ба make dev-web гэж ажиллуулна."

backend-init:
	cd backend && $(PYTHON) -m venv .venv
	cd backend && .venv/bin/pip install --upgrade pip
	cd backend && .venv/bin/pip install -r requirements.txt
	@for d in app app/core app/api app/schemas app/services app/services/market_data app/services/analysis app/services/ai app/utils tests; do \
		mkdir -p backend/$$d && touch backend/$$d/__init__.py; \
	done
	@cd backend && cp -n .env.example .env || true
	@echo "✔ Backend бэлэн (backend/.env үүслээ — нууцуудаа оруулна уу)"

frontend-init:
	cd frontend && npm install
	@cd frontend && cp -n .env.example .env.local || true
	@echo "✔ Frontend бэлэн (frontend/.env.local үүслээ)"

dev-api:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/pytest -q

lint:
	cd backend && .venv/bin/ruff check app tests
	cd backend && .venv/bin/mypy app

typecheck:
	cd frontend && npm run typecheck

clean:
	rm -rf backend/.venv backend/**/__pycache__ frontend/node_modules frontend/.next
