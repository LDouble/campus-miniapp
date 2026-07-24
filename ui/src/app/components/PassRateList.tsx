import React, { useState } from 'react';
import { ChevronLeft, Search, BookOpen, ChevronRight, TrendingUp, Filter } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const mockCourses = [
  { id: 1, name: '高等数学 (上)', type: '必修课', credit: 4.0, dept: '理学院', passRate: 88, gpa: 2.8, trend: 'up' },
  { id: 2, name: '大学物理', type: '必修课', credit: 3.5, dept: '物理系', passRate: 75, gpa: 2.4, trend: 'down' },
  { id: 3, name: '计算机导论', type: '必修课', credit: 2.0, dept: '计算机系', passRate: 92, gpa: 3.5, trend: 'up' },
  { id: 4, name: '经济学原理', type: '选修课', credit: 2.0, dept: '经管学院', passRate: 95, gpa: 3.8, trend: 'up' },
  { id: 5, name: '思想道德修养', type: '必修课', credit: 3.0, dept: '马克思主义学院', passRate: 98, gpa: 3.9, trend: 'flat' },
  { id: 6, name: 'C语言程序设计', type: '必修课', credit: 3.0, dept: '计算机系', passRate: 82, gpa: 2.9, trend: 'up' },
];

export function PassRateList({ 
  onBack, 
  onSelectCourse 
}: { 
  onBack: () => void, 
  onSelectCourse: (courseId: number) => void 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('全部');

  const filteredCourses = mockCourses.filter(course => {
    const matchesSearch = course.name.includes(searchTerm) || course.dept.includes(searchTerm);
    const matchesFilter = activeFilter === '全部' || course.type.includes(activeFilter);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="absolute inset-0 z-[140] bg-[#f4f7fb] flex flex-col animate-in slide-in-from-right-full duration-300">
      {/* 顶部导航栏 (避开微信胶囊) */}
      <header className="px-4 pt-12 pb-3 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] sticky top-0 z-20">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[16px] font-bold text-slate-800 absolute left-1/2 -translate-x-1/2">课程通过率</h2>
        <div className="w-8"></div>
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar pb-10">
        {/* 搜索与过滤 */}
        <div className="px-4 py-4 sticky top-0 bg-[#f4f7fb]/90 backdrop-blur-md z-10 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索课程名称或开课院系..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-100 pl-10 pr-4 py-2.5 rounded-2xl text-[13px] text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>
          
          <div className="flex gap-2">
            {['全部', '必修', '选修'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[12px] font-bold transition-all shadow-sm flex items-center gap-1",
                  activeFilter === filter 
                    ? "bg-cyan-500 text-white shadow-[0_2px_8px_rgba(6,182,212,0.3)]" 
                    : "bg-white text-slate-500 border border-slate-100"
                )}
              >
                {filter === '全部' && <Filter className="w-3 h-3" />}
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* 课程列表 */}
        <div className="px-4 flex flex-col gap-3">
          {filteredCourses.map(course => (
            <button 
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              className="bg-white p-4 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-50 text-left active:scale-[0.98] transition-all group flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800 mb-1 group-hover:text-cyan-600 transition-colors">
                    {course.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                      {course.type}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <BookOpen className="w-3 h-3" /> {course.credit} 学分
                    </span>
                    <span>·</span>
                    <span>{course.dept}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-500 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              <div className="h-px w-full bg-slate-50" />

              <div className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">综合通过率</p>
                    <p className={cn(
                      "text-[18px] font-extrabold flex items-baseline gap-0.5",
                      course.passRate >= 90 ? "text-emerald-500" : course.passRate >= 80 ? "text-blue-500" : "text-rose-500"
                    )}>
                      {course.passRate}<span className="text-[12px] font-medium">%</span>
                    </p>
                  </div>
                  <div className="w-px h-6 bg-slate-100" />
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">平均 GPA</p>
                    <p className="text-[15px] font-bold text-slate-700">
                      {course.gpa.toFixed(1)}
                    </p>
                  </div>
                </div>
                
                {course.trend === 'up' && (
                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">
                    <TrendingUp className="w-3 h-3" />
                    上升
                  </div>
                )}
              </div>
            </button>
          ))}
          
          {filteredCourses.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              没有找到匹配的课程~
            </div>
          )}
        </div>
      </main>
    </div>
  );
}