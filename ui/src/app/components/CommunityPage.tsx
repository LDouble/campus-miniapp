import React, { useState } from 'react';
import { Search, Flame, Heart, MessageSquare, Share2, MoreHorizontal, MapPin, ChevronDown, ListFilter, X, Check, Clock, ArrowRight, Package } from 'lucide-react';
import { PostDetail } from './PostDetail';

const topics = ['全部', '闲置', '跑腿', '拼车', '失物招领', '吐槽', '求助', '找搭子'];

// 常规与融合信息流数据
const initialPosts = [
  {
    id: 1,
    topic: '吐槽',
    user: '一颗香橙',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100&h=100',
    time: '刚刚',
    content: '今天二食堂的糖醋排骨绝了！师傅手抖少打了一块，但是味道是真的赞👍 推荐大家都去尝尝！',
    images: ['https://images.unsplash.com/photo-1544025162-811114cd6016?auto=format&fit=crop&q=80&w=400'],
    tags: ['日常', '吃货日记'],
    location: '第二食堂',
    likes: 12,
    comments: 3,
    isOwner: true, // 标记为当前用户发布（主态）
  },
  {
    id: 2,
    topic: '闲置',
    badge: '二手',
    badgeColor: 'bg-purple-100 text-purple-600',
    user: '数码小王子',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100',
    time: '15分钟前',
    title: '出几乎全新的 AirPods Pro 2代',
    content: '换了头戴式耳机，这个闲置了。箱说全，带保护壳，无任何磕碰。同城当面交易，支持验货。',
    price: '¥1200',
    originalPrice: '原价¥1899',
    images: ['https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?auto=format&fit=crop&q=80&w=400'],
    tags: ['九成新', '数码'],
    likes: 15,
    comments: 8,
    isOwner: false,
  },
  {
    id: 5,
    topic: '拼车',
    badge: '拼车',
    badgeColor: 'bg-teal-100 text-teal-600',
    user: '说走就走',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=100&h=100',
    time: '20分钟前',
    title: '找2人一起拼滴滴',
    content: '目前已有2人，车费平摊。带大件行李的同学提前说一声。',
    price: 'AA 约¥15',
    route: { from: '南大门', to: '高铁南站' },
    deadline: '本周五 16:00',
    tags: ['放假回家', '缺2人'],
    likes: 3,
    comments: 4,
    isOwner: false,
  },
  {
    id: 3,
    topic: '跑腿',
    badge: '跑腿',
    badgeColor: 'bg-orange-100 text-orange-600',
    user: '一颗香橙', // 也是当前用户
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100&h=100',
    time: '半小时前',
    title: '求帮忙取个重件快递',
    content: '大件物品，最好有小推车。马上要，有的兄弟接一下！',
    price: '赏金 ¥15',
    route: { from: '南区菜鸟驿站', to: '女生宿舍3栋' },
    deadline: '今天 14:30 前',
    tags: ['急单', '重物'],
    likes: 2,
    comments: 5,
    isOwner: true,
  },
  {
    id: 6,
    topic: '失物招领',
    badge: '拾物招领',
    badgeColor: 'bg-indigo-100 text-indigo-600',
    user: '热心市民小王',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100&h=100',
    time: '45分钟前',
    title: '捡到一张校园卡',
    content: '大家看看有没有认识张伟同学的，帮忙提醒他一下。',
    lostAndFound: {
      type: 'found',
      item: '校园卡 (姓名: 张伟)',
      location: '图书馆三楼C区靠窗',
      time: '今天 10:00 左右',
      status: '已交一楼保安处'
    },
    tags: ['寻失主', '校园卡'],
    likes: 42,
    comments: 2,
    isOwner: false,
  },
  {
    id: 4,
    topic: '找搭子',
    user: '考研加油站',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=100&h=100',
    time: '1小时前',
    content: '图书馆一楼C区有没有人一起拼座？明天早上7点，我帮你占位置，你帮我带杯美式，有的私信。',
    tags: ['找搭子', '考研'],
    location: '校图书馆',
    likes: 24,
    comments: 15,
    isOwner: false,
  }
];

