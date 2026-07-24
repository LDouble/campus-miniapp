import React, { useState } from 'react';
import { ChevronLeft, MoreHorizontal, Heart, MessageSquare, Share2, MapPin, Clock, ArrowRight, Package, Send } from 'lucide-react';

const mockComments = [
  { id: 1, user: '校园百事通', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100', content: '这个好棒！支持一下。', time: '10分钟前', likes: 5 },
  { id: 2, user: '数学课代表', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100', content: '确实，不过去晚了就没了，建议早点去排队。', time: '25分钟前', likes: 12 },
  { id: 3, user: '早起困难户', avatar: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&q=80&w=100', content: '马上去试试！', time: '1小时前', likes: 2 },
];

export function PostDetail({ post, onBack }: { post: any, onBack: () => void }) {
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState('');

  if (!post) return null;

  return (
    <div className="absolute inset-0 z-[250] h-full min-h-0 bg-[#f4f7fb] flex flex-col overflow-hidden animate-in slide-in-from-right-full duration-300">
      {/* Header */}
      <header className="shrink-0 px-4 pt-12 pb-3 flex items-center justify-between bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm z-20">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={24} />
        </button>
        
        {/* User Info in Header */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 flex items-center justify-center font-bold text-[12px] shadow-sm border border-blue-200/50 flex-shrink-0">
            {post.user ? post.user.charAt(0) : post.seller ? post.seller.charAt(0) : '?'}
          </div>
          <span className="text-[14px] font-bold text-slate-800">{post.user || post.seller || '匿名用户'}</span>
        </div>

        <button className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <MoreHorizontal size={20} />
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar flex flex-col">
        {/* Main Content Area */}
        <div className="bg-white px-5 pt-5 pb-6 mb-2 shadow-[0_4px_20px_rgba(0,0,0,0.02)] shrink-0">
          
          {/* Tags & Badges */}
          <div className="flex items-center gap-2 mb-3">
            {post.badge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${post.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                {post.badge}
              </span>
            )}
            {post.tags?.map((tag: string) => (
              <span key={tag} className="text-[11px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">
                #{tag}
              </span>
            ))}
          </div>

          {/* Title */}
          {post.title && <h1 className="text-[20px] font-extrabold text-slate-800 mb-3 leading-snug">{post.title}</h1>}
          
          {/* Price (Moved from bottom bar to content body) */}
          {post.price && (
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-[16px] font-bold text-rose-500">¥</span>
              <span className="text-[26px] font-extrabold text-rose-500 tracking-tight leading-none">{post.price.replace(/[^0-9.]/g, '')}</span>
              {post.topic === '跑腿' && <span className="text-[12px] text-slate-400 ml-1">赏金</span>}
              {post.originalPrice && <span className="text-[12px] text-slate-400 line-through ml-2">{post.originalPrice}</span>}
            </div>
          )}

          {/* Text Content */}
          <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
            {post.content}
          </p>

          {/* Images Stack */}
          {post.images && post.images.length > 0 && (
            <div className="flex flex-col gap-2 mb-5">
              {post.images.map((img: string, idx: number) => (
                <img key={idx} src={img} alt={`content-${idx}`} className="w-full rounded-2xl bg-slate-100 object-cover" />
              ))}
            </div>
          )}

          {/* Structured Task Info for Errand & Carpool */}
          {(post.topic === '跑腿' || post.topic === '拼车') && post.route && (
            <div className="bg-slate-50/80 rounded-2xl p-4 mb-5 border border-slate-100 flex flex-col gap-3">
              <div className="flex items-center gap-3 text-[14px] text-slate-700 font-bold">
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>{post.route.from}</span>
                <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]"></div>{post.route.to}</span>
              </div>
              <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-50">
                <div className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Clock size={16} className="text-blue-500" />
                  <span className="text-slate-500">{post.topic === '跑腿' ? '期望送达' : '出发时间'}</span>
                </div>
                <span className="text-[14px] text-blue-600 font-bold">{post.deadline}</span>
              </div>
            </div>
          )}

          {/* Structured Info for Lost & Found */}
          {post.topic === '失物招领' && post.lostAndFound && (
            <div className="bg-indigo-50/40 rounded-2xl p-4 mb-5 border border-indigo-100/50 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-[14px] text-slate-800 font-bold">
                  <Package size={18} className="text-indigo-500" />
                  <span>{post.lostAndFound.item}</span>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-1 rounded">
                  {post.lostAndFound.status}
                </span>
              </div>
              <div className="flex flex-col gap-2 text-[13px] text-slate-500">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-indigo-400" />
                  <span>地点：{post.lostAndFound.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-indigo-400" />
                  <span>时间：{post.lostAndFound.time}</span>
                </div>
              </div>
            </div>
          )}

          {/* Location & Time Footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-2">
            <div className="flex items-center gap-3">
              <span>{post.time}</span>
              {post.location && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={10} />
                  {post.location}
                </span>
              )}
            </div>
            <span>阅读 1.2w</span>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white px-4 pt-6 pb-8 rounded-t-[32px] shadow-[0_-4px_24px_rgba(0,0,0,0.02)] mt-2 shrink-0">
          <div className="flex items-center gap-2 mb-6 px-1">
            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
            <h3 className="text-[16px] font-bold text-slate-800">全部评论 <span className="text-slate-400 font-medium text-[13px] ml-1">{mockComments.length}</span></h3>
          </div>
          
          <div className="flex flex-col gap-5">
            {mockComments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                {/* Colorful Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100/50 to-blue-50 text-blue-600 flex items-center justify-center font-bold text-[14px] shadow-sm border border-blue-100 flex-shrink-0 mt-0.5">
                  {comment.user.charAt(0)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-bold text-slate-600">{comment.user}</span>
                    <button className="flex items-center gap-1 text-slate-400 hover:text-rose-500 transition-colors">
                      <Heart size={14} className={comment.likes > 10 ? 'fill-rose-500 text-rose-500' : ''} />
                      <span className={`text-[12px] font-medium ${comment.likes > 10 ? 'text-rose-500 font-bold' : ''}`}>{comment.likes}</span>
                    </button>
                  </div>
                  
                  {/* Chat Bubble Style Comment */}
                  <div className="bg-[#f4f7fb] border border-slate-50 px-4 py-2.5 rounded-2xl rounded-tl-sm mb-2 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8)]">
                    <p className="text-[14px] text-slate-700 leading-relaxed">{comment.content}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-[11px] text-slate-400 px-1">
                    <span>{comment.time}</span>
                    <button className="font-bold hover:text-blue-500 transition-colors">回复</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="shrink-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-30">
        <div className="flex items-center gap-2.5 max-w-md mx-auto">
          {/* Comment Input */}
          <div className="flex-1 flex items-center bg-[#f4f7fb] rounded-full px-4 py-2 border border-slate-100 transition-all">
            <input 
              type="text" 
              placeholder={['闲置', '跑腿', '拼车'].includes(post.topic) ? "留言问问细节..." : "说点什么..."} 
              className="bg-transparent w-full outline-none text-[14px] text-slate-700 placeholder:text-slate-400"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
          </div>

          {/* Actions based on typing state */}
          {commentText ? (
            <button className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-transform shrink-0">
              <Send size={16} className="-ml-0.5" />
            </button>
          ) : (
            <>
              <button 
                onClick={() => setIsLiked(!isLiked)} 
                className={`p-1.5 shrink-0 transition-colors ${isLiked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
              >
                <Heart size={22} className={isLiked ? 'fill-rose-500' : ''} />
              </button>

              {['闲置', '跑腿', '拼车'].includes(post.topic) ? (
                <button className={`px-5 py-2 rounded-full font-bold text-[13px] text-white shadow-lg active:scale-95 transition-transform shrink-0 ${
                  post.topic === '闲置' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-400 shadow-purple-500/30' :
                  post.topic === '跑腿' ? 'bg-gradient-to-r from-orange-500 to-amber-400 shadow-orange-500/30' :
                  'bg-gradient-to-r from-teal-500 to-emerald-400 shadow-teal-500/30'
                }`}>
                  {post.topic === '闲置' ? '我想要' : post.topic === '跑腿' ? '立即接单' : '加入拼车'}
                </button>
              ) : (
                <button className="p-1.5 text-slate-400 hover:text-blue-500 shrink-0 transition-colors">
                  <Share2 size={22} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
