export const canRearmForegroundPrivateMessagePolling = (
  visible: boolean,
  activeGeneration: number,
  currentGeneration: number,
) => visible && activeGeneration === currentGeneration
