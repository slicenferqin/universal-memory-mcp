# @slicenferqin/opencode-universal-memory

OpenCode plugin that records the last user/assistant exchange into Universal Memory daily logs.

## What it does

- On `session.idle`, fetches the session messages, extracts the last user + assistant pair
- Writes a record using `universal-memory-record` (with fallback to `npx ... universal-memory-mcp`)
- Adds `client=opencode` so multi-agent daily logs can be filtered

## Install

```bash
npm install -g @slicenferqin/opencode-universal-memory
```

The package includes a `postinstall` step that will try to enable itself in your OpenCode global config:

- `~/.config/opencode/opencode.json` (preferred)
- or `~/.config/opencode/opencode.jsonc`

## Controls

- `OPENCODE_CONFIG_PATH=/path/to/opencode.json` choose config file to edit
- `OPENCODE_PLUGIN_AUTOINSTALL=0` disable config auto-edit

## Storage location

Universal Memory storage path is controlled by:

- `MEMORY_PATH=/custom/path`
- or `AI_MEMORY_PATH=/custom/path`

