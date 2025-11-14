# API Reference

Complete reference for the question-and-answer library.

## Questioner Class

### Constructor

```javascript
new Questioner(options)
```

**Parameters:**

- `options.interactions` (Array, required) - Array of action objects defining the interrogation flow
- `options.initialParameters` (Object, optional) - Pre-populated parameter values. Default: `{}`
- `options.noSkipDefined` (Boolean, optional) - If true, ask questions even if parameter is already defined. Default: `false`
- `options.input` (Stream, optional) - Input stream for readline. Default: `process.stdin`
- `options.output` (Object, optional) - Output handler with `write` method. Default: magic-print
- `options.printOptions` (Object, optional) - Options passed to magic-print. Ignored if `output` provided

**Example:**

```javascript
const questioner = new Questioner({
  interactions: [
    { prompt: "Name?", parameter: "NAME" }
  ],
  initialParameters: { NAME: "Alice" },
  noSkipDefined: false
})
```

### Methods

#### `async question()`

Executes the interrogation flow, processing all actions sequentially.

**Returns:** Promise that resolves when interrogation completes

**Throws:**
- `ArgumentInvalidError` - Validation failed
- `ArgumentMissingError` - Required field missing
- `ArgumentTypeError` - Type mismatch

**Example:**

```javascript
await questioner.question()
```

#### `get(parameter)`

Retrieves the value for a parameter.

**Parameters:**
- `parameter` (String) - Parameter name to retrieve

**Returns:** The parameter value, or `undefined` if not set

**Example:**

```javascript
const name = questioner.get('USER_NAME')
```

#### `getResult(parameter)`

Retrieves the full result object for a parameter.

**Parameters:**
- `parameter` (String) - Parameter name to retrieve

**Returns:** Result object containing:
- `parameter` (String) - Parameter name
- `value` (any) - Resolved value
- `prompt` (String, if question) - The question text
- `disposition` (String) - How action was handled: "answered", "condition-skipped", "defined-skipped"
- Additional fields from the original action

**Example:**

```javascript
const result = questioner.getResult('USER_NAME')
// { parameter: 'USER_NAME', value: 'Alice', prompt: 'What is your name?', disposition: 'answered', ... }
```

#### `has(parameter)`

Checks if a parameter exists.

**Parameters:**
- `parameter` (String) - Parameter name to check

**Returns:** Boolean - true if parameter is defined

**Example:**

```javascript
if (questioner.has('EMAIL')) {
  console.log('Email was provided')
}
```

### Properties

#### `interactions` (getter)

Returns a copy of the interactions array with disposition information.

**Returns:** Array of action objects

**Example:**

```javascript
const interactions = questioner.interactions
```

#### `results` (getter)

Returns a copy of all results.

**Returns:** Array of result objects

**Example:**

```javascript
const results = questioner.results
```

#### `values` (getter)

Returns an object with all parameter/value pairs.

**Returns:** Object mapping parameter names to values

**Example:**

```javascript
const values = questioner.values
// { USER_NAME: 'Alice', AGE: 25, ... }
```

## Action Types

### Question Action

Asks the user for input.

**Required fields:**
- `prompt` (String) - The question text
- `parameter` (String) - Variable name to store answer

**Optional fields:**
- `type` (String) - Data type: "boolean", "bool", "integer", "int", "numeric", "float", "string" (default)
- `default` (any) - Default value
- `options` (Array of Strings) - Fixed choices; creates numbered selection menu
- `multiValue` (Boolean) - Allow multiple comma-separated values. Default: `false`
- `separator` (String) - Custom separator for multiValue. Default: `","`
- `condition` (String) - Expression; skip if falsy
- `validations` (Object) - Validation rules (see Validation section)
- `noSkipDefined` (Boolean) - Ask even if parameter defined. Default: `false`
- `elseSource` (String) - Parameter name to use if condition fails
- `outputOptions` (Object) - Options for magic-print

**Example:**

```javascript
{
  prompt: "What is your email?",
  parameter: "EMAIL",
  type: "string",
  validations: {
    "match-regexp": "^[^@]+@[^@]+\\.[^@]+$"
  }
}
```

### Statement Action

Displays text without user input.

**Required fields:**
- `statement` (String) - Text to display

**Optional fields:**
- `condition` (String) - Expression; skip if falsy
- `outputOptions` (Object) - Options for magic-print

