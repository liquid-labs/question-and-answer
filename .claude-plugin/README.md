# Claude Marketplace for question-and-answer

This directory contains the Claude marketplace manifest for the question-and-answer library's plugins.

## What is a Claude Marketplace?

A Claude marketplace is a collection of plugins (skills) that can be installed into Claude Code. This repository serves as a custom marketplace for question-and-answer-related plugins.

## Available Plugins

### create-questions

**Description:** Build interactive CLI questionnaires with validation, conditional logic, parameter mapping, and review capabilities using the question-and-answer library

**Version:** 1.0.0-alpha.24

**Location:** `./skills/create-questions/`

**Features:**
- Progressive disclosure of documentation
- Common implementation patterns (onboarding, config wizards, surveys)
- Complete API reference
- Working examples
- Best practices

## Installation

### Option 1: Add as Custom Marketplace (Recommended)

1. Open Claude Code settings
2. Navigate to Marketplaces section
3. Add custom marketplace with this repository URL:
   ```
   https://github.com/liquid-labs/question-and-answer
   ```
4. Claude Code will read the `.claude-plugin/marketplace.json` file
5. Install the `question-and-answer` plugin from the marketplace

### Option 2: Manual Installation

Clone this repository and copy the skill:

```bash
git clone https://github.com/liquid-labs/question-and-answer.git
cp -r question-and-answer/skills/create-questions ~/.claude/skills/
```

### Option 3: From npm Package

If you've already installed the npm package:

```bash
npm install question-and-answer
cp -r node_modules/question-and-answer/skills/create-questions ~/.claude/skills/
```

## Marketplace Structure

```
.claude-plugin/
├── marketplace.json    # Marketplace manifest
└── README.md          # This file
```

## marketplace.json Format

The `marketplace.json` file defines:
- Marketplace name and owner
- Metadata (description, version)
- List of available plugins with their source paths

Example structure:
```json
{
  "name": "question-and-answer-marketplace",
  "owner": {
    "name": "Zane Rockenbaugh",
    "email": "zane@liquid-labs.com"
  },
  "metadata": {
    "description": "Claude Code plugins for question-and-answer library",
    "version": "1.0.0-alpha.24"
  },
  "plugins": [
    {
      "name": "create-questions",
      "source": "./skills/create-questions",
      "description": "Build interactive CLI questionnaires...",
      "version": "1.0.0-alpha.24"
    }
  ]
}
```

## Verification

After adding the marketplace or installing the skill, verify it's loaded:

1. Open Claude Code
2. Ask: "Do you have the create-questions skill installed?"
3. Claude should confirm and describe its capabilities

You can also check installed skills in Claude Code settings.

## Updating

The marketplace version is synced with the npm package version. When you update the package:

1. The marketplace.json version updates automatically
2. Claude Code will notify you of available updates
3. Update via the marketplace UI or reinstall manually

## Support

For issues or questions:
- **GitHub Issues:** https://github.com/liquid-labs/question-and-answer/issues
- **Documentation:** See [AI_INTEGRATION.md](../AI_INTEGRATION.md)
- **Skill docs:** See [skills/create-questions/](../skills/create-questions/)

## Contributing

To add new plugins to this marketplace:

1. Create the plugin directory with `SKILL.md` file
2. Add entry to `marketplace.json`
3. Update this README
4. Submit a pull request

## License

Apache-2.0 - Same as the question-and-answer library
