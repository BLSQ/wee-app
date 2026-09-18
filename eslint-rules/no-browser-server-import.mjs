import { relative, sep } from 'node:path'
import { resolveSpecifier, SRC_ROOT } from './resolve-specifier.mjs'

const BROWSER_ZONES = [
  (segments) => segments[0] === 'ui',
  (segments) => segments[0] === 'lib',
  (segments) => segments[0] === 'features' && segments[2] === 'ui',
  (segments) => segments[0] === 'routes' && segments[1] !== 'api',
]

function segmentsOf(absolutePath) {
  const rel = relative(SRC_ROOT, absolutePath)
  if (rel.startsWith('..')) return undefined
  return rel.split(sep)
}

function isBrowserFile(absolutePath) {
  const segments = segmentsOf(absolutePath)
  return segments !== undefined && BROWSER_ZONES.some((matches) => matches(segments))
}

function isServerTarget(absolutePath) {
  const segments = segmentsOf(absolutePath)
  return segments !== undefined && segments[0] === 'server'
}

/** @type {import('eslint').Rule.RuleModule} */
export const noBrowserServerImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow browser code from value-importing server code',
    },
    schema: [],
    messages: {
      browserImportsServer:
        "Browser code imports '{{source}}' from src/server/. Import only types from server code here.",
    },
  },
  create(context) {
    if (!isBrowserFile(context.filename)) return {}

    function check(node) {
      const source = node.source?.value
      if (typeof source !== 'string') return
      const importKind = node.importKind ?? node.exportKind
      if (importKind === 'type') return
      const resolved = resolveSpecifier(context.filename, source)
      if (!resolved) return
      if (isServerTarget(resolved)) {
        context.report({ node, messageId: 'browserImportsServer', data: { source } })
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}
