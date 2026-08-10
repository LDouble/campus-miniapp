const success = ({ text, structuredContent }) => ({
  isError: false,
  content: [{ type: 'text', text }],
  structuredContent,
})

const failure = (message) => ({
  isError: true,
  content: [{ type: 'text', text: message }],
})

module.exports = { failure, success }
