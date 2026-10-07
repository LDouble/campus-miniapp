/** revokePendingTimetableBuddyInvitation 撤销成功后才返回解锁关系与分享范围选择的新状态。 */
export const revokePendingTimetableBuddyInvitation = async <
  TInvite extends { token: string },
  TState extends { pendingInvite: TInvite | null },
>(
  state: TState,
  revoke: (token: string) => Promise<unknown>,
): Promise<TState> => {
  const invite = state.pendingInvite
  if (!invite) return state
  await revoke(invite.token)
  return { ...state, pendingInvite: null }
}

/** disconnectTimetableBuddyState 清除关系和创建者邀请，但保留接收到的邀请以便解除后接受。 */
export const disconnectTimetableBuddyState = <
  TConnection,
  TSchedule,
  TPreview,
  TInvite extends { token: string },
>(state: {
  connection: TConnection | null
  schedule: TSchedule | null
  inviteToken: string
  invitationPreview: TPreview | null
  pendingInvite: TInvite | null
}) => ({
  ...state,
  connection: null,
  schedule: null,
  pendingInvite: null,
})
