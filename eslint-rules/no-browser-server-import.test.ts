import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'
import { noBrowserServerImport } from './no-browser-server-import.mjs'
import { SRC_ROOT } from './resolve-specifier.mjs'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parser: tseslint.parser },
})
const file = (relativePath: string) => `${SRC_ROOT}/${relativePath}`

ruleTester.run('no-browser-server-import', noBrowserServerImport, {
  valid: [
    // import type is allowed
    {
      filename: file('ui/AppShell.tsx'),
      code: "import type { Database } from '#/server/db'",
    },
    // a server-side file is not a browser file, so it may import server code as a value
    {
      filename: file('features/device-syncs/api/router.ts'),
      code: "import { publicProcedure } from '#/server/trpc/base'",
    },
    // a route under routes/api/ is server-side
    {
      filename: file('routes/api/trpc/$.ts'),
      code: "import { createContext } from '#/server/trpc/base'",
    },
    // importing another browser-zone file is fine
    {
      filename: file('ui/AppShell.tsx'),
      code: "import { navItems } from '#/features/nav'",
    },
  ],
  invalid: [
    {
      filename: file('ui/AppShell.tsx'),
      code: "import { createDb } from '#/server/db'",
      errors: [{ messageId: 'browserImportsServer' }],
    },
    {
      filename: file('features/device-syncs/ui/SyncsPage.tsx'),
      code: "import { createDb } from '../../../server/db'",
      errors: [{ messageId: 'browserImportsServer' }],
    },
    {
      filename: file('routes/syncs.tsx'),
      code: "import { createDb } from '#/server/db'",
      errors: [{ messageId: 'browserImportsServer' }],
    },
  ],
})
