import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { noCrossFeatureImport } from './no-cross-feature-import.mjs'
import { SRC_ROOT } from './resolve-specifier.mjs'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})
const file = (relativePath: string) => `${SRC_ROOT}/${relativePath}`

ruleTester.run('no-cross-feature-import', noCrossFeatureImport, {
  valid: [
    {
      filename: file('features/device-syncs/ui/SyncsPage.tsx'),
      code: "import { SyncTable } from './SyncTable'",
    },
    {
      filename: file('features/router.ts'),
      code: "import { deviceSyncsRouter } from './device-syncs/api/router'",
    },
    {
      filename: file('routes/syncs.tsx'),
      code: "import { SyncsPage } from '#/features/device-syncs/ui/SyncsPage'",
    },
  ],
  invalid: [
    {
      filename: file('features/other-feature/ui/Bad.tsx'),
      code: "import { SyncTable } from '../../device-syncs/ui/SyncTable'",
      errors: [{ messageId: 'crossFeature' }],
    },
    {
      filename: file('features/other-feature/ui/Bad.tsx'),
      code: "import { SyncTable } from '#/features/device-syncs/ui/SyncTable'",
      errors: [{ messageId: 'crossFeature' }],
    },
  ],
})
