# Common Implementation Patterns

This document provides tested patterns for common use cases with the question-and-answer library.

## Pattern 1: User Onboarding Flow

Interactive user registration with validation and review.

```javascript
import { Questioner } from 'question-and-answer'

const interactions = [
  {
    statement: "Welcome! Let's create your account."
  },
  {
    prompt: "What's your email address?",
    parameter: "EMAIL",
    validations: {
      "match-regexp": "^[^@]+@[^@]+\\.[^@]+$"
    }
  },
  {
    prompt: "Choose a username (3-20 characters)",
    parameter: "USERNAME",
    validations: {
      "min-length": 3,
      "max-length": 20,
      "match-regexp": "^[a-zA-Z0-9_-]+$"
    }
  },
  {
    prompt: "What's your full name?",
    parameter: "FULL_NAME",
    validations: {
      "min-length": 1
    }
  },
  {
    prompt: "Enable email notifications?",
    type: "boolean",
    parameter: "NOTIFICATIONS",
    default: true
  },
  {
    review: "questions"
  }
]

const questioner = new Questioner({ interactions })
await questioner.question()

// Use results
const user = {
  email: questioner.get('EMAIL'),
  username: questioner.get('USERNAME'),
  fullName: questioner.get('FULL_NAME'),
  notifications: questioner.get('NOTIFICATIONS')
}
```

## Pattern 2: Configuration Wizard

Environment-specific configuration with conditional questions.

```javascript
const interactions = [
  {
    statement: "Application Configuration Wizard"
  },
  {
    prompt: "Select environment",
    options: ["development", "staging", "production"],
    parameter: "ENVIRONMENT"
  },
  {
    prompt: "Enter port number",
    type: "integer",
    parameter: "PORT",
    default: 3000,
    validations: {
      "min-value": 1024,
      "max-value": 65535
    }
  },
  {
    prompt: "Enable debug logging?",
    type: "boolean",
    parameter: "DEBUG",
    condition: "ENVIRONMENT !== 'production'",
    default: true
  },
  {
    prompt: "Database host",
    parameter: "DB_HOST",
    default: "localhost"
  },
  {
    prompt: "Database port",
    type: "integer",
    parameter: "DB_PORT",
    default: 5432
  },
  {
    prompt: "Enable SSL?",
    type: "boolean",
    parameter: "USE_SSL",
    condition: "ENVIRONMENT === 'production'",
    default: true
  },
  {
    prompt: "SSL certificate path",
    parameter: "SSL_CERT_PATH",
    condition: "USE_SSL === true"
  },
  {
    maps: [
      {
        source: "ENVIRONMENT === 'production'",
        parameter: "IS_PRODUCTION",
        type: "boolean"
      },
      {
        source: "PORT + 1000",
        parameter: "ADMIN_PORT",
        type: "integer"
      }
    ]
  },
  {
    review: "all"
  }
]

const questioner = new Questioner({ interactions })
await questioner.question()

// Generate config file
const config = {
  environment: questioner.get('ENVIRONMENT'),
  port: questioner.get('PORT'),
  adminPort: questioner.get('ADMIN_PORT'),
  debug: questioner.get('DEBUG'),
  database: {
    host: questioner.get('DB_HOST'),
    port: questioner.get('DB_PORT')
  },
  ssl: {
    enabled: questioner.get('USE_SSL') || false,
    certPath: questioner.get('SSL_CERT_PATH')
  }
}

await fs.writeFile('config.json', JSON.stringify(config, null, 2))
```

## Pattern 3: Survey with Validation

Customer feedback survey with conditional follow-ups.

```javascript
const interactions = [
  {
    statement: "Customer Satisfaction Survey"
  },
  {
    prompt: "How satisfied are you with our product? (1-10)",
    type: "integer",
    parameter: "SATISFACTION",
    validations: {
      "min-value": 1,
      "max-value": 10
    }
  },
  {
    prompt: "What could we improve?",
    parameter: "IMPROVEMENT_FEEDBACK",
    condition: "SATISFACTION < 7"
  },
  {
    prompt: "What features would you like to see? (select 2-3)",
    multiValue: true,
    options: [
      "Dark mode",
      "Offline support",
      "Data export",
      "API access",
      "Mobile app",
      "Collaboration tools"
    ],
    parameter: "DESIRED_FEATURES",
    validations: {
      "min-count": 2,
      "max-count": 3
    }
  },
  {
    prompt: "How likely are you to recommend us? (1-10)",
    type: "integer",
    parameter: "NPS_SCORE",
    validations: {
      "min-value": 1,
      "max-value": 10
    }
  },
  {
    prompt: "Would you like to be contacted about your feedback?",
    type: "boolean",
    parameter: "CONTACT_ME",
    default: false
  },
  {
    prompt: "Email address",
    parameter: "CONTACT_EMAIL",
    condition: "CONTACT_ME === true",
    validations: {
      "match-regexp": "^[^@]+@[^@]+\\.[^@]+$"
    }
  },
  {
    maps: [
      {
        source: "NPS_SCORE >= 9",
        parameter: "IS_PROMOTER",
        type: "boolean"
      },
      {
        source: "SATISFACTION >= 7",
        parameter: "IS_SATISFIED",
        type: "boolean"
      }
    ]
  },
  {
    review: "questions"
  }
]
```

