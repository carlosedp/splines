# splines: common tasks, as shortcuts for the npm scripts in package.json.
# Recipes only call npm, so they run the same from PowerShell, cmd or Git Bash.
#
#   make            build and serve at http://localhost:8080, reloading on edits
#   make help       list all targets

NPM ?= npm

.PHONY: all help dev dev-all build serve validate validate-online enrich import admin-index invite new install

all: dev

help:
	@echo "Development:"
	@echo "  make dev              build + serve at http://localhost:8080, rebuild and reload on edits"
	@echo "  make dev-all          same, with indexed/declined entries too (local preview only, never deploy)"
	@echo "  make build            the site into dist/"
	@echo "  make serve            serve dist/ without rebuilding"
	@echo "  make install          install dependencies from package-lock.json"
	@echo "Catalog:"
	@echo "  make validate         schema, duplicate and guide checks (offline)"
	@echo "  make validate-online  + repos exist and have a root .lua (uses GITHUB_TOKEN if set)"
	@echo "  make enrich           GitHub stats, READMEs, forks and forum likes into .cache/"
	@echo "  make import           import new entries from external sources (ARGS=\"--dry-run\")"
	@echo "  make admin-index      admin-data/unpublished.json for the admin view"
	@echo "  make invite           invites.md: indexed entries whose authors could be invited (sends nothing)"
	@echo "  make new NAME=<name>  scaffold an entry (ARGS=\"--platform crow\")"
	@echo "Options: ARGS=\"...\" is passed to the tool, e.g. make enrich ARGS=\"--only fx,fx_tanh\""

node_modules: package-lock.json
	$(NPM) ci --no-audit --no-fund

install: node_modules

dev: node_modules
	$(NPM) run dev

dev-all: node_modules
	$(NPM) run dev:all

build: node_modules
	$(NPM) run build -- $(ARGS)

serve:
	$(NPM) run serve

validate: node_modules
	$(NPM) run validate

validate-online: node_modules
	$(NPM) run validate:online -- $(ARGS)

enrich: node_modules
	$(NPM) run enrich -- $(ARGS)

import: node_modules
	$(NPM) run import -- $(ARGS)

admin-index: node_modules
	$(NPM) run admin-index

invite: node_modules
	$(NPM) run invite -- $(ARGS)

new: node_modules
	$(NPM) run new -- $(NAME) $(ARGS)
