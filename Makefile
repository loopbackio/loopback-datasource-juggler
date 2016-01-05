TESTER = ./node_modules/.bin/mocha
OPTS = --growl
TESTS = test/*.test.js
E2E_TEST_DIR = test/e2e/*.js

# Default target

.PHONY: help h
help h:
	@echo 'Usage: make [target]'
	@echo 'Targets:'
	@echo '  e  e2e          Run end-to-end tests'
	@echo '  h  help         Print help (this message)'
	@echo '  t  test[s]      Run unit tests and e2e tests'
	@echo '  u  unit         Run unit tests in silent mode'
	@echo '  uv unit-verbose Run unit tests in verbose mode'
	@echo '  uw unit-watch   Run unit tests in watch (--watch) mode'

# Targets

.PHONY: e2e e
e2e e:
	$(TESTER) --reporter spec $(E2E_TEST_DIR)

.PHONY: test tests t
test tests t: unit e2e

.PHONY: unit u
unit u:
	NO_DEPRECATION=loopback-datasource-juggler $(TESTER) $(OPTS) $(TESTS)

.PHONY: unit-verbose uv
unit-verbose uv:
	$(TESTER) $(OPTS) --reporter spec $(TESTS)

.PHONY: unit-watch uw
unit-watch uw:
	$(TESTER) $(OPTS) --watch $(TESTS)

# Deprecated targest (left for backwards compat)

.PHONY: about-testing
about-testing:
	@echo 'DEPRECATED: Use `make help` instead'
	$(MAKE) help

.PHONY: test-verbose
test-verbose:
	@echo 'DEPRECATED: Use `make unit-verbose` instead'
	$(MAKE) unit-verbose

.PHONY: testing
testing:
	@echo 'DEPRECATED: Use `make unit-watch` instead'
	$(MAKE) unit-watch
