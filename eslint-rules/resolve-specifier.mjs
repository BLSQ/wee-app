import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')

/**
 * Resolves an import specifier written with the '#/' alias or a relative path to an
 * absolute filesystem path, without an extension. Returns undefined for a package
 * import, since nothing in this codebase reaches into src/ through one.
 */
export function resolveSpecifier(fromFile, specifier) {
  if (specifier.startsWith('#/')) return join(SRC_ROOT, specifier.slice(2))
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier)
  return undefined
}
