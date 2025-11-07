# Distribution Guide for question-and-answer Skill

This document explains how to distribute and install the question-and-answer Claude Code skill.

## Distribution Options

### Option 1: Anthropic Skills Marketplace (Recommended)

Once submitted and approved, users can install via:

```bash
claude-code install-skill question-and-answer
```

**Submission process:**
1. Fork https://github.com/anthropics/skills
2. Add `question-and-answer-skill/` directory to the repository
3. Submit pull request
4. Wait for review and approval

### Option 2: Direct Installation from npm Package

Users can extract the skill from the npm package:

```bash
# Install the npm package
npm install question-and-answer

# Copy skill to Claude Code skills directory
mkdir -p ~/.claude/skills
cp -r node_modules/question-and-answer/question-and-answer-skill ~/.claude/skills/
```

### Option 3: Direct Git Clone

Users can clone directly from the repository:

```bash
# Clone repository
git clone https://github.com/liquid-labs/question-and-answer.git

# Copy skill to Claude Code
mkdir -p ~/.claude/skills
cp -r question-and-answer/question-and-answer-skill ~/.claude/skills/
```

### Option 4: Manual Download

Users can download the skill directory and place it in `~/.claude/skills/`:

1. Download the `question-and-answer-skill/` directory
2. Place in `~/.claude/skills/question-and-answer-skill/`
3. Restart Claude Code

## Verification

After installation, verify the skill is loaded:

1. Open Claude Code
2. Ask: "Do you have the question-and-answer skill installed?"
3. Claude should confirm and describe the skill's capabilities

## Updating the Skill

When the question-and-answer library is updated:

1. Update skill files if API changes
2. Increment skill version in SKILL.md frontmatter (if using versions)
3. Document changes in skill README
4. Submit update to skills marketplace (if applicable)

## Skill Structure

The skill must maintain this structure:

```
question-and-answer-skill/
├── SKILL.md              (Required - main skill file)
├── README.md             (Recommended - skill documentation)
├── patterns.md           (Optional - usage patterns)
├── reference.md          (Optional - API reference)
├── examples/             (Optional - example files)
│   ├── simple-question.json
│   ├── simple-options.json
│   ├── multi-value.json
│   ├── demo.json
│   ├── statement-and-question.json
│   └── required-answers.json
└── DISTRIBUTION.md       (This file)
```

## SKILL.md Requirements

The SKILL.md file must have:

1. YAML frontmatter with required fields:
   ```yaml
   ---
   name: question-and-answer
   description: Build interactive CLI questionnaires with validation, conditional logic, parameter mapping, and review capabilities using the question-and-answer library
   ---
   ```

2. Clear instructions for Claude Code
3. Examples and usage patterns
4. References to additional documentation

## File Size Considerations

Claude Code loads skills into context, so:

- Keep SKILL.md focused and concise
- Use progressive disclosure - reference additional files rather than including everything
- Keep examples small and focused
- Total skill directory should be < 500KB ideally

## Maintenance

The skill should be maintained alongside the library:

- Update when API changes
- Add new patterns as common use cases emerge
- Keep examples current with library version
- Sync with library documentation

## Support

For issues with the skill:

1. Check https://github.com/liquid-labs/question-and-answer/issues
2. Open a new issue if not already reported
3. Tag with "skill" label

## License

The skill is licensed under Apache-2.0, same as the question-and-answer library.