## Pattern 4: Project Initialization

CLI tool for initializing a new project.

```javascript
const interactions = [
  {
    statement: "Initialize New Project"
  },
  {
    prompt: "Project name",
    parameter: "PROJECT_NAME",
    validations: {
      "min-length": 1,
      "max-length": 50,
      "match-regexp": "^[a-z0-9-]+$"
    }
  },
  {
    prompt: "Project description",
    parameter: "DESCRIPTION"
  },
  {
    prompt: "Use TypeScript?",
    type: "boolean",
    parameter: "USE_TYPESCRIPT",
    default: true
  },
  {
    prompt: "Package manager",
    options: ["npm", "yarn", "pnpm"],
    parameter: "PACKAGE_MANAGER",
    default: "npm"
  },
  {
    prompt: "License",
    options: ["MIT", "Apache-2.0", "GPL-3.0", "ISC", "Unlicense"],
    parameter: "LICENSE",
    default: "MIT"
  },
  {
    prompt: "Add linting (ESLint)?",
    type: "boolean",
    parameter: "USE_ESLINT",
    default: true
  },
  {
    prompt: "Add testing framework?",
    options: ["Jest", "Vitest", "Mocha", "None"],
    parameter: "TEST_FRAMEWORK",
    condition: "USE_ESLINT === true"  // If they want linting, likely want testing
  },
  {
    prompt: "Add Git repository?",
    type: "boolean",
    parameter: "INIT_GIT",
    default: true
  },
  {
    maps: [
      {
        source: "USE_TYPESCRIPT === true ? '.ts' : '.js'",
        parameter: "FILE_EXT",
        value: ".ts",
        condition: "USE_TYPESCRIPT === true"
      },
      {
        value: ".js",
        parameter: "FILE_EXT",
        condition: "USE_TYPESCRIPT === false"
      },
      {
        value: "1.0.0",
        parameter: "VERSION"
      }
    ]
  },
  {
    review: "questions"
  }
]

const questioner = new Questioner({ interactions })
await questioner.question()

// Generate package.json
const packageJson = {
  name: questioner.get('PROJECT_NAME'),
  version: questioner.get('VERSION'),
  description: questioner.get('DESCRIPTION'),
  license: questioner.get('LICENSE'),
  scripts: {},
  devDependencies: {}
}

if (questioner.get('USE_TYPESCRIPT')) {
  packageJson.devDependencies.typescript = '^5.0.0'
}

if (questioner.get('USE_ESLINT')) {
  packageJson.devDependencies.eslint = '^8.0.0'
  packageJson.scripts.lint = 'eslint .'
}
```

## Pattern 5: Dynamic Form Builder

Build forms based on field definitions.

```javascript
// Field definitions could come from config/API
const fieldDefinitions = [
  {
    name: 'FIRST_NAME',
    prompt: 'First name',
    type: 'string',
    required: true,
    minLength: 1
  },
  {
    name: 'LAST_NAME',
    prompt: 'Last name',
    type: 'string',
    required: true,
    minLength: 1
  },
  {
    name: 'AGE',
    prompt: 'Age',
    type: 'integer',
    required: true,
    min: 0,
    max: 150
  },
  {
    name: 'COUNTRY',
    prompt: 'Country',
    type: 'string',
    options: ['USA', 'Canada', 'UK', 'Other']
  }
]

// Convert to interrogation
const interactions = fieldDefinitions.map(field => {
  const action = {
    prompt: field.prompt,
    parameter: field.name
  }

  if (field.type) {
    action.type = field.type
  }

  if (field.options) {
    action.options = field.options
  }

  const validations = {}
  if (field.minLength) validations['min-length'] = field.minLength
  if (field.maxLength) validations['max-length'] = field.maxLength
  if (field.min) validations['min-value'] = field.min
  if (field.max) validations['max-value'] = field.max

  if (Object.keys(validations).length > 0) {
    action.validations = validations
  }

  return action
})

// Add review
interactions.push({ review: 'questions' })

const questioner = new Questioner({ interactions })
await questioner.question()
```

## Pattern 6: Multi-Step Wizard with Progress

Show progress through a multi-step process.

```javascript
const interactions = [
  { statement: "<h2>Step 1/3: Personal Information<rst>" },
  { prompt: "Full name", parameter: "NAME" },
  { prompt: "Email", parameter: "EMAIL" },

  { statement: "\n<h2>Step 2/3: Preferences<rst>" },
  { prompt: "Preferred language", options: ["English", "Spanish", "French"], parameter: "LANGUAGE" },
  { prompt: "Timezone", parameter: "TIMEZONE", default: "UTC" },

  { statement: "\n<h2>Step 3/3: Confirmation<rst>" },
  { prompt: "Subscribe to newsletter?", type: "boolean", parameter: "NEWSLETTER", default: false },

  { review: "all" }
]
```

