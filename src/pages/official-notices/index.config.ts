export default definePageConfig({
  enableShareAppMessage: true,
  enableShareTimeline: true,
  navigationStyle: 'custom',
  navigationBarTitleText: '全校通知',
  backgroundColor: '@backgroundColor',
  backgroundTextStyle: '@backgroundTextStyle' as 'dark',
  enablePullDownRefresh: true,
  onReachBottomDistance: 120,
})
