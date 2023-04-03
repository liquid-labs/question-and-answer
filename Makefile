BUILD_KEY:=question-and-answer
.DELETE_ON_ERROR:
.PHONY: all build lint lint-fix qa test

SHELL:=bash

default: build

DIST:=dist
QA:=qa
TEST_STAGING:=test-staging
ifndef (SRC)
SRC:=src
endif

.PRECIOUS: $(QA)/unit-test.txt $(QA)/lint.txt

CATALYST_JS_BABEL:=npx babel
CATALYST_JS_JEST:=npx jest
CATALYST_JS_ROLLUP:=npx rollup
CATALYST_JS_ESLINT:=npx eslint

ifndef CATALYST_JS_LIB_SRC_PATH
ifeq ($(SRC)/lib, $(shell ls -d $(SRC)/lib))
CATALYST_JS_LIB_SRC_PATH:=$(SRC)/lib
else ifeq ($(SRC), $(shell ls -d $(SRC)))
CATALYST_JS_LIB_SRC_PATH:=$(SRC)
else
ERROR:=$(error 'CATALYST_JS_LIB_SRC_PATH' is not set and cannot be resolved automatically.)
endif
endif

ifeq ($(SRC)/cli, $(shell ls -d $(SRC)/cli))
CATALYST_JS_CLI_SRC_PATH:=$(SRC)/cli
endif

# all source files (cli and lib)
CATALYST_JS_ALL_FILES_SRC:=$(shell find $(SRC) \( -name "*.js" -o -name "*.mjs" -o -name "*.cjs" \))
CATALYST_JS_TEST_FILES_SRC:=$(shell find $(SRC) -name "*.js")
CATALYST_JS_TEST_FILES_BUILT:=$(patsubst $(SRC)/%, test-staging/%, $(CATALYST_JS_TEST_FILES_SRC))
# all test data (cli and lib)
CATALYST_JS_TEST_DATA_SRC:=$(shell find $(SRC) -path "*/test/data/*" -type f)
CATALYST_JS_TEST_DATA_BUILT:=$(patsubst $(SRC)/%, $(TEST_STAGING)/%, $(CATALYST_JS_TEST_DATA_SRC))
# lib specific files
CATALYST_JS_LIB_FILES_SRC:=$(shell find $(CATALYST_JS_LIB_SRC_PATH) \( -name "*.js" -o -name "*.mjs" -o -name "*.cjs" \) -not -path "*/test/*" -not -name "*.test.js")
CATALYST_JS_LIB:=dist/$(BUILD_KEY).js
# cli speciifc files
ifdef CATALYST_JS_CLI_SRC_PATH
CATALYST_JS_CLI_FILES_SRC:=$(shell find $(CATALYST_JS_CLI_SRC_PATH) \( -name "*.js" -o -name "*.mjs" -o -name "*.cjs" \) -not -path "*/test/*" -not -name "*.test.js")
CATALYST_JS_CLI:=dist/$(BUILD_KEY)-cli.js
endif


# build rules
BUILD_TARGETS+=$(CATALYST_JS_LIB)

INSTALL_BASE:=$(shell npm explore @liquid-labs/catalyst-scripts-node-project -- pwd)

$(CATALYST_JS_LIB): package.json $(CATALYST_JS_LIB_FILES_SRC)
	JS_BUILD_TARGET=$(CATALYST_JS_LIB_SRC_PATH)/index.js \
	  JS_OUT=$(CATALYST_JS_LIB) \
		$(CATALYST_JS_ROLLUP) --config $(INSTALL_BASE)/dist/rollup/rollup.config.mjs

ifdef CATALYST_JS_CLI_SRC_PATH
BUILD_TARGETS+=$(CATALYST_JS_CLI)

$(CATALYST_JS_CLI): package.json $(CATALYST_JS_CLI_FILES_SRC)
	JS_BUILD_TARGET=$(CATALYST_JS_CLI_SRC_PATH)/index.js \
	  JS_OUT=$(CATALYST_JS_CLI).tmp \
		$(CATALYST_JS_ROLLUP) --config $(INSTALL_BASE)/dist/rollup/rollup.config.mjs
	echo '#!/usr/bin/env node' > $@
	cat $@.tmp >> $@
	chmod a+x $@
	# rm $@.tmp
endif


# test
$(CATALYST_JS_TEST_DATA_BUILT): test-staging/%: $(CATALYST_JS_LIB_SRC_PATH)/%
	@echo "Copying test data..."
	@mkdir -p $(dir $@)
	@cp $< $@

# Jest is not picking up the external maps, so we inline them for the test. (As of?)
$(CATALYST_JS_TEST_FILES_BUILT) &: $(CATALYST_JS_ALL_FILES_SRC)
	rm -rf $(TEST_STAGING)
	mkdir -p $(TEST_STAGING)
	NODE_ENV=test $(CATALYST_JS_BABEL) \
		--config-file=$(INSTALL_BASE)/dist/babel/babel.config.cjs \
		--out-dir=./$(TEST_STAGING) \
		--source-maps=inline \
		$(SRC)

# Tried to use '--testPathPattern=$(TEST_STAGING)' awithout the 'cd $(TEST_STAGING)', but it seemed to have no effect'
$(QA)/unit-test.txt: $(CATALYST_JS_TEST_FILES_BUILT) $(CATALYST_JS_TEST_DATA_BUILT)
	mkdir -p $(dir $@)
	echo -n 'Test git rev: ' > $@
	git rev-parse HEAD >> $@
	( set -e; set -o pipefail; \
		( cd $(TEST_STAGING) && $(CATALYST_JS_JEST) \
			--config=$(INSTALL_BASE)/dist/jest/jest.config.js \
			--runInBand 2>&1 ) \
			| tee -a $@ )

TEST_TARGETS+=$(QA)/unit-test.txt

# lint rules
$(QA)/lint.txt: $(CATALYST_JS_LIB_ALL_FILES)
	mkdir -p $(dir $@)
	echo -n 'Test git rev: ' > $@
	git rev-parse HEAD >> $@
	( set -e; set -o pipefail; \
		$(CATALYST_JS_ESLINT) \
			--config $(INSTALL_BASE)/dist/eslint/eslint.config.js \
			--ext .cjs,.js,.mjs,.cjs,.xjs \
			--ignore-pattern '$(DIST)/**/*' \
			--ignore-pattern '$(TEST_STAGING)/**/*' \
			. \
			| tee -a $@ )

LINT_TARGETS+=$(QA)/lint.txt

lint-fix:
	( set -e; set -o pipefail; \
		$(CATALYST_JS_ESLINT) \
			--config $(INSTALL_BASE)/dist/eslint/eslint.config.js \
			--ext .js,.mjs,.cjs,.xjs \
			--ignore-pattern $(DIST)/**/* \
			--ignore-pattern '$(TEST_STAGING)/**/*' \
			--fix . )


build: $(BUILD_TARGETS)

test: $(TEST_TARGETS)

lint: $(LINT_TARGETS)

qa: test lint

all: build