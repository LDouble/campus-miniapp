import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, CalendarDays, MapPin, Clock, User, LayoutGrid, List, X, Layers, FileText } from 'lucide-react';
import { BottomSheetPicker } from './BottomSheetPicker';

const courses = [
  { id: 1, name: '高等数学(上)', teacher: '张建国', location: '第一教学楼 1A-201', day: 1, start: 1, end: 2, weeks: '1-16周', note: '', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 9, name: '大学英语(重修)', teacher: '王丽', location: '外语楼 102', day: 1, start: 1, end: 2, weeks: '1-8周', note: '需提前10分钟到考勤', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { id: 2, name: '大学物理', teacher: '李明', location: '实验楼 B-104', day: 2, start: 3, end: 4, weeks: '1-16周', note: '带实验报告册', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 3, name: '高等数学(上)', teacher: '张建国', location: '第一教学楼 1A-201', day: 3, start: 3, end: 4, weeks: '1-16周', note: '', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 4, name: '计算机导论', teacher: '王秀英', location: '信息中心 机房3', day: 1, start: 5, end: 6, weeks: '4-12周', note: '上机实践课', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 5, name: '思想道德与法治', teacher: '赵强', location: '第二教学楼 3C-101', day: 4, start: 7, end: 8, weeks: '1-16周', note: '', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { id: 6, name: '大学体育', teacher: '孙伟', location: '东区操场', day: 5, start: 5, end: 6, weeks: '1-16周', note: '穿运动鞋', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 7, name: '设计心理学', teacher: '周雪', location: '艺术楼 402', day: 2, start: 7, end: 8, weeks: '1-8周', note: '第8周随堂结课测试', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 8, name: '英语口语', teacher: 'David', location: '外语楼 205', day: 5, start: 1, end: 2, weeks: '1-16周', note: '', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
];

const timeNodes = [
  { node: 1, time: '08:00' }, { node: 2, time: '08:50' },
  { node: 3, time: '09:50' }, { node: 4, time: '10:40' },
  { node: 5, time: '14:00' }, { node: 6, time: '14:50' },
  { node: 7, time: '15:50' }, { node: 8, time: '16:40' },
  { node: 9, time: '19:00' }, { node: 10, time: '19:50' },
  { node: 11, time: '20:40' }, { node: 12, time: '21:30' }
];

const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
const dates = ['18', '19', '20', '21', '22', '23', '24']; // 模拟本周日期

export function SchedulePage({ onBack }: { onBack: () => void }) {
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState(1); // 1 = Monday
  const [activeTerm, setActiveTerm] = useState('2025-2026 秋季学期');
  const [isTermPickerOpen, setIsTermPickerOpen] = useState(false);
  
  const [activeWeek, setActiveWeek] = useState('第 8 周');
  const [isWeekPickerOpen, setIsWeekPickerOpen] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<any[] | null>(null);

  const termOptions = ['2025-2026 秋季学期', '2024-2025 春季学期', '2024-2025 秋季学期'];
  const weekOptions = Array.from({ length: 20 }, (_, i) => `第 ${i + 1} 周`);

  // 获取选中日期的课程，并按开始时间排序
  const dayCourses = courses
    .filter(c => c.day === selectedDay)
    .sort((a, b) => a.start - b.start);

  return (
    <div className="absolute inset-0 z-[150] bg-[#f4f7fb] flex flex-col animate-in slide-in-from-right-full duration-300">
      {/* Header */}
      {/* Header + Toolbar (Combined to save vertical space) */}
      <header className="px-3 pt-12 pb-2 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sticky top-0 z-30">
        <div className="flex items-center gap-1.5">
          <button onClick={onBack} className="p-1 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
            <ChevronLeft size={24} />
          </button>
          
          {/* Term & Week Selectors Grouped in Header */}
          <div className="flex items-center gap-1 bg-slate-100/60 p-0.5 rounded-full border border-slate-200/50">
            <button 
              onClick={() => setIsTermPickerOpen(true)}
              className="flex items-center gap-0.5 bg-white px-2 py-1 rounded-full text-[11px] font-bold text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition-transform"
            >
              {activeTerm.split(' ')[0]}
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            <button 
              onClick={() => setIsWeekPickerOpen(true)}
              className="flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-bold text-slate-600 hover:bg-white/50 active:scale-95 transition-transform"
            >
              {activeWeek.replace('第 ', '').replace(' 周', '周')}
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Floating View Toggle (Moved into header right side) */}
        <div className="flex bg-slate-100/80 p-0.5 rounded-full border border-slate-200/50 shadow-inner mr-[50px]">
          <button 
            onClick={() => setViewMode('week')}
            className={`p-1 rounded-full transition-all ${viewMode === 'week' ? 'bg-white text-blue-500 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button 
            onClick={() => setViewMode('day')}
            className={`p-1 rounded-full transition-all ${viewMode === 'day' ? 'bg-white text-blue-500 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <List size={14} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar flex flex-col relative">
        {viewMode === 'week' ? (
          /* ================= WEEK VIEW ================= */
          <div className="flex flex-col min-h-max pb-10">
            {/* Week Header */}
            <div className="sticky top-0 z-10 flex bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm py-2 px-1">
              <div className="w-8 flex flex-col items-center justify-center text-[10px] text-slate-400 font-medium">
                <span>11月</span>
              </div>
              <div className="flex-1 grid grid-cols-7 gap-1">
                {weekDays.map((day, i) => (
                  <div key={i} className="flex flex-col items-center justify-center">
                    <span className="text-[11px] font-bold text-slate-500">周{day}</span>
                    <span className={`text-[12px] font-extrabold mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${i === 0 ? 'bg-blue-500 text-white shadow-md' : 'text-slate-700'}`}>
                      {dates[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid Body */}
            <div className="flex flex-1 px-1 pt-1 relative">
              {/* Timeline sidebar */}
              <div className="w-8 flex flex-col justify-between pt-2 pb-2">
                {timeNodes.map(node => (
                  <div key={node.node} className="flex flex-col items-center h-[55px]">
                    <span className="text-[11px] font-bold text-slate-700">{node.node}</span>
                    <span className="text-[9px] text-slate-400 font-medium scale-90">{node.time}</span>
                  </div>
                ))}
              </div>

              {/* Courses Grid */}
              <div 
                className="flex-1 relative border-l border-slate-100 ml-1"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gridTemplateRows: 'repeat(12, 55px)',
                  gap: '2px'
                }}
              >
                {/* Horizontal grid lines */}
                <div className="col-span-7 row-span-12 absolute inset-0 pointer-events-none flex flex-col">
                  {Array.from({length: 12}).map((_, i) => (
                    <div key={i} className="h-[55px] border-b border-slate-100/60 border-dashed w-full"></div>
                  ))}
                </div>

                {/* Vertical grid lines */}
                <div className="col-span-7 row-span-12 absolute inset-0 pointer-events-none grid grid-cols-7">
                  {Array.from({length: 7}).map((_, i) => (
                    <div key={i} className="border-r border-slate-100/60 border-dashed h-full"></div>
                  ))}
                </div>

                {/* Course Blocks */}
                {courses.map(course => {
                  // 判断是否有时间冲突
                  const overlaps = courses.filter(c => c.day === course.day && Math.max(course.start, c.start) <= Math.min(course.end, c.end));
                  const index = overlaps.findIndex(c => c.id === course.id);
                  const isConflict = overlaps.length > 1;

                  return (
                    <div 
                      key={course.id}
                      onClick={() => setSelectedCourses(overlaps)}
                      className={`relative rounded-md p-1.5 shadow-sm border overflow-hidden flex flex-col cursor-pointer active:scale-[0.98] transition-transform ${course.color}`}
                      style={{
                        gridColumn: course.day,
                        gridRow: `${course.start} / span ${course.end - course.start + 1}`
                      }}
                    >
                      {/* 冲突层叠角标指示 */}
                      {isConflict && index === overlaps.length - 1 && (
                        <div className="absolute top-0 right-0 bg-rose-500/90 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-md z-20">
                          {overlaps.length}
                        </div>
                      )}
                      
                      <span className="text-[11px] font-bold leading-tight mb-1">{course.name}</span>
                      <div className="mt-auto flex flex-col gap-0.5 opacity-90">
                        <span className="text-[9px] flex items-center gap-0.5 leading-none"><MapPin size={9} />{course.location.split(' ')[1] || course.location}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ================= DAY VIEW ================= */
          <div className="flex flex-col min-h-max pb-10">
            {/* Horizontal Day Selector */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm py-3 px-4">
              <div className="flex justify-between items-center gap-2">
                {weekDays.map((day, i) => {
                  const isSelected = selectedDay === i + 1;
                  return (
                    <button 
                      key={i}
                      onClick={() => setSelectedDay(i + 1)}
                      className={`flex flex-col items-center justify-center w-11 h-14 rounded-2xl transition-all ${isSelected ? 'bg-gradient-to-b from-blue-500 to-cyan-400 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      <span className={`text-[10px] font-medium mb-1 ${isSelected ? 'text-blue-50' : ''}`}>周{day}</span>
                      <span className={`text-[15px] font-bold leading-none ${isSelected ? 'text-white' : 'text-slate-700'}`}>{dates[i]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timeline */}
            <div className="px-5 pt-6 pb-12 flex flex-col gap-6">
              {dayCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                  <CalendarDays size={48} className="text-slate-300 mb-3" />
                  <p className="text-[14px] font-medium text-slate-500">今天没有课，好好休息吧~</p>
                </div>
              ) : (
                dayCourses.map((course, index) => {
                  const startTime = timeNodes.find(n => n.node === course.start)?.time;
                  const endTime = timeNodes.find(n => n.node === course.end)?.time;
                  // Map color class from bg-xxx-100 text-xxx-700 to specific hexes or use as is
                  const themeColor = course.color.split(' ')[0].replace('100', '500'); // hacky way to extract primary color

                  return (
                    <div key={course.id} className="relative flex gap-4">
                      {/* Timeline line & dot */}
                      <div className="flex flex-col items-center mt-1">
                        <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${themeColor}`}></div>
                        {index !== dayCourses.length - 1 && (
                          <div className="w-0.5 h-full bg-slate-200 my-1"></div>
                        )}
                      </div>

                      {/* Course Card */}
                      <div 
                        onClick={() => {
                          const overlaps = dayCourses.filter(c => Math.max(course.start, c.start) <= Math.min(course.end, c.end));
                          setSelectedCourses(overlaps);
                        }}
                        className="flex-1 bg-white rounded-[24px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform"
                      >
                        {/* Decorative background blob */}
                        <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-20 ${themeColor}`}></div>
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px] font-extrabold text-slate-800 tracking-tight">{startTime} - {endTime}</span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                            第 {course.start}-{course.end} 节
                          </span>
                        </div>

                        <h3 className="text-[18px] font-bold text-slate-800 mb-3">{course.name}</h3>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                            <MapPin size={15} className={`text-emerald-500`} />
                            <span>{course.location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                            <User size={15} className={`text-blue-500`} />
                            <span>{course.teacher}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
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

      {/* Week Picker */}
      <BottomSheetPicker 
        isOpen={isWeekPickerOpen}
        onClose={() => setIsWeekPickerOpen(false)}
        title="选择周次"
        options={weekOptions}
        activeOption={activeWeek}
        onSelect={(week) => {
          setActiveWeek(week);
          setIsWeekPickerOpen(false);
        }}
      />

      {/* Course Detail Modal */}
      {selectedCourses && selectedCourses.length > 0 && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-auto px-6">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={() => setSelectedCourses(null)} />
          <div className="relative w-full max-w-sm max-h-[80vh] overflow-y-auto hide-scrollbar rounded-[32px] p-6 shadow-2xl border border-white/50 animate-in zoom-in-95 duration-200 bg-white">
            
            <button onClick={() => setSelectedCourses(null)} className="absolute top-4 right-4 p-1.5 bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors z-10">
              <X size={16} />
            </button>

            <div className="flex flex-col gap-4">
              {selectedCourses.map((course, idx) => (
                <div key={course.id} className={`flex flex-col relative ${idx > 0 ? 'pt-4 border-t border-slate-100' : ''}`}>
                   
                   {/* Course Title */}
                   <h3 className="text-[18px] font-extrabold text-slate-800 mb-3 leading-tight pr-8">
                     {course.name}
                   </h3>
                   
                   {/* Compressed Course Details Grid */}
                   <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                      <div className="flex items-start gap-2">
                         <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${course.color.split(' ')[0]} ${course.color.split(' ')[1]}`}>
                           <MapPin size={12}/>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-[12px] font-bold text-slate-700 leading-snug break-all">{course.location}</span>
                           <span className="text-[10px] text-slate-400 font-medium">地点</span>
                         </div>
                      </div>
                      <div className="flex items-start gap-2">
                         <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${course.color.split(' ')[0]} ${course.color.split(' ')[1]}`}>
                           <Clock size={12}/>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-[12px] font-bold text-slate-700 leading-snug break-all">周{weekDays[course.day-1]} 第{course.start}-{course.end}节</span>
                           <span className="text-[10px] text-slate-400 font-medium">时间</span>
                         </div>
                      </div>
                      <div className="flex items-start gap-2">
                         <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${course.color.split(' ')[0]} ${course.color.split(' ')[1]}`}>
                           <User size={12}/>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-[12px] font-bold text-slate-700 leading-snug break-all">{course.teacher}</span>
                           <span className="text-[10px] text-slate-400 font-medium">教师</span>
                         </div>
                      </div>
                      <div className="flex items-start gap-2">
                         <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${course.color.split(' ')[0]} ${course.color.split(' ')[1]}`}>
                           <CalendarDays size={12}/>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-[12px] font-bold text-slate-700 leading-snug break-all">{course.weeks}</span>
                           <span className="text-[10px] text-slate-400 font-medium">周次</span>
                         </div>
                      </div>
                   </div>

                   {/* Note Section (If exists) */}
                   {course.note && (
                     <div className="mt-3 bg-slate-50/80 border border-slate-100/60 p-2.5 rounded-xl flex items-start gap-2">
                       <FileText size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                       <span className="text-[12px] text-slate-600 font-medium leading-snug">{course.note}</span>
                     </div>
                   )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
