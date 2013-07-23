## TESTS

TESTER = ./node_modules/.bin/mocha
OPTS = --growl
TESTS = test/*.test.js

test:
	$(TESTER) $(OPTS) $(TESTS)
test-verbose:
	$(TESTER) $(OPTS) --reporter spec $(TESTS)
testing:
	$(TESTER) $(OPTS) --watch $(TESTS)

about-testing:
	@echo "\n## TESTING\n"
	@echo "  make test               # Run all tests in silent mode"
	@echo "  make test-verbose       # Run all tests in verbose mode"
	@echo "  make testing            # Run tests continuously"


## HELP

help: about-testing

.PHONY: test
