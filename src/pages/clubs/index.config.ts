export default definePageConfig({
  enableShareAppMessage: true,
  enableShareTimeline: true,
  navigationStyle: 'custom',
  navigationBarTitleText: '社团广场',
  backgroundColor: '@backgroundColor',
  backgroundTextStyle: '@backgroundTextStyle' as 'dark',
  enablePullDownRefresh: true,
  onReachBottomDistance: 120,
})