## Pattern 7: Conditional Branching Tree

Complex decision tree with multiple paths.

```javascript
const interactions = [
  {
    prompt: "What type of user are you?",
    options: ["Developer", "Designer", "Manager", "Other"],
    parameter: "USER_TYPE"
  },

  // Developer path
  {
    prompt: "Primary programming language",
    options: ["JavaScript", "Python", "Java", "Go", "Other"],
    parameter: "LANGUAGE",
    condition: "USER_TYPE === 'Developer'"
  },
  {
    prompt: "Years of experience",
    type: "integer",
    parameter: "EXPERIENCE",
    condition: "USER_TYPE === 'Developer'",
    validations: { "min-value": 0, "max-value": 50 }
  },

  // Designer path
  {
    prompt: "Design tools used (select 2-3)",
    multiValue: true,
    options: ["Figma", "Sketch", "Adobe XD", "Illustrator", "Photoshop"],
    parameter: "TOOLS",
    condition: "USER_TYPE === 'Designer'",
    validations: { "min-count": 2, "max-count": 3 }
  },

  // Manager path
  {
    prompt: "Team size",
    type: "integer",
    parameter: "TEAM_SIZE",
    condition: "USER_TYPE === 'Manager'",
    validations: { "min-value": 1 }
  },

  // Common questions for all
  {
    prompt: "Company size",
    options: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
    parameter: "COMPANY_SIZE"
  },

  {
    review: "questions"
  }
]
```

## Pattern 8: Pre-populated with Defaults

Load existing configuration and allow updates.

```javascript
import fs from 'node:fs/promises'

// Load existing config
const existingConfig = JSON.parse(
  await fs.readFile('config.json', 'utf8')
)

const interactions = [
  {
    prompt: "Application name",
    parameter: "APP_NAME"
  },
  {
    prompt: "Port",
    type: "integer",
    parameter: "PORT"
  },
  {
    prompt: "Debug mode",
    type: "boolean",
    parameter: "DEBUG"
  },
  { review: "questions" }
]

const questioner = new Questioner({
  interactions,
  initialParameters: existingConfig
})

await questioner.question()

// Save updated config
const updatedConfig = questioner.values
await fs.writeFile('config.json', JSON.stringify(updatedConfig, null, 2))
```

## Pattern 9: Validation with Custom Error Messages

Combine multiple validations for robust input handling.

```javascript
const interactions = [
  {
    prompt: "Username (alphanumeric, 3-20 chars)",
    parameter: "USERNAME",
    validations: {
      "min-length": 3,
      "max-length": 20,
      "match-regexp": "^[a-zA-Z0-9_]+$"
    }
  },
  {
    prompt: "Password (min 8 chars)",
    parameter: "PASSWORD",
    validations: {
      "min-length": 8
    }
  },
  {
    prompt: "Age (must be 13 or older)",
    type: "integer",
    parameter: "AGE",
    validations: {
      "min-value": 13,
      "max-value": 120
    }
  }
]
```

## Pattern 10: Integration with External Data

Use maps to transform or validate against external data.

```javascript
// Example: Pricing calculator
const interactions = [
  {
    prompt: "Select plan",
    options: ["Basic", "Pro", "Enterprise"],
    parameter: "PLAN"
  },
  {
    prompt: "Number of users",
    type: "integer",
    parameter: "USER_COUNT",
    validations: { "min-value": 1 }
  },
  {
    maps: [
      {
        source: "PLAN === 'Basic' ? 10 : (PLAN === 'Pro' ? 25 : 50)",
        parameter: "PRICE_PER_USER",
        type: "integer"
      },
      {
        source: "PRICE_PER_USER * USER_COUNT",
        parameter: "TOTAL_COST",
        type: "integer"
      },
      {
        source: "USER_COUNT > 100",
        parameter: "ENTERPRISE_DISCOUNT",
        type: "boolean"
      }
    ]
  },
  {
    statement: "<bold>Total monthly cost: $<rst>",
    // Note: In real implementation, concatenate with TOTAL_COST value
  },
  { review: "all" }
]
```

## Best Practices

1. **Order matters** - Define parameters before using them in conditions/maps
2. **Use validations** - Catch errors early with built-in validation
3. **Provide defaults** - Improve UX with sensible defaults
4. **Add reviews** - Let users verify important decisions
5. **Group related questions** - Use statements as section headers
6. **Type everything** - Specify types for non-string data
7. **Test incrementally** - Use `npx qna bundle.json` to test flows
8. **Handle conditionals** - Ensure all code paths are valid
9. **Use maps for calculations** - Keep logic in interrogation, not application code
10. **Document parameters** - Use clear, descriptive parameter names
