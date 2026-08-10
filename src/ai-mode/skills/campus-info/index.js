// AI 开发模式独立分包入口：接口名称必须和 mcp.json 保持一致。
const searchOfficialNotices = require('./apis/searchOfficialNotices.js')
const queryShuttleSchedule = require('./apis/queryShuttleSchedule.js')
const findEmptyClassrooms = require('./apis/findEmptyClassrooms.js')

const skill = wx.modelContext.createSkill('skills/campus-info')

skill.registerAPI('searchOfficialNotices', searchOfficialNotices)
skill.registerAPI('queryShuttleSchedule', queryShuttleSchedule)
skill.registerAPI('findEmptyClassrooms', findEmptyClassrooms)

console.log('[campus-info] APIs registered')