**Example:**

```javascript
{
  statement: "Welcome to the application!",
  condition: "IS_NEW_USER === true"
}
```

### Map Action

Derives new parameters from existing ones.

**Required fields:**
- `maps` (Array) - Array of mapping objects

Each mapping object requires:
- `parameter` (String) - Variable name to store result
- Either:
  - `source` (String) - Expression to evaluate, OR
  - `value` (any) - Literal value

Optional per mapping:
- `type` (String) - Data type for source expressions: "boolean", "integer", "numeric" (required for source)
- `validations` (Object) - Validation rules
- `condition` (String) - Expression; skip if falsy

**Optional action-level fields:**
- `condition` (String) - Expression; skip entire maps action if falsy

**Example:**

```javascript
{
  maps: [
    {
      source: "AGE >= 18",
      parameter: "IS_ADULT",
      type: "boolean"
    },
    {
      value: "default-value",
      parameter: "FALLBACK"
    }
  ],
  condition: "ENVIRONMENT === 'production'"
}
```

### Review Action

Allows user to review and modify previous answers.

**Required fields:**
- `review` (String) - Type of review: "questions", "maps", or "all"

**Optional fields:**
- `condition` (String) - Expression; skip if falsy

**Example:**

```javascript
{
  review: "all"
}
```

**Review behavior:**
- Collects all non-skipped actions since last review
- "questions" - only question actions
- "maps" - only map actions
- "all" - both questions and maps
- User can accept (ENTER), change (new value), or clear (-)
- If user rejects review, results are cleared and interrogation restarts

## Types

### Supported Types

- `"string"` - Default, no coercion
- `"boolean"` or `"bool"` - Coerces to true/false
  - Truthy: "y", "yes", "true" (case-insensitive)
  - Falsy: "n", "no", "false" (case-insensitive)
- `"integer"` or `"int"` - Coerces to integer
- `"numeric"` or `"float"` - Coerces to floating-point number

### Type Usage

```javascript
// Boolean
{ prompt: "Continue?", type: "boolean", parameter: "CONTINUE" }

// Integer
{ prompt: "Age", type: "integer", parameter: "AGE" }

// Numeric
{ prompt: "Price", type: "numeric", parameter: "PRICE" }

// String (default)
{ prompt: "Name", parameter: "NAME" }
```

## Validations

