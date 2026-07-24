import React from 'react';
import { Heart, MessageSquare, MoreHorizontal, MapPin, Clock } from 'lucide-react';

const feedData = [
  {
    id: 1,
    type: '跑腿',
    typeColor: 'bg-orange-100 text-orange-600',
    user: '李同学',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100',
    time: '10分钟前',
    title: '求帮忙取个快递，南区菜鸟驿站',
    desc: '大件物品，最好有小推车，酬劳15元，送到男生宿舍3栋。',
    tags: ['急单', '南区'],
    likes: 2,
    comments: 5,
  },
  {
    id: 2,
    type: '二手',
    typeColor: 'bg-purple-100 text-purple-600',
    user: '王同学',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100&h=100',
    time: '45分钟前',
    title: '出几乎全新的九成新山地车',
    desc: '去年买的，很少骑，带锁带车灯。毕业清仓，便宜出，可小刀。',
    price: '¥280',
    tags: ['可小刀', '自提'],
    likes: 12,
    comments: 8,
  }
];

export function CommunityFeed() {
  return (
    <div className="px-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">最新动态</h3>
        <button className="text-sm font-medium text-slate-400 hover:text-blue-500">查看更多</button>
      </div>
      
      <div className="flex flex-col gap-4 pb-8">
        {feedData.map((item) => (
          <div key={item.id} className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            {/* User header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 flex items-center justify-center font-bold text-[16px] shadow-sm border border-blue-200/50 flex-shrink-0">
                  {item.user.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">{item.user}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.typeColor}`}>
                      {item.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                    <Clock size={10} />
                    <span>{item.time}</span>
                  </div>
                </div>
              </div>
              <button className="text-slate-300 hover:text-slate-500">
                <MoreHorizontal size={18} />
              </button>
            </div>
            
            {/* Content */}
            <h4 className="font-bold text-slate-800 mb-1.5">{item.title}</h4>
            <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{item.desc}</p>
            
            {/* Tags / Price */}
            <div className="flex items-center gap-2 mb-4">
              {item.price && (
                <span className="text-lg font-bold text-rose-500 mr-2">{item.price}</span>
              )}
              {item.tags.map(tag => (
                <span key={tag} className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                  {tag}
                </span>
              ))}
            </div>
            
            {/* Footer actions */}
            <div className="flex items-center justify-between border-t border-slate-50 pt-3">
              <div className="flex items-center gap-4 text-slate-400">
                <button className="flex items-center gap-1.5 hover:text-rose-500 transition-colors">
                  <Heart size={16} />
                  <span className="text-xs font-medium">{item.likes}</span>
                </button>
                <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
                  <MessageSquare size={16} />
                  <span className="text-xs font-medium">{item.comments}</span>
                </button>
              </div>
              <button className="text-xs font-bold text-blue-500 bg-blue-50 px-4 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                联系Ta
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
