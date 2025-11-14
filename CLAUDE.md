# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js library providing command-line question and answer functionality. It allows developers to build interactive CLI interrogation flows with validation, conditional logic, parameter mapping, and review capabilities.

## Core Architecture

### Main Components

**`Questioner` class** (`src/lib/questioner.mjs`) - The primary interface for creating interactive CLI interrogations. It processes an array of "actions" (questions, statements, maps, reviews) sequentially, evaluating conditions and managing parameter state.

**Action types:**
- **Questions**: Interactive prompts that set parameters based on user input
- **Maps**: Derive new parameters from existing ones using condition-eval expressions
- **Statements**: Display text to users
- **Reviews**: Allow users to review and modify previously answered questions

**Key concepts:**
- Actions can have conditions that determine if they execute
- Parameters are skipped if already defined (unless `noSkipDefined` is set)
- The library uses `@liquid-labs/condition-eval` for evaluating boolean/numeric expressions
- Type coercion is handled via `string-input` library (Integer, Numeric, BooleanString)
- Validation is performed using the `specify-string` library

### Directory Structure

```
src/
  cli/
    index.js - CLI entry point for testing interrogation bundles
  lib/
    questioner.mjs - Main Questioner class implementation
    index.js - Library entry point
    lib/
      ib-clone.mjs - Deep clone for interrogation bundles
      translate-type.mjs - Type name normalization
      test/ - Unit tests for utilities
    test/ - Main test suite
```

## Development Commands

### Build
```bash
npm run build
# or
make build
```
Builds ES module (`.mjs`) and CommonJS (`.js`) bundles using Rollup and Babel. Output: `dist/question-and-answer.js` and `dist/question-and-answer.mjs`

### Test
```bash
npm test
# or
make test
```
Runs Jest tests with coverage. Tests are transpiled to `test-staging/` before execution. Coverage reports are generated in `qa/coverage/`.

### Lint
```bash
npm run lint        # Check only
npm run lint:fix    # Auto-fix issues
# or
make lint
make lint-fix
```
Uses `fandl` (find-and-lint) wrapper around ESLint.

### QA (Full quality check)
```bash
npm run qa
# or
make qa
```
Runs both linting and tests with coverage.

### Running Test Files
To run a specific test file:
```bash
cd test-staging && npx jest <test-file-path>
```
Note: Tests must be built first (`npm test` handles this automatically).

### CLI Testing
Test interrogation bundles using the CLI:
```bash
npx qna samples/demo.json
# With initial parameters:
npx qna samples/demo.json samples/var-env.json
```

## Testing Practices

- Tests use Jest with mocked `readline` for simulating user input
- Test helpers are in `src/lib/test/test-data.js`
- Two main test files:
  - `questioner.test.js` - Core functionality, accessors, validation
  - `questioner.qna-flow.test.mjs` - End-to-end interrogation flows
- Mock stdin/stdout using `StringOut` from `magic-print`

## Key Implementation Details

### Answer Processing Flow
1. Actions are processed sequentially by `#processActions()`
2. Conditions are evaluated via `#evalTruth()` using the condition-eval library
3. Questions call `#askQuestion()` which creates a readline interface
4. Answers are validated via `verifyAnswerForm()` including type checking and custom validations
5. Results are stored via `#addResult()` and accessible via `get()` and `getResult()`

### Type System
Types are normalized via `translateType()`:
- `bool`/`boolean` → `BooleanString`
- `int`/`integer` → `Integer`
- `float`/`numeric` → `Numeric`
- Default: `String`

### Multi-value Questions
- Enable via `multiValue: true` in action
- Answers are split by separator (default: comma)
- Validations support `min-count` and `max-count`

### Review Mechanism
Reviews allow users to revisit answers:
- `review: "questions"` - Only question-type actions
- `review: "all"` - Questions and maps
- Users can accept (ENTER) or change values
- Entering `-` clears a value to empty/null
- If rejected, results are cleared and actions re-process

## Build System Notes

- Uses Liquid Labs SDLC workflow with modular Makefiles in `make/`
- Resources (Babel, Rollup, Jest, ESLint configs) come from `@liquid-labs/sdlc-resource-*` packages
- Build outputs to `dist/`, tests to `test-staging/`, QA reports to `qa/`
- Git revision is recorded in QA report files
