# Contributing to Mission Control Dashboard

Thanks for your interest in contributing to Mission Control! This guide will help you get started.

## Getting Started

1. **Fork and clone** the repository
2. **Install dependencies**: `npm install`
3. **Run dev build**: `npm run dev`
4. **Make changes** in a feature branch
5. **Test your changes**: `npm run test:run`
6. **Submit a pull request** to the `dev` branch

## Branch Strategy

- `main` — Production-ready code (protected, PR only)
- `dev` — Development branch (all PRs go here first)
- `feature/*` — Feature branches (branch from `dev`)
- `fix/*` — Bug fix branches (branch from `dev`)

**NEVER push directly to `main`.** All changes go through `dev` first, then PR to `main`.

## Design System

Mission Control uses a centralized design token system for consistent UI. **All styling should use design tokens**, not hardcoded values.

### Design Tokens Location

All design tokens are defined in [`src/design-tokens.css`](src/design-tokens.css).

### Using Design Tokens

**✅ DO:**
```tsx
// Use CSS variables
<div style={{ 
  padding: 'var(--space-component)',
  backgroundColor: 'var(--mission-control-surface)',
  color: 'var(--mission-control-text)'
}}>

// Use semantic utility classes
<h2 className="text-heading-2">Title</h2>
<p className="text-secondary">Description</p>
```

**❌ DON'T:**
```tsx
// Don't hardcode colors
<div style={{ backgroundColor: '#141414' }}>

// Don't hardcode spacing
<div style={{ padding: '16px' }}>

// Don't hardcode font sizes
<h2 style={{ fontSize: '20px' }}>
```

### Token Categories

- **Spacing**: `--space-inline`, `--space-stack`, `--space-component`, `--space-section`
- **Typography**: `--text-heading`, `--text-body`, `--text-small`, `--text-caption`
- **Colors**: `--mission-control-bg`, `--mission-control-surface`, `--mission-control-text`, `--mission-control-accent`
- **Semantic Colors**: `--color-success`, `--color-error`, `--color-warning`, `--color-info`
- **Borders**: `--radius-sm`, `--radius`, `--radius-lg`
- **Shadows**: `--shadow-sm`, `--shadow`, `--shadow-md`, `--shadow-lg`
- **Component Sizes**: `--icon-md`, `--control-height`, `--avatar`
- **Transitions**: `--duration-fast`, `--ease-out`

**Before adding a new token**, check if an existing one works. If you must add a token:
1. Use semantic naming (purpose over value: `--space-card-padding` not `--space-16`)
2. Add it to the appropriate section in `design-tokens.css`
3. Define values for both dark and light themes
4. Document the use case in a comment

### Testing Themes

The app supports dark (default) and light themes. **Always test your changes in both themes.**

Toggle theme in dev tools or add this to your component:
```tsx
document.documentElement.classList.toggle('light');
```

## Path Management

**NEVER hardcode paths.** Use `os.homedir()` and `path.join()` for filesystem paths on the server side, or environment variables where appropriate.

**✅ DO:**
```tsx
import { homedir } from 'os';
import path from 'path';
const dbPath = path.join(homedir(), 'mission-control', 'data', 'mission-control.db');
```

**❌ DON'T:**
```tsx
const dbPath = '/Users/worker/mission-control/mission-control.db';
```

See [`docs/WORKSPACE-STRUCTURE.md`](docs/WORKSPACE-STRUCTURE.md) for details.

## Code Style

- **Linting**: Run `npm run lint` before committing
- **TypeScript**: Fix all type errors (no `any` without good reason)
- **Formatting**: Use Prettier defaults (auto-format on save recommended)
- **Naming**: 
  - Components: `PascalCase`
  - Functions/variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.tsx` or `PascalCase.tsx` for components

## Component Guidelines

### Structure
```tsx
// 1. Imports
import React from 'react';
import { useStore } from '../store';

// 2. Types
interface Props {
  title: string;
  onClose: () => void;
}

