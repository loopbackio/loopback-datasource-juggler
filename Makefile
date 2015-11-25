TESTER = ./node_modules/.bin/mocha
OPTS = --growl
TESTS = test/*.test.js

default: help

.PHONY: clean
clean:
	rm -rf $(CURDIR)/node_modules

.PHONY: help
help:
	@echo 'Usage: make [target]'
	@echo 'Targets:'
	@echo '  clean        Delete `node_modules`'
	@echo '  help         Print help (this message)'
	@echo '  test         Run tests in silent mode'
	@echo '  test-verbose Run tests in verbose mode'
	@echo '  testing      Run tests continuously'

.PHONY: test
test:
	NO_DEPRECATION=loopback-datasource-juggler $(TESTER) $(OPTS) $(TESTS)

.PHONY: test-verbose
test-verbose:
	$(TESTER) $(OPTS) --reporter spec $(TESTS)

.PHONY: testing
testing:
	$(TESTER) $(OPTS) --watch $(TESTS)

# Deprecated targets

.PHONY: about-testing
about-testing:
	@echo 'DEPRECATED: Use `make help` instead'
	make help
