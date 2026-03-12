import { describe, expect, it } from 'vitest'
import {
  buildNodeCommand,
  resolveBundledScriptPath,
} from '../scripts/postinstall-helpers.js'

describe('postinstall helpers', () => {
  it('decodes encoded file URLs when resolving bundled script paths', () => {
    const resolved = resolveBundledScriptPath(
      'universal-memory-stop-hook.mjs',
      'file:///tmp/Program%20Files/universal-memory/postinstall.js'
    )

    expect(resolved).toContain('/tmp/Program Files/universal-memory/')
    expect(resolved).toMatch(/universal-memory-stop-hook\.mjs$/)
    expect(resolved).not.toContain('%20')
  })

  it('quotes node and script paths in hook commands', () => {
    const command = buildNodeCommand(
      'C:\\Users\\Test User\\.claude\\hooks\\universal-memory-stop-hook.mjs',
      'C:\\Program Files\\nodejs\\node.exe'
    )

    expect(command).toBe(
      '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\Test User\\.claude\\hooks\\universal-memory-stop-hook.mjs"'
    )
  })
})
