# AI Integration Guide

This guide helps AI assistants integrate the `question-and-answer` library into projects effectively.

## Quick Start

```javascript
import { Questioner } from 'question-and-answer'

const interactions = [
  {
    prompt: "What is your name?",
    parameter: "USER_NAME"
  },
  {
    prompt: "Choose a color",
    options: ["red", "blue", "green"],
    parameter: "FAVORITE_COLOR"
  }
]

const questioner = new Questioner({ interactions })
await questioner.question()

// Access results
const name = questioner.get('USER_NAME')
const color = questioner.get('FAVORITE_COLOR')
```

## Core Concepts

### Interrogation Structure

An interrogation is defined by an array of **actions**. Each action must be exactly one of:
- **Question**: `{ prompt, parameter, ... }` - Asks user for input
- **Statement**: `{ statement }` - Displays text
- **Map**: `{ maps: [...] }` - Derives values from existing parameters
- **Review**: `{ review: "questions" | "maps" | "all" }` - Reviews previous answers

### Action Flow

1. Actions execute sequentially
2. Actions skip if their `condition` evaluates falsy
3. Questions/maps skip if `parameter` is already defined (unless `noSkipDefined: true`)
4. Reviews let users modify previous answers; if rejected, the flow restarts

## Common Patterns

### 1. User Onboarding

```javascript
const interactions = [
  { statement: "Welcome! Let's set up your account." },
  {
    prompt: "What's your email?",
    parameter: "EMAIL",
    validations: { "match-regexp": "^[^@]+@[^@]+\\.[^@]+$" }
  },
  {
    prompt: "Choose a username",
    parameter: "USERNAME",
    validations: {
      "min-length": 3,
      "max-length": 20
    }
  },
  {
    prompt: "Enable notifications?",
    type: "boolean",
    parameter: "NOTIFICATIONS",
    default: true
  },
  { review: "questions" }
]
```

### 2. Configuration Wizard

```javascript
const interactions = [
  {
    prompt: "Select environment",
    options: ["development", "staging", "production"],
    parameter: "ENVIRONMENT"
  },
  {
    prompt: "Enter API endpoint",
    parameter: "API_ENDPOINT",
    condition: "ENVIRONMENT === 'production'"
  },
  {
    prompt: "Enable debug mode?",
    type: "boolean",
    parameter: "DEBUG",
    condition: "ENVIRONMENT !== 'production'",
    default: false
  },
  {
    maps: [
      {
        source: "ENVIRONMENT === 'production'",
        parameter: "IS_PROD",
        type: "boolean"
      }
    ]
  }
]
```

### 3. Survey with Validation

```javascript
const interactions = [
  {
    prompt: "Rate your experience (1-10)",
    type: "integer",
    parameter: "RATING",
    validations: {
      "min-value": 1,
      "max-value": 10
    }
  },
  {
    prompt: "What features would you like? (select 2-3)",
    multiValue: true,
    options: ["Dark mode", "Offline support", "Export data", "API access"],
    parameter: "FEATURES",
    validations: {
      "min-count": 2,
      "max-count": 3
    }
  },
  {
    prompt: "Additional comments",
    parameter: "COMMENTS",
    condition: "RATING < 7"
  }
]
```

### 4. Conditional Branching

```javascript
const interactions = [
  {
    prompt: "Are you a new user?",
    type: "boolean",
    parameter: "IS_NEW_USER"
  },
  {
    prompt: "How did you hear about us?",
    options: ["Search", "Social media", "Friend", "Other"],
    parameter: "REFERRAL_SOURCE",
    condition: "IS_NEW_USER === true"
  },
  {
    prompt: "What brings you back?",
    parameter: "RETURN_REASON",
    condition: "IS_NEW_USER === false"
  },
  { review: "all" }
]
```

### 5. Multi-value with Custom Separator

```javascript
const interactions = [
  {
    prompt: "Enter tags for this item",
    multiValue: true,
    separator: ";",
    parameter: "TAGS",
    validations: {
      "min-count": 1,
      "max-count": 5,
      "match-regexp": "^[a-z0-9-]+$"
    }
  }
]
```

## Parameter Types

Use the `type` field to enforce data types:

```javascript
// Boolean
{ prompt: "Enable?", type: "boolean", parameter: "ENABLED" }
// Accepts: y/yes/true/n/no/false (case-insensitive)

// Integer
{ prompt: "How many?", type: "integer", parameter: "COUNT" }
// or "int"

// Numeric (float)
{ prompt: "Enter price", type: "numeric", parameter: "PRICE" }
// or "float"

// String (default)
{ prompt: "Enter name", parameter: "NAME" }
// type: "string" is implicit
```

## Validation Patterns

