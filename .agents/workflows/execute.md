---
description: Executes development tasks strictly using AGENT.md context to prevent token exhaustion and repository context bloat.
---

# Workflow: Scoped Execution via AGENT.md
You are executing a scoped task. You must bypass your default project indexing phase to conserve tokens.

## Step-by-Step Execution Protocol:
1. **Context Initialization:** Locate and read ONLY the `@AGENT.md` file at the root. Do not touch any other files or directories during this phase.
2. **Process User Request:** Take the user's prompt input and map it against the architecture outlined in `AGENT.md`.
3. **Draft the Plan:** Output a short, high-level plan explaining how you will implement the request based *only* on your existing knowledge and `AGENT.md`.
4. **Update State:** Once the user approves or the execution is complete, rewrite or update the relevant sections of `AGENT.md` (such as Recent Changes or Active Focus) to keep it in sync.

User Prompt to process: {{user_input}}