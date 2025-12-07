import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      'example/**',
      'images/**',
      'reader-html/src/main.ts',
      'docs/*.{html,vue}',
      'packages/shared/src/xml2js-parser.ts',
    ],
  },
)
