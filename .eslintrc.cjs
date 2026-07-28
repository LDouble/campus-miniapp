module.exports = {
  "extends": ["taro/react"],
  "rules": {
    // Taro transforms static assets referenced with require() during the mini program build.
    "import/no-commonjs": "off",
    "@typescript-eslint/no-shadow": "warn",
    "react/jsx-closing-bracket-location": "warn",
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off"
  }
}
