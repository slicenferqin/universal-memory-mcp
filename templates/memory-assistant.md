# Memory Assistant Skill

CRITICAL: You MUST use memory tools for EVERY conversation.

## MANDATORY Actions

1. **SEARCH memories first** - Before answering, search for relevant past conversations using `memory_search`
2. **RECORD EVERY response** - After helping user (except simple greetings like "hi"/"thanks"), call `memory_record` with:
   - `user_message`: Brief summary of user's question
   - `ai_response`: Key points of your response
   - `project`: Current project name (from working directory)

3. **STORE important decisions** - Use `memory_update_long_term` for:
   - Architectural decisions
   - Important configuration changes
   - Key insights or lessons learned
   - Parameters: `category` (decisions/architecture/best_practices), `content`

## When to Use Memory

ALWAYS use memory when:

- User asks something that relates to previous work
- You provide code explanations or solutions
- User asks about project status or decisions
- You make recommendations or suggestions

NEVER skip memory recording when conversation has substance.

## Examples

```javascript
// After helping user with a bug fix
await callTool("memory_record", {
  user_message: "Fix failing test in authentication module",
  ai_response:
    "1) Found issue with JWT token validation; 2) Added missing null check; 3) Test now passes",
  project: "auth-service",
});
```

This is NOT optional. Memory recording is REQUIRED for all meaningful conversations.