// 二手闲置专属瀑布流数据 (只有在"闲置"Tab才显示)
const initialItems = [
  {
    id: 101,
    title: '全新泡泡玛特盲盒，未拆盒',
    price: '59',
    image: 'https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?auto=format&fit=crop&q=80&w=400',
    seller: '一颗香橙',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100',
    tag: '全新',
    likes: 15,
    isOwner: true,
  },
  {
    id: 102,
    title: '考研政治/英语/数学全套资料（带学姐笔记）',
    price: '50',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400',
    seller: '上岸学姐',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100',
    tag: '可小刀',
    likes: 32,
    isOwner: false,
  },
  {
    id: 103,
    title: '宿舍神器：静音小风扇，风力大',
    price: '15',
    image: 'https://images.unsplash.com/photo-1618365908648-718d483d3120?auto=format&fit=crop&q=80&w=400',
    seller: '怕热星人',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=100',
    tag: '南区自提',
    likes: 5,
    isOwner: false,
  },
  {
    id: 104,
    title: '大四清仓：美的微波炉便宜出',
    price: '80',
    image: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&q=80&w=400',
    seller: '毕业生老李',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100',
    tag: '急出',
    likes: 8,
    isOwner: false,
  }
];

export function CommunityPage({ initialTopic = '全部', onDetailOpenChange }: { initialTopic?: string, onDetailOpenChange?: (isOpen: boolean) => void }) {
  const [activeTopic, setActiveTopic] = useState(initialTopic);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  
  const [feedPosts, setFeedPosts] = useState(initialPosts);
  const [feedItems, setFeedItems] = useState(initialItems);
  const [actionPost, setActionPost] = useState<any>(null);
  const [viewingPost, setViewingPost] = useState<any>(null);

  const handleOpenDetail = (post: any) => {
    setViewingPost(post);
    if (onDetailOpenChange) onDetailOpenChange(true);
  };

  const handleCloseDetail = () => {
    setViewingPost(null);
    if (onDetailOpenChange) onDetailOpenChange(false);
  };

  const getFilterOptions = (filterType: string | null) => {
    switch(filterType) {
      case 'idle-category': return ['全部分类', '数码电子', '书籍资料', '服饰鞋包', '美妆个护', '生活用品'];
      case 'idle-price': return ['默认综合排序', '价格从低到高', '价格从高到低'];
      case 'idle-condition': return ['全部成色', '全新/仅拆封', '九成新', '有使用痕迹'];
      case 'errand-type': return ['全部类型', '代取快递', '代买餐饮', '打印复印', '其他帮办事'];
      case 'errand-sort': return ['默认排序', '赏金最高', '最新发布', '距离最近'];
      case 'errand-urgent': return ['全部订单', '急单优先'];
      case 'carpool-dest': return ['全部目的地', '高铁南站', '国际机场', '市中心商圈', '跨校区'];
      case 'carpool-time': return ['全部时间', '今天', '明天', '本周末'];
      case 'carpool-seat': return ['全部拼车', '只看有座', '我找车', '车找人'];
      default: return ['选项1', '选项2', '选项3'];
    }
  };

  const getFilterTitle = (filterType: string | null) => {
    if (!filterType) return '';
    if (filterType.includes('category') || filterType.includes('type')) return '选择分类';
    if (filterType.includes('price') || filterType.includes('sort')) return '排序方式';
    if (filterType.includes('condition')) return '选择成色';
    if (filterType.includes('dest')) return '选择目的地';
    if (filterType.includes('time')) return '出发时间';
    if (filterType.includes('urgent') || filterType.includes('seat')) return '快捷筛选';
    return '筛选';
  };

  const handleDelete = (id: number) => {
    setFeedPosts(prev => prev.filter(p => p.id !== id));
    setFeedItems(prev => prev.filter(p => p.id !== id));
    setActionPost(null);
  };

  // 根据当前Tab过滤数据
  const displayPosts = activeTopic === '全部' 
    ? feedPosts 
    : feedPosts.filter(post => post.topic === activeTopic);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#f4f7fb]">
      <div className="h-full overflow-y-auto hide-scrollbar pb-24 flex flex-col">
        {/* Sticky Header with Glassmorphism */}
        <div className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-white/60 pt-12 pb-3 px-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">社区</h2>
            <div className="flex-1 flex items-center bg-[#f0f4f8] rounded-full px-4 py-2 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.03),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] border border-white/50 transition-all focus-within:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.05),inset_-3px_-3px_6px_rgba(255,255,255,1)]">
              <Search size={16} className="text-slate-400 mr-2" />
              <input 
                type="text" 
                placeholder={activeTopic === '闲置' ? "搜索二手商品..." : "搜索同学、圈子或话题..."} 
                className="bg-transparent w-full outline-none text-sm text-slate-600 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {topics.map(topic => (
              <button
                key={topic}
                onClick={() => setActiveTopic(topic)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeTopic === topic 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)] border-transparent' 
                  : 'bg-white text-slate-500 border border-slate-100 shadow-[2px_2px_8px_rgba(0,0,0,0.02)] hover:bg-slate-50'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Sub-filters for task-oriented topics */}
          {['闲置', '跑腿', '拼车'].includes(activeTopic) && (
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pt-1 pb-1">
              {activeTopic === '闲置' && (
                <>
                  <button onClick={() => setActiveFilter('idle-category')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'idle-category' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    全部分类 <ChevronDown size={12} className={activeFilter === 'idle-category' ? 'text-blue-500' : 'text-slate-400'}/>
                  </button>
                  <button onClick={() => setActiveFilter('idle-price')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'idle-price' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    价格排序 <ListFilter size={12} className={activeFilter === 'idle-price' ? 'text-blue-500' : 'text-slate-400'}/>
                  </button>
                  <button onClick={() => setActiveFilter('idle-condition')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'idle-condition' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    成色 <ChevronDown size={12} className={activeFilter === 'idle-condition' ? 'text-blue-500' : 'text-slate-400'}/>
                  </button>
                </>
              )}
              {activeTopic === '跑腿' && (
                <>
                  <button onClick={() => setActiveFilter('errand-type')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'errand-type' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    全部类型 <ChevronDown size={12} className={activeFilter === 'errand-type' ? 'text-orange-500' : 'text-slate-400'}/>
                  </button>
                  <button onClick={() => setActiveFilter('errand-sort')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'errand-sort' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    赏金最高 <ListFilter size={12} className={activeFilter === 'errand-sort' ? 'text-orange-500' : 'text-slate-400'}/>
                  </button>
                  <button onClick={() => setActiveFilter('errand-urgent')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'errand-urgent' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    急单优先 <ChevronDown size={12} className={activeFilter === 'errand-urgent' ? 'text-orange-500' : 'text-slate-400'}/>
                  </button>
                </>
              )}
              {activeTopic === '拼车' && (
                <>
                  <button onClick={() => setActiveFilter('carpool-dest')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'carpool-dest' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    目的地 <ChevronDown size={12} className={activeFilter === 'carpool-dest' ? 'text-teal-500' : 'text-slate-400'}/>
                  </button>
                  <button onClick={() => setActiveFilter('carpool-time')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'carpool-time' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    出发时间 <ChevronDown size={12} className={activeFilter === 'carpool-time' ? 'text-teal-500' : 'text-slate-400'}/>
                  </button>
                  <button onClick={() => setActiveFilter('carpool-seat')} className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${activeFilter === 'carpool-seat' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'text-slate-600 bg-slate-50/80 border-slate-200/60 hover:bg-slate-100'}`}>
                    只看有座 <ChevronDown size={12} className={activeFilter === 'carpool-seat' ? 'text-teal-500' : 'text-slate-400'}/>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!['闲置', '跑腿', '拼车'].includes(activeTopic) && (
        <div className="px-4 mt-5 mb-1">
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <Flame size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">校园热议榜</h3>
                <p className="text-xs text-slate-400 mt-0.5"># 2026秋季运动会开幕</p>
              </div>
            </div>
            <button className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-xs font-medium hover:bg-slate-100 transition-colors">
              去围观
            </button>
          </div>
        </div>
      )}

      {/* 闲置Tab专属瀑布流视图 */}
      {activeTopic === '闲置' ? (
        <div className="grid grid-cols-2 gap-3 px-4 mt-4">
          {feedItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => handleOpenDetail({...item, topic: '闲置'})}
              className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col group cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="relative h-36 overflow-hidden bg-slate-100">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                  {item.tag}
                </span>
                {/* 瀑布流中的省略号操作按钮 */}
                <button 
                  onClick={(e) => { e.preventDefault(); setActionPost(item); }}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h4 className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2 mb-2">{item.title}</h4>
                <div className="mt-auto">
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-xs font-bold text-rose-500">¥</span>
                    <span className="text-lg font-extrabold text-rose-500 tracking-tight">{item.price}</span>
                    {item.originalPrice && (
                      <span className="text-[10px] text-slate-400 line-through ml-1">¥{item.originalPrice}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-50 pt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px] flex-shrink-0 border border-blue-200/50">
                        {item.seller.charAt(0)}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate max-w-[60px]">{item.seller}</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-slate-400">
                      <Heart size={12} />
                      <span className="text-[10px]">{item.likes}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 常规与融合信息流视图 (全部, 吐槽, 跑腿, 找搭子等) */
        <div className="flex flex-col gap-3 px-4 mt-3">
          {displayPosts.map(post => (
            <div 
              key={post.id} 
              onClick={() => handleOpenDetail(post)}
              className="bg-white rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            >
              
              {/* Card Header */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 flex items-center justify-center font-bold text-[14px] shadow-sm border border-blue-200/50 flex-shrink-0">
                    {post.user.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[13px] font-bold text-slate-800 leading-none">{post.user}</h4>
                      {post.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none ${post.badgeColor}`}>
                          {post.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-none">{post.time}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActionPost(post); }}
                  className="text-slate-300 hover:text-slate-500 p-0.5"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>

              {/* Title & Content */}
              {post.title && <h4 className="text-[14px] font-bold text-slate-800 mb-1 leading-snug">{post.title}</h4>}
              <p className="text-[13px] text-slate-600 leading-normal mb-2.5">{post.content}</p>

              {/* Structured Task Info for Errand & Carpool */}
              {(post.topic === '跑腿' || post.topic === '拼车') && post.route && (
                <div className="bg-slate-50/80 rounded-xl p-2.5 mb-2.5 border border-slate-100/60 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[12px] text-slate-700 font-medium">
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>{post.route.from}</span>
                    <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>{post.route.to}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock size={12} className="text-blue-500" />
                      {post.topic === '跑腿' ? '期望送达' : '出发时间'}: <span className="text-blue-600 font-medium">{post.deadline}</span>
                    </div>
                    {post.price && <span className="text-rose-500 font-bold">{post.price}</span>}
                  </div>
                </div>
              )}

              {/* Structured Info for Lost & Found */}
              {post.topic === '失物招领' && post.lostAndFound && (
                <div className="bg-indigo-50/40 rounded-xl p-2.5 mb-2.5 border border-indigo-100/50 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5 text-[12px] text-slate-700 font-medium">
                      <Package size={14} className="text-indigo-500" />
                      <span>{post.lostAndFound.item}</span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/80 px-1.5 py-0.5 rounded">
                      {post.lostAndFound.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-indigo-400" />
                      <span>{post.lostAndFound.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-indigo-400" />
                      <span>{post.lostAndFound.time}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Images */}
              {post.images && (
                <div className={`grid gap-1.5 mb-2.5 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {post.images.map((img, idx) => (
                    <img key={idx} src={img} alt="post img" className="w-full h-24 md:h-32 object-cover rounded-xl bg-slate-100" />
                  ))}
                </div>
              )}

              {/* Price / Reward (Non-route specific) */}
              {post.price && !post.route && (
                <div className="flex items-baseline gap-1.5 mb-2.5">
                  <span className="text-[15px] font-bold text-rose-500">{post.price}</span>
                  {post.originalPrice && <span className="text-[10px] text-slate-400 line-through">{post.originalPrice}</span>}
                </div>
              )}

              {/* Tags & Location */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {post.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
                {post.location && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                    <MapPin size={10} />
                    {post.location}
                  </span>
                )}
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-between border-t border-slate-50 pt-2.5 px-1">
                <button className="flex items-center gap-1 text-slate-400 hover:text-rose-500 transition-colors group" onClick={(e) => e.stopPropagation()}>
                  <Heart size={16} className="group-hover:fill-rose-50" />
                  <span className="text-[11px] font-medium">{post.likes}</span>
                </button>
                <button className="flex items-center gap-1 text-slate-400 hover:text-blue-500 transition-colors group" onClick={(e) => e.stopPropagation()}>
                  <MessageSquare size={16} className="group-hover:fill-blue-50" />
                  <span className="text-[11px] font-medium">{post.comments}</span>
                </button>
                <button className="flex items-center gap-1 text-slate-400 hover:text-teal-500 transition-colors group" onClick={(e) => e.stopPropagation()}>
                  <Share2 size={16} />
                  <span className="text-[11px] font-medium">分享</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Action Bottom Sheet (For MoreHorizontal) */}
      {actionPost && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
            onClick={() => setActionPost(null)}
          />
          
          {/* Sheet */}
          <div className="relative bg-white/95 backdrop-blur-xl w-full max-w-md mx-auto rounded-t-[32px] p-6 shadow-2xl pb-10 animate-in slide-in-from-bottom-[100%] duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            
            <div className="flex flex-col gap-2">
              {actionPost.isOwner ? (
                <>
                  <button 
                    onClick={() => setActionPost(null)}
                    className="w-full py-4 text-[15px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-2xl mb-2 transition-colors"
                  >
                    编辑内容
                  </button>
                  <button 
                    onClick={() => handleDelete(actionPost.id)}
                    className="w-full py-4 text-[15px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors"
                  >
                    下架 / 删除
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setActionPost(null)}
                    className="w-full py-4 text-[15px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-2xl mb-2 transition-colors"
                  >
                    分享给朋友
                  </button>
                  <button 
                    onClick={() => setActionPost(null)}
                    className="w-full py-4 text-[15px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors"
                  >
                    举报该内容
                  </button>
                </>
              )}
            </div>
            
            <button 
              onClick={() => setActionPost(null)} 
              className="w-full mt-4 py-4 text-[15px] font-bold text-slate-400 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Filter Bottom Sheet */}
      {activeFilter && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
            onClick={() => setActiveFilter(null)}
          />
          
          {/* Sheet */}
          <div className="relative bg-white/95 backdrop-blur-xl w-full max-w-md mx-auto rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-white pb-12 transition-transform duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-800">{getFilterTitle(activeFilter)}</h3>
              <button onClick={() => setActiveFilter(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col mt-2">
              {getFilterOptions(activeFilter).map((opt, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveFilter(null)}
                  className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0 group"
                >
                  <span className={`text-[15px] font-medium transition-colors ${i === 0 ? 'text-blue-500' : 'text-slate-600 group-hover:text-blue-500'}`}>
                    {opt}
                  </span>
                  {i === 0 && <Check size={18} className="text-blue-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {viewingPost && (
        <PostDetail post={viewingPost} onBack={handleCloseDetail} />
      )}
    </div>
  );
}