// 3. Component
export const MyComponent: React.FC<Props> = ({ title, onClose }) => {
  // Hooks first
  const [state, setState] = React.useState('');
  
  // Event handlers
  const handleClick = () => {
    // ...
  };
  
  // Render
  return (
    <div style={{ padding: 'var(--space-component)' }}>
      <h2 className="text-heading-2">{title}</h2>
    </div>
  );
};
```

### Best Practices
- Keep components focused (single responsibility)
- Extract reusable logic to custom hooks
- Use semantic HTML (`<button>` not `<div onClick>`)
- Add ARIA labels for accessibility
- Test keyboard navigation (focus states)

## Testing

```bash
# Run all tests
npm run test:run

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test:run path/to/test.test.ts
```

Write tests for:
- Complex logic and utilities
- State management (store actions)
- Critical user flows
- Bug fixes (regression prevention)

## Build and Release

**Development build:**
```bash
npm run dev
# Serves at http://localhost:3000
```

**Production build:**
```bash
npm run build
npm run start
# Serves at http://localhost:3000
```

**NEVER build production from `dev` branch.** Only `main` → production.

## Pull Request Checklist

Before submitting a PR:

- [ ] Code follows design system (uses tokens, not hardcoded values)
- [ ] No hardcoded paths (uses `os.homedir()` + `path.join()`)
- [ ] All tests pass (`npm run test:run`)
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compiles with no errors
- [ ] Tested in both dark and light themes
- [ ] Keyboard navigation works (focus states visible)
- [ ] No console errors in dev tools
- [ ] PR targets `dev` branch (not `main`)

## Database Changes

If your change affects the database schema:

1. **Use `mission-control-db` CLI**, never edit the DB directly
2. Document the change in PR description
3. Test migration on a copy of production data
4. Add rollback instructions

## Contributing Agents

Custom agents can be submitted for inclusion in the core library so all users get them on install.

### Agent file structure

```
.claude/agents/{agent-id}/
├── agent.json       # Manifest (required)
└── soul.md          # Personality + system prompt (required)
```

**`agent.json` required fields:**

```json
{
  "id": "your-agent-id",
  "name": "Agent Display Name",
  "description": "One-sentence description of what the agent does.",
  "color": "#hex",
  "trust_tier": "worker",
  "maxTurns": 20,
  "core": false
}
```

- `trust_tier`: `restricted` | `apprentice` | `worker` | `trusted` | `admin`
- `core: true` is reserved for the 5 built-in agents (mission-control, clara, coder, hr, inbox). Set to `false` for all community submissions — core status is granted by maintainers after review.

### Submission checklist

- [ ] `agent.json` and `soul.md` present
- [ ] `soul.md` clearly defines scope, output format, and escalation rules
- [ ] Agent does not duplicate an existing core agent's purpose
- [ ] No hardcoded paths or credentials in soul.md
- [ ] External actions (email, post, deploy) route through `approval_create` — never fire directly
- [ ] PR title: `feat(agents): add {agent-name} agent`
- [ ] PR targets `dev` branch

## Contributing Modules

Modules add optional UI panels and/or API routes. They appear in the Modules Library and are installed per-user.

### Module file structure

```
src/modules/{module-id}/
├── catalog.json       # Manifest (required)
├── index.ts           # Module entry — registers panel + API routes
└── components/        # React components
```

**`catalog.json` required fields:**

```json
{
  "id": "your-module-id",
  "name": "Module Display Name",
  "description": "One-sentence description.",
  "version": "1.0.0",
  "category": "productivity",
  "core": false,
  "credentials": [],
  "healthCheck": null
}
```

- `core: true` is reserved for the 10 built-in modules. All community modules use `false`.
- `credentials`: array of `CredentialSpec` objects if the module needs API keys; empty array otherwise.

### Submission checklist

- [ ] `catalog.json`, `index.ts`, and at least one component present
- [ ] Module registers cleanly via `ViewRegistry` without side effects on install/uninstall
- [ ] Credentials stored via `/api/settings/{module}.cred.{id}` — never in code or plain files
- [ ] UI follows the design token system (no hardcoded colors or spacing)
- [ ] Passes `npm run lint` and `npm run test:run`
- [ ] PR title: `feat(modules): add {module-name} module`
- [ ] PR targets `dev` branch

## Questions?

- Check the [docs](docs/) folder for detailed guides
- Open a GitHub Discussion for design questions or new agent/module ideas
- Open an issue for bugs