Validation uses [specify-string](https://github.com/liquid-labs/specify-string) format.

### String Validations

```javascript
{
  validations: {
    "min-length": 3,          // Minimum string length
    "max-length": 50,         // Maximum string length
    "match-regexp": "^[a-z]+$"  // Regex pattern (must match)
  }
}
```

### Numeric Validations

```javascript
{
  validations: {
    "min-value": 0,           // Minimum numeric value
    "max-value": 100,         // Maximum numeric value
    "require-exact": 42       // Must equal exact value
  }
}
```

### Boolean Validations

```javascript
{
  validations: {
    "require-truthy": true,   // Must be truthy
    "require-falsy": true     // Must be falsy
  }
}
```

### Multi-value Validations

```javascript
{
  multiValue: true,
  validations: {
    "min-count": 2,           // Minimum number of values
    "max-count": 5            // Maximum number of values
  }
}
```

### Combining Validations

All specified validations must pass:

```javascript
{
  prompt: "Username",
  parameter: "USERNAME",
  validations: {
    "min-length": 3,
    "max-length": 20,
    "match-regexp": "^[a-zA-Z0-9_]+$"
  }
}
```

## Conditions

Conditions use [condition-eval](https://github.com/liquid-labs/condition-eval) syntax.

### Comparison Operators

```javascript
"AGE > 18"
"AGE >= 21"
"AGE < 65"
"AGE <= 30"
"NAME === 'Alice'"
"NAME !== 'Bob'"
```

### Logical Operators

```javascript
"AGE >= 18 && AGE < 65"
"IS_STUDENT === true || IS_SENIOR === true"
"!(IS_BANNED === true)"
```

### Arithmetic (for maps)

```javascript
"PRICE * QUANTITY"
"AGE + 1"
"TOTAL - DISCOUNT"
"HOURS / 60"
"COUNT % 2"
```

### String Comparison

```javascript
"ENVIRONMENT === 'production'"
"USER_TYPE !== 'guest'"
```

### Examples

```javascript
// Conditional question
{
  prompt: "Company name",
  parameter: "COMPANY",
  condition: "IS_BUSINESS === true"
}

// Conditional statement
{
  statement: "Warning: Production mode",
  condition: "ENVIRONMENT === 'production'"
}

// Conditional map
{
  maps: [
    {
      source: "PRICE * 0.9",
      parameter: "DISCOUNTED_PRICE",
      type: "numeric"
    }
  ],
  condition: "IS_MEMBER === true"
}
```

## Multi-value Questions

### Basic Multi-value

```javascript
{
  prompt: "Enter favorite colors",
  multiValue: true,
  parameter: "COLORS"
}
// User enters: red, blue, green
// Result: ["red", "blue", "green"]
```

### Multi-value with Options

```javascript
{
  prompt: "Select features (choose 2-3)",
  multiValue: true,
  options: ["Feature A", "Feature B", "Feature C", "Feature D"],
  parameter: "FEATURES",
  validations: {
    "min-count": 2,
    "max-count": 3
  }
}
// User enters: 1, 3, 4
// Result: ["Feature A", "Feature C", "Feature D"]
```

### Custom Separator

```javascript
{
  prompt: "Enter tags (semicolon-separated)",
  multiValue: true,
  separator: ";",
  parameter: "TAGS"
}
// User enters: tag1; tag2; tag3
// Result: ["tag1", "tag2", "tag3"]
```

## Default Values

### Action-level Defaults

```javascript
{
  prompt: "Port number",
  parameter: "PORT",
  default: 3000,
  type: "integer"
}
```

### Initial Parameters

```javascript
const questioner = new Questioner({
  interactions,
  initialParameters: {
    PORT: 8080,
    HOST: "localhost"
  }
})
```

**Priority:** `initialParameters` > previous answer > `default` field

## Output Formatting

Use magic-print formatting in prompts and statements:

```javascript
{ statement: "This is <em>emphasized<rst>" }
{ statement: "This is <bold>bold<rst>" }
{ statement: "<warn>Warning:<rst> Important message" }
{ statement: "<error>Error:<rst> Something failed" }
{ statement: "<h1>Main Header<rst>" }
{ statement: "<h2>Section Header<rst>" }
{ prompt: "Enter your <bold>full name<rst>", parameter: "NAME" }
```

## Error Types

### ArgumentInvalidError

Thrown when validation fails.

**Properties:**
- `message` - Error description
- `status` - HTTP-style status code

### ArgumentMissingError

Thrown when a required field is missing.

### ArgumentTypeError

Thrown when a value doesn't match expected type.

## Dispositions

Each action gets a disposition indicating how it was handled:

- `"answered"` - Question was asked and answered
- `"condition-skipped"` - Skipped due to falsy condition
- `"defined-skipped"` - Skipped because parameter already defined

Access via:

```javascript
const interactions = questioner.interactions
interactions[0].disposition // "answered"
```

## Advanced Usage

### Custom Output Handler

```javascript
const output = {
  write: (text) => {
    // Custom output logic
    myLogger.log(text)
  }
}

const questioner = new Questioner({
  interactions,
  output
})
```

### Skipping Defined Parameters

By default, questions skip if the parameter is already defined. Override:

```javascript
// Per-action
{
  prompt: "Confirm name",
  parameter: "NAME",
  noSkipDefined: true
}

// Global
const questioner = new Questioner({
  interactions,
  noSkipDefined: true
})
```

### Else Source

Use a fallback parameter if condition fails:

```javascript
{
  prompt: "Enter custom domain",
  parameter: "DOMAIN",
  condition: "USE_CUSTOM_DOMAIN === true",
  elseSource: "DEFAULT_DOMAIN"
}
```

If `USE_CUSTOM_DOMAIN` is false, `DOMAIN` will be set to value of `DEFAULT_DOMAIN`.

## CLI Usage

Test interrogation bundles:

```bash
# Basic usage
npx qna interrogation.json

# With initial parameters
npx qna interrogation.json initial-params.json
```

**interrogation.json format:**

```json
{
  "actions": [
    { "prompt": "Name?", "parameter": "NAME" }
  ]
}
```

**initial-params.json format:**

```json
{
  "NAME": "Alice",
  "AGE": 25
}
```
