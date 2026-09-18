import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

describe('project scaffold', () => {
  it('is named wee-app', () => {
    expect(pkg.name).toBe('wee-app')
  })
})
