# Claude Skills for Forest Admin

This directory contains Claude Code skills that enhance AI interactions with Forest Admin.

## Available Skills

### forest-mcp

A skill that guides Claude to effectively query Forest Admin data through MCP tools.

**Installation:**

Add this skill from the [Claude Code Marketplace](https://marketplace.claudecode.dev).

**Usage:**

Once installed, Claude will automatically use this skill when you ask questions like:
- "Find all users with status active"
- "Show orders from last week"
- "How many products are in stock?"

## Creating New Skills

Skills are defined by a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: skill-name
description: When to trigger this skill...
---

# Skill Title

Instructions for Claude...
```

See the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for more details on skill creation.
