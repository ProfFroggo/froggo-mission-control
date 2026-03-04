# Froggo Platform

## Project Structure
- Next.js app on localhost:3000
- SQLite database at ~/froggo/data/froggo.db
- Obsidian vault at ~/froggo/memory/
- MCP servers in tools/

## Agent Communication
- Use chat_post/chat_read MCP tools for async messaging
- Post task activity for all task-related updates
- Use approval_create for anything going external

## Task Lifecycle
blocked → todo → in-progress → internal-review → review → human-review → done

## Key Rules
- Always check task board before starting work
- Always post activity when making decisions
- External actions (tweets, emails, deploys) MUST go through approval_create
- P0/P1 tasks always need Clara review before done
