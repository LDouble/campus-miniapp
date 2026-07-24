import React, { useState } from 'react';
import { X, ImagePlus, MapPin, DollarSign, Clock, ArrowRight, CircleDot, ChevronRight, Package, Info, Phone } from 'lucide-react';

export function PublishForm({ mode, onClose }: { mode: string | null, onClose: () => void }) {
  if (!mode) return null;

  const getTitle = () => {
    switch (mode) {
      case '发动态': return '发布动态';
      case '卖闲置': return '发布闲置';
      case '发跑腿': return '发布跑腿';
      case '找拼车': return '发布拼车';
      case '失物招领': return '发布失物招领';
      default: return '发布';
    }
  };

  // Image Uploader Component (Mock)
  const ImageUploader = () => (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4">
      <button className="w-24 h-24 flex-shrink-0 bg-[#f0f4f8] rounded-2xl flex flex-col items-center justify-center text-slate-400 border border-slate-200/60 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.03),inset_-2px_-2px_6px_rgba(255,255,255,1)] hover:bg-[#e8edf3] transition-colors">
        <ImagePlus size={24} className="mb-1" />
        <span className="text-[10px] font-medium">添加图片</span>
      </button>
    </div>
  );

  // Reusable Contact Input Component
  const ContactInput = () => (
    <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[14px] font-bold text-slate-700">
          <Phone size={16} className="text-emerald-500" /> 联系方式
        </div>
        <select className="bg-slate-50 text-[12px] font-medium text-slate-600 px-2 py-1 rounded-lg outline-none cursor-pointer">
          <option>微信号</option>
          <option>手机号</option>
          <option>QQ号</option>
        </select>
      </div>
      <input type="text" placeholder="请输入你的联系账号..." className="w-full text-[14px] text-slate-700 placeholder:text-slate-400 outline-none bg-[#f4f7fb] px-3 py-2.5 rounded-xl" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex justify-center bg-[#f4f7fb] sm:bg-slate-900/40 sm:backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-[#f4f7fb] flex flex-col animate-in slide-in-from-bottom-[100%] duration-300 shadow-2xl relative overflow-hidden sm:rounded-t-[40px] sm:mt-12">
        {/* Header */}
        <header className="px-4 pt-12 sm:pt-6 pb-3 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sticky top-0 z-10">
          <button onClick={onClose} className="text-[15px] font-medium text-slate-500 hover:text-slate-700 px-2 py-1">
            取消
          </button>
          <h2 className="text-[16px] font-bold text-slate-800">{getTitle()}</h2>
          <div className="w-[42px]"></div> {/* 占位以保证标题绝对居中，避开小程序胶囊 */}
        </header>

        {/* Form Content */}
        <main className="flex-1 overflow-y-auto px-4 py-5 hide-scrollbar pb-6">
        
        {/* 1. 卖闲置 Form */}
        {mode === '卖闲置' && (
          <div className="flex flex-col gap-4">
            <ImageUploader />
            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white">
              <input type="text" placeholder="宝贝标题 品牌品类都是买家喜欢搜索的" className="w-full text-[15px] font-bold text-slate-800 placeholder:text-slate-400 outline-none border-b border-slate-50 pb-3 mb-3" />
              <textarea placeholder="描述一下宝贝的细节或转手原因..." className="w-full h-24 text-[14px] text-slate-600 placeholder:text-slate-400 outline-none resize-none"></textarea>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-slate-700">价格设置</span>
                <div className="flex items-center gap-2">
                  <span className="text-rose-500 font-bold text-[18px]">¥</span>
                  <input type="number" placeholder="0.00" className="w-16 text-right text-[18px] font-bold text-rose-500 placeholder:text-slate-300 outline-none" />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                <span className="text-[14px] font-bold text-slate-700">入手原价</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[14px]">¥</span>
                  <input type="number" placeholder="0.00" className="w-16 text-right text-[14px] text-slate-600 placeholder:text-slate-300 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white">
              <span className="text-[14px] font-bold text-slate-700 mb-3 block">宝贝成色</span>
              <div className="flex flex-wrap gap-2">
                {['全新/仅拆封', '九成新', '有使用痕迹', '需维修'].map(c => (
                  <button key={c} className="px-4 py-1.5 rounded-full text-[12px] font-medium bg-slate-50 text-slate-600 border border-slate-100 focus:bg-blue-50 focus:text-blue-600 focus:border-blue-200 transition-colors">
                    {c}
                  </button>
                ))}
              </div>
            </div>
            
            <ContactInput />
          </div>
        )}

        {/* 2. 发跑腿 Form */}
        {mode === '发跑腿' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white">
              <input type="text" placeholder="一句话概括需要帮什么忙（如：代取快递）" className="w-full text-[15px] font-bold text-slate-800 placeholder:text-slate-400 outline-none border-b border-slate-50 pb-3 mb-3" />
              <textarea placeholder="详细说明物品大小、重量或特殊要求..." className="w-full h-20 text-[14px] text-slate-600 placeholder:text-slate-400 outline-none resize-none"></textarea>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white relative">
              <div className="absolute left-[27px] top-[36px] bottom-[36px] w-[2px] bg-slate-100"></div>
              
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
                <input type="text" placeholder="从哪里取？（起点）" className="flex-1 w-full text-[14px] bg-[#f4f7fb] px-3 py-2.5 rounded-xl outline-none text-slate-700 placeholder:text-slate-400" />
              </div>

              <div className="flex items-center gap-3 relative z-10">
                <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                </div>
                <input type="text" placeholder="送到哪里？（终点）" className="flex-1 w-full text-[14px] bg-[#f4f7fb] px-3 py-2.5 rounded-xl outline-none text-slate-700 placeholder:text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                  <DollarSign size={14} className="text-orange-500" /> 悬赏金额
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[16px] font-bold text-slate-800">¥</span>
                  <input type="number" placeholder="10" className="w-full text-[20px] font-bold text-orange-500 outline-none placeholder:text-slate-300" />
                </div>
              </div>
              <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                  <Clock size={14} className="text-blue-500" /> 期望时间
                </div>
                <input type="datetime-local" className="w-full text-[14px] font-bold text-slate-700 outline-none bg-transparent mt-1" />
              </div>
            </div>

            <ContactInput />
          </div>
        )}

        {/* 3. 找拼车 Form */}
        {mode === '找拼车' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white relative">
              <div className="absolute left-[27px] top-[36px] bottom-[36px] w-[2px] bg-slate-100"></div>
              
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                  <CircleDot size={12} className="text-slate-500" />
                </div>
                <input type="text" placeholder="出发地 (如: 南大门)" className="flex-1 w-full text-[14px] bg-[#f4f7fb] px-3 py-2.5 rounded-xl outline-none text-slate-700 placeholder:text-slate-400" />
              </div>

              <div className="flex items-center gap-3 relative z-10">
                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                  <MapPin size={12} className="text-teal-500" />
                </div>
                <input type="text" placeholder="目的地 (如: 高铁南站)" className="flex-1 w-full text-[14px] bg-[#f4f7fb] px-3 py-2.5 rounded-xl outline-none text-slate-700 placeholder:text-slate-400" />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[14px] font-bold text-slate-700">
                  <Clock size={16} className="text-blue-500" /> 出发时间
                </div>
                <input type="datetime-local" className="text-right text-[14px] font-medium text-slate-600 outline-none bg-transparent" />
              </div>
              <div className="h-px w-full bg-slate-50"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[14px] font-bold text-slate-700">
                  <Info size={16} className="text-purple-500" /> 拼车情况
                </div>
                <select className="bg-transparent text-right text-[14px] text-slate-600 outline-none appearance-none">
                  <option>我找车 (需1座)</option>
                  <option>我找车 (需2座)</option>
                  <option>车找人 (余1座)</option>
                  <option>车找人 (余2座)</option>
                  <option>车找人 (余3座)</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white">
              <textarea placeholder="补充说明（如：是否带大件行李、平摊费用方式等）..." className="w-full h-20 text-[14px] text-slate-600 placeholder:text-slate-400 outline-none resize-none"></textarea>
            </div>

            <ContactInput />
          </div>
        )}

        {/* 4. 失物招领 Form */}
        {mode === '失物招领' && (
          <div className="flex flex-col gap-4">
            <div className="flex bg-slate-100/50 p-1 rounded-full mb-2">
              <button className="flex-1 py-2 rounded-full text-[13px] font-bold bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">我捡到了物品</button>
              <button className="flex-1 py-2 rounded-full text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors">我丢失了物品</button>
            </div>

            <ImageUploader />

            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                <Package size={18} className="text-indigo-500" />
                <input type="text" placeholder="物品名称（如：蓝色水杯、校园卡）" className="flex-1 text-[15px] font-bold text-slate-800 placeholder:text-slate-400 outline-none" />
              </div>
              <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                <MapPin size={18} className="text-slate-400" />
                <input type="text" placeholder="捡到的地点（越详细越好）" className="flex-1 text-[14px] text-slate-700 placeholder:text-slate-400 outline-none" />
              </div>
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-slate-400" />
                <input type="datetime-local" className="flex-1 text-[14px] text-slate-700 outline-none bg-transparent" />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white">
              <span className="text-[14px] font-bold text-slate-700 mb-2 block">物品目前在哪里？</span>
              <input type="text" placeholder="如：已交到图书馆一楼保安处，或放在原处" className="w-full text-[14px] bg-[#f4f7fb] px-4 py-3 rounded-xl outline-none text-slate-700 placeholder:text-slate-400" />
            </div>
            
            <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white">
              <textarea placeholder="补充其他特征细节..." className="w-full h-16 text-[14px] text-slate-600 placeholder:text-slate-400 outline-none resize-none"></textarea>
            </div>
          </div>
        )}

        {/* 5. 发动态 Form (Fallback/Default) */}
        {(mode === '发动态') && (
          <div className="flex flex-col gap-4 h-full">
            <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col">
              <textarea placeholder="分享你的校园新鲜事..." className="w-full min-h-[140px] text-[15px] text-slate-700 placeholder:text-slate-400 outline-none resize-none leading-relaxed"></textarea>
              <div className="-mb-4 mt-2">
                <ImageUploader />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-white flex flex-col gap-1">
              <button className="flex items-center justify-between px-3 py-3 hover:bg-slate-50 rounded-2xl transition-colors">
                <div className="flex items-center gap-2 text-[14px] text-slate-700 font-medium">
                  <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center"><MapPin size={12} className="text-blue-500" /></div>
                  所在位置
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
              <button className="flex items-center justify-between px-3 py-3 hover:bg-slate-50 rounded-2xl transition-colors">
                <div className="flex items-center gap-2 text-[14px] text-slate-700 font-medium">
                  <div className="w-6 h-6 rounded-full bg-purple-50 flex items-center justify-center"><span className="text-purple-500 text-[12px] font-bold">#</span></div>
                  参与话题
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            </div>
          </div>
        )}

        </main>

        {/* Bottom Sticky Action Bar */}
        <div className="p-4 bg-white/95 backdrop-blur-xl border-t border-slate-100/60 pb-10 sm:pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-10 shrink-0">
          <button className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-full font-bold text-[16px] shadow-[0_6px_20px_rgba(59,130,246,0.3)] active:scale-95 transition-transform flex items-center justify-center gap-2">
            确认发布
          </button>
        </div>
      </div>
    </div>
  );
}
