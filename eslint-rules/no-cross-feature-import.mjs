import { relative, sep } from 'node:path'
import { resolveSpecifier, SRC_ROOT } from './resolve-specifier.mjs'

// Returns the feature name for a path under src/features/<name>/..., or undefined for
// a path outside src/features/ or directly in it (router.ts, nav.ts: not inside a
// feature folder, so outside this rule's reach without a special case).
function featureNameOf(absolutePath) {
  const rel = relative(SRC_ROOT, absolutePath)
  if (rel.startsWith('..')) return undefined
  const segments = rel.split(sep)
  if (segments[0] !== 'features' || segments.length <= 2) return undefined
  return segments[1]
}

/** @type {import('eslint').Rule.RuleModule} */
export const noCrossFeatureImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow importing across features, except through the feature registry',
    },
    schema: [],
    messages: {
      crossFeature:
        "Feature '{{from}}' imports from feature '{{target}}'. A feature's files stay inside its own folder; wire it up through router.ts or nav.ts instead.",
    },
  },
  create(context) {
    const ownFeature = featureNameOf(context.filename)
    if (!ownFeature) return {}

    function check(node) {
      const source = node.source?.value
      if (typeof source !== 'string') return
      const resolved = resolveSpecifier(context.filename, source)
      if (!resolved) return
      const targetFeature = featureNameOf(resolved)
      if (targetFeature && targetFeature !== ownFeature) {
        context.report({
          node,
          messageId: 'crossFeature',
          data: { from: ownFeature, target: targetFeature },
        })
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}
