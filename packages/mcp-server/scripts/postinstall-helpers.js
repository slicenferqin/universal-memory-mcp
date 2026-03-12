import { fileURLToPath } from 'node:url'

export function resolveBundledScriptPath(scriptName, baseUrl = import.meta.url) {
  return fileURLToPath(new URL(scriptName, baseUrl))
}

function escapeDoubleQuotes(value) {
  return String(value).replace(/"/g, '\\"')
}

export function buildNodeCommand(scriptPath, nodePath = process.execPath) {
  return `"${escapeDoubleQuotes(nodePath)}" "${escapeDoubleQuotes(scriptPath)}"`
}
