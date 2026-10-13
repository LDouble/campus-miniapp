/** createTimetableBuddyStateCoordinator 统一关系读取与操作的顺序，过期读取不能覆盖已完成操作。 */
export const createTimetableBuddyStateCoordinator = () => {
  let readSequence = 0
  let mutationSequence = 0
  let activeMutation: number | null = null
  return {
    beginRead(): number | null {
      if (activeMutation !== null) return null
      readSequence += 1
      return readSequence
    },
    isReadCurrent(ticket: number) {
      return activeMutation === null && ticket === readSequence
    },
    invalidateReads() {
      readSequence += 1
    },
    beginMutation(): number | null {
      if (activeMutation !== null) return null
      readSequence += 1
      mutationSequence += 1
      activeMutation = mutationSequence
      return activeMutation
    },
    isMutationCurrent(ticket: number) {
      return activeMutation === ticket
    },
    finishMutation(ticket: number) {
      if (activeMutation !== ticket) return false
      activeMutation = null
      readSequence += 1
      return true
    },
  }
}
