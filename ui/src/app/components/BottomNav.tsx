import React from 'react';
import { Home, MessageCircle, Plus, Users, User } from 'lucide-react';

export function BottomNav({ activeTab, onChange, onPublish }: { activeTab: string, onChange: (tab: string) => void, onPublish: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 pointer-events-none">
      {/* Mobile container constraint */}
      <div className="w-full max-w-md px-6 pointer-events-auto">
        <div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-3xl flex justify-between items-center px-6 py-3 relative">
          
          <button 
            onClick={() => onChange('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-blue-500' : 'text-slate-400 hover:text-blue-400'}`}
          >
            <Home size={20} className={activeTab === 'home' ? 'fill-blue-500/20' : ''} />
            <span className="text-[10px] font-medium">首页</span>
          </button>
          
          <button 
            onClick={() => onChange('community')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'community' ? 'text-blue-500' : 'text-slate-400 hover:text-blue-400'}`}
          >
            <Users size={20} className={activeTab === 'community' ? 'fill-blue-500/20' : ''} />
            <span className="text-[10px] font-medium">社区</span>
          </button>
          
          {/* Center Action Button (Neumorphic Pop) */}
          <div className="relative -top-5">
            <button 
              onClick={onPublish}
              className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(59,130,246,0.4)] hover:scale-105 transition-transform active:scale-95 border-4 border-[#f0f4f8]"
            >
              <Plus size={24} />
            </button>
          </div>
          
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors relative">
            <MessageCircle size={20} />
            <span className="text-[10px] font-medium">消息</span>
            <span className="absolute top-0 right-1 w-2 h-2 bg-red-400 rounded-full border border-white"></span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors">
            <User size={20} />
            <span className="text-[10px] font-medium">我的</span>
          </button>

        </div>
      </div>
    </div>
  );
}