The `validations` object uses [specify-string](https://github.com/liquid-labs/specify-string) format:

```javascript
{
  validations: {
    // Length constraints
    "min-length": 3,
    "max-length": 50,

    // Value constraints (for numeric types)
    "min-value": 0,
    "max-value": 100,

    // Count constraints (for multiValue)
    "min-count": 2,
    "max-count": 5,

    // Exact match
    "require-exact": "expected-value",

    // Boolean validation
    "require-truthy": true,
    "require-falsy": true,

    // Pattern matching
    "match-regexp": "^[A-Z][a-z]+$"
  }
}
```

## Mapping Expressions

Maps derive new parameters using [condition-eval](https://github.com/liquid-labs/condition-eval) syntax:

```javascript
{
  maps: [
    // Boolean expression
    {
      source: "AGE >= 18",
      parameter: "IS_ADULT",
      type: "boolean"
    },

    // Numeric calculation
    {
      source: "PRICE * QUANTITY",
      parameter: "TOTAL",
      type: "integer"
    },

    // Literal value
    {
      value: "default-value",
      parameter: "FALLBACK"
    },

    // String comparison
    {
      source: "ENVIRONMENT === 'production'",
      parameter: "USE_CDN",
      type: "boolean"
    }
  ]
}
```

## Advanced Features

### Initial Parameters

Pre-populate parameters to skip questions:

```javascript
const initialParameters = {
  USER_NAME: "Alice",
  ENVIRONMENT: "development"
}

const questioner = new Questioner({
  interactions,
  initialParameters
})
```

Questions for pre-defined parameters will be skipped unless `noSkipDefined: true`.

### Custom Output

Provide a custom output handler:

```javascript
const output = {
  write: (text) => {
    // Custom output handling
    console.log(text)
  }
}

const questioner = new Questioner({
  interactions,
  output
})
```

### Accessing Results

```javascript
// Get a single value
const value = questioner.get('PARAMETER_NAME')

// Get full result object
const result = questioner.getResult('PARAMETER_NAME')
// Returns: { parameter, value, prompt, disposition, ... }

// Check if parameter exists
const exists = questioner.has('PARAMETER_NAME')

// Get all results
const allResults = questioner.results

// Get all values
const allValues = questioner.values

// Get interactions (with dispositions)
const interactions = questioner.interactions
```

### Review Behavior

Reviews allow users to verify and modify answers:

```javascript
{ review: "questions" }  // Only review question actions
{ review: "maps" }       // Only review map actions
{ review: "all" }        // Review both questions and maps
```

- User presses ENTER to accept current value
- User enters new value to change
- User enters `-` to clear value (set to empty/null)
- If user rejects, results are cleared and interrogation restarts

### Default Values

Set defaults in two ways:

```javascript
// 1. In the action
{
  prompt: "Enter port",
  parameter: "PORT",
  default: 3000
}

// 2. Via initialParameters (takes precedence)
const questioner = new Questioner({
  interactions,
  initialParameters: { PORT: 8080 }
})
```

### Conditional Execution

Use `condition` with any action type:

```javascript
{
  prompt: "Enter SSL certificate path",
  parameter: "SSL_CERT",
  condition: "USE_HTTPS === true"
}

{
  statement: "Warning: Debug mode enabled",
  condition: "DEBUG === true"
}

{
  maps: [
    { source: "PORT + 1000", parameter: "ADMIN_PORT", type: "integer" }
  ],
  condition: "ENVIRONMENT === 'development'"
}
```

## Error Handling

The library throws standard errors from `standard-error-set`:

```javascript
try {
  await questioner.question()
} catch (error) {
  // ArgumentInvalidError - validation failed
  // ArgumentMissingError - required field missing
  // ArgumentTypeError - type mismatch
  console.error(error.message)
}
```

## Format Output Helper

Use magic-print formatting in prompts and statements:

```javascript
{ statement: "This is <em>emphasized<rst> text" }
{ statement: "This is <bold>bold<rst> text" }
{ statement: "<warn>Warning:<rst> Check your input" }
{ statement: "<h2>Section Header<rst>" }
```

## Testing Interrogations

Use the CLI to test interrogation bundles:

```bash
npx qna path/to/interrogation.json
npx qna path/to/interrogation.json path/to/initial-params.json
```

## Common Integration Tasks

### Generate Project Config

```javascript
const interactions = [
  { prompt: "Project name", parameter: "PROJECT_NAME" },
  { prompt: "Version", parameter: "VERSION", default: "1.0.0" },
  { prompt: "License", options: ["MIT", "Apache-2.0", "GPL-3.0"], parameter: "LICENSE" },
  { review: "questions" }
]

const questioner = new Questioner({ interactions })
await questioner.question()

// Write to package.json
const config = {
  name: questioner.get('PROJECT_NAME'),
  version: questioner.get('VERSION'),
  license: questioner.get('LICENSE')
}
```

### User Preferences

```javascript
const interactions = [
  { prompt: "Theme", options: ["light", "dark", "auto"], parameter: "THEME" },
  { prompt: "Language", options: ["en", "es", "fr"], parameter: "LANG" },
  { prompt: "Enable analytics?", type: "boolean", parameter: "ANALYTICS" }
]

const questioner = new Questioner({ interactions })
await questioner.question()

// Save to preferences file
const prefs = questioner.values
await fs.writeFile('prefs.json', JSON.stringify(prefs, null, 2))
```

### Data Collection Form

```javascript
const interactions = [
  { statement: "Please provide your information:" },
  { prompt: "Full name", parameter: "NAME" },
  { prompt: "Email", parameter: "EMAIL", validations: { "match-regexp": "^.+@.+\\..+$" } },
  { prompt: "Age", type: "integer", parameter: "AGE", validations: { "min-value": 13 } },
  { prompt: "Interests (comma-separated)", multiValue: true, parameter: "INTERESTS" },
  { review: "questions" }
]
```

## Additional Resources

- [Main README](./README.md) - Library overview and user guide
- [condition-eval](https://github.com/liquid-labs/condition-eval) - Expression syntax for conditions and mappings
- [specify-string](https://github.com/liquid-labs/specify-string) - Validation specification format
- [Sample interrogations](./samples/) - Working examples
- [Claude Code Skill](https://github.com/anthropics/skills/question-and-answer) - Interactive integration guide
