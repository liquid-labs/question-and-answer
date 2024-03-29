# This file was generated by @liquid-labs/sdlc-projects-workflow-local-node-build.
# Refer to https://npmjs.com/package/@liquid-labs/sdlc-projects-workflow-local-
# node-build for further details

#####
# build dist/question-and-answer-exec.js
#####

SDLC_QUESTION_AND_ANSWER_EXEC_JS:=$(DIST)/question-and-answer-exec.js
SDLC_QUESTION_AND_ANSWER_EXEC_JS_ENTRY=$(SRC)/cli/index.js
BUILD_TARGETS+=$(SDLC_QUESTION_AND_ANSWER_EXEC_JS)

$(SDLC_QUESTION_AND_ANSWER_EXEC_JS): package.json $(SDLC_ALL_NON_TEST_JS_FILES_SRC)
	JS_BUILD_TARGET=$(SDLC_QUESTION_AND_ANSWER_EXEC_JS_ENTRY) \
	  JS_OUT=$@ \
	  JS_OUT_PREAMBLE='#!/usr/bin/env -S node --enable-source-maps' \
	  $(SDLC_ROLLUP) --config $(SDLC_ROLLUP_CONFIG)
	chmod a+x $@

#####
# end dist/question-and-answer-exec.js
#####
