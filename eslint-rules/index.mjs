import { noBrowserServerImport } from './no-browser-server-import.mjs'
import { noCrossFeatureImport } from './no-cross-feature-import.mjs'

export const localRules = {
  rules: {
    'no-cross-feature-import': noCrossFeatureImport,
    'no-browser-server-import': noBrowserServerImport,
  },
}
