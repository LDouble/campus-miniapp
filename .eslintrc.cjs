module.exports = {
  extends: ['taro/react'],
  rules: {
    // Taro transforms static assets referenced with require() during the mini program build.
    'import/no-commonjs': 'off',
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@tarojs/components',
        importNames: ['Input', 'Textarea'],
        message: 'Use KeyboardSafeInput or KeyboardSafeTextarea from components/keyboard-safe-input.',
      }],
    }],
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
  },
  overrides: [{
    files: ['src/components/keyboard-safe-input/index.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  }],
}
