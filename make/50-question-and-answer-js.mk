# This file was generated by @liquid-labs/sdlc-projects-workflow-local-node-build.
# Refer to https://npmjs.com/package/@liquid-labs/sdlc-projects-workflow-local-
# node-build for further details

#####
# build dist/question-and-answer.js
#####

SDLC_QUESTION_AND_ANSWER_JS:=$(DIST)/question-and-answer.js
SDLC_QUESTION_AND_ANSWER_JS_ENTRY=$(SRC)/lib/index.js
BUILD_TARGETS+=$(SDLC_QUESTION_AND_ANSWER_JS)

$(SDLC_QUESTION_AND_ANSWER_JS): package.json $(SDLC_ALL_NON_TEST_JS_FILES_SRC)
	JS_BUILD_TARGET=$(SDLC_QUESTION_AND_ANSWER_JS_ENTRY) \
	  JS_OUT=$@ \
	  $(SDLC_ROLLUP) --config $(SDLC_ROLLUP_CONFIG)

#####
# end dist/question-and-answer.js
#####
