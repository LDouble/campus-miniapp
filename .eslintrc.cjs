module.exports = {
  "extends": ["taro/react"],
  "rules": {
    // Taro transforms static assets referenced with require() during the mini program build.
    "import/no-commonjs": "off",
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off"
  }
}
