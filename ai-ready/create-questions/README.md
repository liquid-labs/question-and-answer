# create-questions Claude Code Skill

This skill helps Claude Code assist developers in integrating the `question-and-answer` library into their Node.js projects to create interactive CLI questionnaires.

## What is question-and-answer?

A library for building interactive CLI questionnaires with validation, conditional logic, parameter mapping, and review capabilities.

## Installation

### For Claude Code Users

1. Install via the Claude marketplace or manually:
   ```bash
   # Option 1: Via marketplace
   # Add https://github.com/liquid-labs/question-and-answer as marketplace
   # Then install create-questions plugin

   # Option 2: Manually
   mkdir -p ~/.claude/skills
   cp -r ai-ready/create-questions ~/.claude/skills/
   ```

2. The skill will be automatically loaded by Claude Code when relevant

### For NPM Package Users

The question-and-answer library itself is installed via npm:

```bash
npm install question-and-answer
```

## Skill Contents

- **SKILL.md** - Main skill instructions for Claude Code
- **patterns.md** - Common implementation patterns (onboarding, configuration, surveys, etc.)
- **reference.md** - Complete API reference
- **examples/** - Working interrogation bundle samples

## How It Works

When you ask Claude Code to help with interactive CLI questionnaires, surveys, or configuration wizards, this skill provides:

1. **Progressive disclosure** - Claude loads only the information it needs
2. **Structured guidance** - Clear patterns for common use cases
3. **Working examples** - Real interrogation bundles to reference
4. **Complete API docs** - Full reference when needed

## Example Usage

Ask Claude Code:

> "Help me create a user onboarding flow with email validation and a review step"

> "Build a configuration wizard for a Node.js app with environment-specific questions"

> "Create a survey that collects ratings and conditional feedback"

Claude Code will use this skill to generate appropriate interrogation bundles using the question-and-answer library.

## Skill Structure

The skill follows Anthropic's progressive disclosure pattern:

1. **Level 1**: Skill name and description (always loaded)
2. **Level 2**: SKILL.md main instructions (loaded when relevant)
3. **Level 3**: patterns.md, reference.md, examples (loaded as needed)

## Contributing

This skill is part of the question-and-answer npm package. To suggest improvements:

1. Open an issue at https://github.com/liquid-labs/question-and-answer/issues
2. Submit a pull request with your changes
3. Follow the existing pattern structure

## Resources

- [question-and-answer on npm](https://www.npmjs.com/package/question-and-answer)
- [GitHub Repository](https://github.com/liquid-labs/question-and-answer)
- [AI Integration Guide](../AI_INTEGRATION.md)

## License

Apache-2.0 (same as the question-and-answer library)
