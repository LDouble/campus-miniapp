export type CampusServiceType =
  | 'study' | 'pass-rate' | 'shuttle' | 'library'
  | 'classroom' | 'campus-card' | 'repair' | 'lost'

export type CampusServiceItem = {
  id: string
  title: string
  badge: string
  summary: string
  meta: string
  details: Array<[string, string]>
  notice: string
}

export type CampusServiceConfig = {
  title: string
  subtitle: string
  hero: string
  metric: string
  metricLabel: string
  filters: string[]
  action: string
  items: CampusServiceItem[]
}

export const campusServiceData: Record<CampusServiceType, CampusServiceConfig> = {
  study: {
    title: '自习室', subtitle: '安静学习空间实时查询', hero: '找一间刚刚好的自习室',
    metric: '12', metricLabel: '间当前开放', filters: ['全部', '崂山校区', '鱼山校区'],
    action: '预约座位',
    items: [
      { id: 'study-1', title: '图书馆三楼东区', badge: '较空闲', summary: '插座充足 · 静音区 · 开放至 22:30', meta: '崂山校区 · 剩余 86 座', details: [['开放时间', '07:00—22:30'], ['当前人数', '114 / 200'], ['设施', '电源、Wi-Fi、饮水机'], ['位置', '图书馆三楼东侧']], notice: '请保持安静，离座超过 30 分钟将自动释放座位。' },
      { id: 'study-2', title: '行远楼 A 区公共自习室', badge: '有座位', summary: '讨论友好 · 空调开放 · 无需预约', meta: '崂山校区 · 剩余 34 座', details: [['开放时间', '08:00—21:45'], ['当前人数', '46 / 80'], ['设施', '白板、Wi-Fi'], ['位置', '行远楼 A108']], notice: '本区域允许低声讨论，请勿占用消防通道。' },
    ],
  },
  'pass-rate': {
    title: '课程通过率', subtitle: '选课前看看历史学习数据', hero: '用数据了解课程难度',
    metric: '88%', metricLabel: '全校平均通过率', filters: ['全部', '专业课', '通识课'],
    action: '查看计算说明',
    items: [
      { id: 'rate-1', title: '高等数学（二）', badge: '82%', summary: '近三学年平均通过率，样本 1,286 人', meta: '公共必修 · 4 学分', details: [['平均分', '76.8'], ['通过率', '82%'], ['优秀率', '13%'], ['统计学期', '近 6 个学期']], notice: '数据为匿名历史统计，仅供选课与学习规划参考。' },
      { id: 'rate-2', title: '数据可视化', badge: '94%', summary: '过程性考核占比较高，项目实践为主', meta: '专业选修 · 2.5 学分', details: [['平均分', '84.6'], ['通过率', '94%'], ['优秀率', '28%'], ['统计学期', '近 4 个学期']], notice: '不同教师考核方式可能存在差异，以本学期教学大纲为准。' },
    ],
  },
  shuttle: {
    title: '校园校车', subtitle: '校区通勤班次查询', hero: '下一班校车，不再错过',
    metric: '18 分钟', metricLabel: '距下一班发车', filters: ['崂山→鱼山', '鱼山→崂山', '浮山校区'],
    action: '设置乘车提醒',
    items: [
      { id: 'bus-1', title: '崂山校区 → 鱼山校区', badge: '08:10', summary: '途经浮山校区，预计 55 分钟到达', meta: '候车点：崂山校区南门', details: [['发车时间', '08:10'], ['预计到达', '09:05'], ['车型', '校园大巴'], ['余座', '21 座']], notice: '请提前 10 分钟到达候车点，并主动出示校园身份码。' },
      { id: 'bus-2', title: '鱼山校区 → 崂山校区', badge: '12:40', summary: '工作日班次，节假日可能调整', meta: '候车点：鱼山校区正门', details: [['发车时间', '12:40'], ['预计到达', '13:35'], ['车型', '校园大巴'], ['余座', '16 座']], notice: '班次可能受道路交通影响，请预留充足时间。' },
    ],
  },
  library: {
    title: '图书馆', subtitle: '馆藏、座位与借阅服务', hero: '让每一次查找更轻松',
    metric: '6', metricLabel: '本月已借图书', filters: ['当前借阅', '即将到期', '热门馆藏'],
    action: '扫码借书',
    items: [
      { id: 'lib-1', title: '设计心理学', badge: '借阅中', summary: '唐纳德·A·诺曼 · 中信出版社', meta: '应还日期：2026 年 8 月 3 日', details: [['索书号', 'TB47/NOR'], ['馆藏地', '崂山馆三楼'], ['借阅日期', '2026/07/03'], ['续借次数', '0 / 1']], notice: '图书可在到期前 7 天续借一次，逾期将影响后续借阅。' },
      { id: 'lib-2', title: '海洋文明史', badge: '可借', summary: '海洋历史与文明发展专题馆藏', meta: '崂山馆 · 现有 3 册', details: [['索书号', 'K109/HY'], ['馆藏地', '崂山馆四楼'], ['可借数量', '3 册'], ['预约人数', '0 人']], notice: '馆藏状态实时变化，到馆前可先进行预约保留。' },
    ],
  },
  classroom: {
    title: '空教室', subtitle: '按时段查询可用教室', hero: '临时讨论，也有地方去',
    metric: '24', metricLabel: '间当前空闲', filters: ['当前空闲', '1—2 节', '5—6 节'],
    action: '申请借用',
    items: [
      { id: 'room-1', title: '行远楼 A204', badge: '空闲', summary: '容纳 48 人 · 多媒体教室 · 有空调', meta: '空闲至今日 15:50', details: [['容量', '48 人'], ['空闲时段', '第 5—6 节'], ['设备', '投影、电脑、音响'], ['管理单位', '教务处']], notice: '空闲状态仅供参考，正式活动请提前提交教室借用申请。' },
      { id: 'room-2', title: '教学楼 6208', badge: '空闲', summary: '容纳 80 人 · 阶梯教室', meta: '空闲至今日 17:40', details: [['容量', '80 人'], ['空闲时段', '第 5—8 节'], ['设备', '投影、扩音'], ['管理单位', '教务处']], notice: '请爱护教学设备，离开时关闭照明和空调。' },
    ],
  },
  'campus-card': {
    title: '校园卡', subtitle: '余额、消费与服务管理', hero: '校园消费，心里有数',
    metric: '¥ 126.80', metricLabel: '当前可用余额', filters: ['最近消费', '充值记录', '卡片服务'],
    action: '校园卡充值',
    items: [
      { id: 'card-1', title: '崂山校区第一食堂', badge: '- ¥ 12.50', summary: '餐饮消费', meta: '今天 12:16 · 余额 ¥126.80', details: [['交易时间', '2026/07/25 12:16'], ['交易地点', '第一食堂二层'], ['交易类型', '校园卡消费'], ['交易状态', '成功']], notice: '如对本笔交易有疑问，请在 7 日内联系校园卡服务中心。' },
      { id: 'card-2', title: '线上充值', badge: '+ ¥ 100.00', summary: '微信支付充值', meta: '7 月 22 日 18:32', details: [['充值时间', '2026/07/22 18:32'], ['支付方式', '微信支付'], ['到账金额', '¥100.00'], ['交易状态', '已到账']], notice: '充值通常实时到账，网络繁忙时可能延迟 1—3 分钟。' },
    ],
  },
  repair: {
    title: '校园报修', subtitle: '宿舍与公共设施报修', hero: '发现问题，快速报修',
    metric: '2', metricLabel: '个工单处理中', filters: ['处理中', '待评价', '全部工单'],
    action: '提交新报修',
    items: [
      { id: 'repair-1', title: '宿舍空调无法制冷', badge: '处理中', summary: '维修师傅已接单，预计今天 16:00 前上门', meta: '南海苑 3 号楼 · 工单 R2026072508', details: [['提交时间', '今天 09:18'], ['预约时间', '今天 14:00—16:00'], ['维修人员', '张师傅'], ['联系电话', '校园短号 6618']], notice: '请保持电话畅通，并提前清理设备周边物品。' },
      { id: 'repair-2', title: '公共洗衣机排水异常', badge: '待评价', summary: '维修已完成，等待服务评价', meta: '北海苑 2 号楼 · 工单 R2026072303', details: [['完成时间', '7 月 24 日 15:20'], ['维修结果', '更换排水阀'], ['费用', '校园公共维修免费'], ['状态', '已完成']], notice: '如问题仍未解决，可在详情中申请重新处理。' },
    ],
  },
  lost: {
    title: '失物招领', subtitle: '校内遗失与拾取信息', hero: '让失物更快回到主人身边',
    metric: '16', metricLabel: '条今日新发布', filters: ['全部', '寻找中', '已拾取'],
    action: '发布失物信息',
    items: [
      { id: 'lost-1', title: '蓝色校园卡', badge: '已拾取', summary: '卡面姓名为“周＊宇”，已交至一楼值班室', meta: '博雅楼 · 30 分钟前', details: [['发现地点', '博雅楼一楼'], ['发现时间', '今天 14:10'], ['物品类别', '卡证'], ['保管地点', '博雅楼值班室']], notice: '认领时请提供校园卡姓名及本人有效证件。' },
      { id: 'lost-2', title: '黑色索尼无线耳机', badge: '寻找中', summary: '可能遗落在图书馆三楼西侧', meta: '图书馆 · 2 小时前', details: [['遗失地点', '图书馆三楼西侧'], ['遗失时间', '今天 11:30 左右'], ['物品类别', '数码'], ['特征', '黑色充电盒，右侧有划痕']], notice: '如有线索，请通过页面操作联系发布同学。' },
    ],
  },
}

export const isCampusServiceType = (value?: string): value is CampusServiceType => (
  !!value && Object.prototype.hasOwnProperty.call(campusServiceData, value)
)
