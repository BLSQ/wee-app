import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

describe('project scaffold', () => {
  it('is named wee-app', () => {
    expect(pkg.name).toBe('wee-app')
  })

  it('has no linter dependency, because linting is a backlog ticket', () => {
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(deps).filter((name) => /eslint|biome|oxlint/.test(name))).toEqual([])
  })
})
