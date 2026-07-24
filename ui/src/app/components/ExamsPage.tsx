import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, Calendar, MapPin, Clock, FileText, AlertCircle, Bookmark } from 'lucide-react';
import { BottomSheetPicker } from './BottomSheetPicker';

const exams = [
  {
    id: 1,
    course: '高等数学 (上)',
    type: '闭卷',
    date: '11月15日',
    day: '周五',
    time: '09:00 - 11:00',
    location: '第一教学楼 3A-201',
    seat: '12号',
    daysLeft: 3,
    status: 'upcoming'
  },
  {
    id: 2,
    course: '大学物理',
    type: '闭卷',
    date: '11月18日',
    day: '周一',
    time: '14:00 - 16:00',
    location: '实验楼 B座-405',
    seat: '45号',
    daysLeft: 6,
    status: 'upcoming'
  },
  {
    id: 3,
    course: '计算机导论',
    type: '上机',
    date: '11月20日',
    day: '周三',
    time: '10:00 - 12:00',
    location: '信息中心 机房2',
    seat: '05号',
    daysLeft: 8,
    status: 'upcoming'
  },
  {
    id: 4,
    course: '思想道德修养',
    type: '开卷',
    date: '10月25日',
    day: '周五',
    time: '14:00 - 16:00',
    location: '第二教学楼 101',
    seat: '随机',
    daysLeft: -20,
    status: 'finished'
  }
];

export function ExamsPage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'finished'>('upcoming');
  const [activeTerm, setActiveTerm] = useState('2025-2026 秋季学期');
  const [isTermPickerOpen, setIsTermPickerOpen] = useState(false);

  const termOptions = ['2025-2026 秋季学期', '2024-2025 春季学期', '2024-2025 秋季学期'];
  const filteredExams = exams.filter(e => e.status === activeTab);

  return (
    <div className="absolute inset-0 z-[150] bg-[#f4f7fb] flex flex-col animate-in slide-in-from-right-full duration-300">
      {/* Header */}
      <header className="px-4 pt-12 pb-3 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] sticky top-0 z-20">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[16px] font-bold text-slate-800 absolute left-1/2 -translate-x-1/2">考试安排</h2>
        <div className="w-8"></div> {/* Spacer */}
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar pb-10">
        
        {/* Term Selector */}
        <div className="px-4 mt-4 flex items-center justify-start">
          <button 
            onClick={() => setIsTermPickerOpen(true)}
            className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-50 text-[12px] font-bold text-slate-600 active:scale-95 transition-transform"
          >
            {activeTerm}
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        </div>

        {/* Top Banner (Countdown) */}
        <div className="px-4 mt-4 mb-6">
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-tr from-rose-500 to-orange-400 p-5 shadow-[0_8px_24px_rgba(244,63,94,0.25)] border border-white/40">
            {/* Glass decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-white/90 mb-1">
                  <AlertCircle size={14} />
                  <span className="text-[12px] font-medium">距离最近一场考试</span>
                </div>
                <h3 className="text-[16px] font-bold text-white leading-tight">高等数学 (上)</h3>
              </div>
              <div className="flex items-baseline gap-1 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/30 shadow-inner">
                <span className="text-[28px] font-extrabold text-white leading-none">3</span>
                <span className="text-[12px] text-white/90 font-medium">天</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 mb-4 flex gap-2">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 rounded-full text-[13px] font-bold transition-all shadow-sm ${activeTab === 'upcoming' ? 'bg-white text-blue-600 border border-white' : 'bg-slate-100 text-slate-500 border border-transparent'}`}
          >
            即将到来 ({exams.filter(e => e.status === 'upcoming').length})
          </button>
          <button 
            onClick={() => setActiveTab('finished')}
            className={`flex-1 py-2.5 rounded-full text-[13px] font-bold transition-all shadow-sm ${activeTab === 'finished' ? 'bg-white text-blue-600 border border-white' : 'bg-slate-100 text-slate-500 border border-transparent'}`}
          >
            已结束 ({exams.filter(e => e.status === 'finished').length})
          </button>
        </div>

        {/* Exams List */}
        <div className="flex flex-col gap-4 px-4 mt-2">
          {filteredExams.map(exam => (
            <div key={exam.id} className="bg-white rounded-[24px] p-4 shadow-[0_2px_16px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden group">
              
              {/* Left Color Indicator for urgency */}
              {exam.status === 'upcoming' && (
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${exam.daysLeft <= 3 ? 'bg-rose-400' : 'bg-blue-400'}`}></div>
              )}

              <div className="flex gap-4 items-start pl-1">
                {/* Date Block */}
                <div className={`w-14 h-16 rounded-[16px] flex flex-col items-center justify-center flex-shrink-0 ${exam.status === 'finished' ? 'bg-slate-50 text-slate-400' : exam.daysLeft <= 3 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-600'}`}>
                  <span className="text-[10px] font-medium mb-0.5">{exam.day}</span>
                  <span className="text-[20px] font-extrabold leading-none">{exam.date.split('月')[1].replace('日', '')}</span>
                  <span className="text-[9px] mt-0.5 opacity-80">{exam.date.split('月')[0]}月</span>
                </div>

                {/* Info Block */}
                <div className="flex-1 flex flex-col pt-0.5">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className={`text-[16px] font-bold ${exam.status === 'finished' ? 'text-slate-500' : 'text-slate-800'}`}>
                      {exam.course}
                    </h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${exam.status === 'finished' ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                      {exam.type}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium">
                      <Clock size={14} className={exam.status === 'finished' ? 'text-slate-300' : 'text-blue-400'} />
                      <span>{exam.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium">
                      <MapPin size={14} className={exam.status === 'finished' ? 'text-slate-300' : 'text-emerald-400'} />
                      <span>{exam.location}</span>
                    </div>
                    
                    <div className="w-full h-px bg-slate-50 my-1"></div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium">
                        <Bookmark size={14} className={exam.status === 'finished' ? 'text-slate-300' : 'text-purple-400'} />
                        <span>座位: <span className="font-bold text-slate-700">{exam.seat}</span></span>
                      </div>
                      
                      {exam.status === 'upcoming' && (
                        <span className={`text-[11px] font-bold ${exam.daysLeft <= 3 ? 'text-rose-500' : 'text-blue-500'}`}>
                          还有 {exam.daysLeft} 天
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomSheetPicker 
        isOpen={isTermPickerOpen}
        onClose={() => setIsTermPickerOpen(false)}
        title="选择学期"
        options={termOptions}
        activeOption={activeTerm}
        onSelect={(term) => {
          setActiveTerm(term);
          setIsTermPickerOpen(false);
        }}
      />
    </div>
  );
}
