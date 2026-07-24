import React, { useState } from 'react';
import { Bell, CloudSun } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { FeatureGrid } from './components/FeatureGrid';
import { GlassBanner } from './components/GlassBanner';
import { CommunityFeed } from './components/CommunityFeed';
import { CommunityPage } from './components/CommunityPage';
import { PublishActionSheet } from './components/PublishActionSheet';
import { PublishForm } from './components/PublishForm';
import { GradesPage } from './components/GradesPage';
import { ExamsPage } from './components/ExamsPage';
import { SchedulePage } from './components/SchedulePage';
import { PassRatePage } from './components/PassRatePage';
import { PassRateList } from './components/PassRateList';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [communityTopic, setCommunityTopic] = useState('全部');
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'grades' | 'exams' | 'schedule' | 'passRateList' | 'passRateDetail'>('main');
  const [isDetailOpen, setIsDetailOpen] = useState(false); // Track if a detail page is open

  return (
    <div className="min-h-[100dvh] bg-[#f5f7fa] font-sans selection:bg-blue-200">
      {/* Mobile container - restricts width on desktop */}
      <div className="h-[100dvh] max-w-md mx-auto bg-[#f4f7fb] relative shadow-2xl sm:h-[calc(100dvh-4rem)] sm:rounded-[40px] sm:my-8 sm:border-8 border-white overflow-hidden flex flex-col">
        
        {/* Soft Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none"></div>

        {activeTab === 'home' ? (
          <>
            {/* Header */}
            <header className="px-6 pt-12 pb-4 flex items-center justify-between relative z-10">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500 mb-1">早上好，同学</span>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">清华大学</h1>
                  <div className="flex items-center gap-1 bg-white/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/80 shadow-sm">
                    <CloudSun size={14} className="text-orange-400" />
                    <span className="text-xs font-bold text-slate-600">24°</span>
                  </div>
                </div>
              </div>
              <button className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-[2px_2px_8px_rgba(0,0,0,0.04)] border border-white/60 hover:scale-105 transition-transform active:scale-95">
                <Bell size={20} className="text-slate-600" />
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 flex-1 min-h-0 overflow-y-auto hide-scrollbar">
              <GlassBanner />
              <FeatureGrid onFeatureClick={(name) => {
                if (name === '我的课表') setCurrentView('schedule');
                if (name === '查成绩') setCurrentView('grades');
                if (name === '通过率') setCurrentView('passRateList');
                if (name === '考试安排') setCurrentView('exams');
                if (name === '二手市场') { setCommunityTopic('闲置'); setActiveTab('community'); }
                if (name === '校园跑腿') { setCommunityTopic('跑腿'); setActiveTab('community'); }
                if (name === '失物招领') { setCommunityTopic('失物招领'); setActiveTab('community'); }
              }} />
              <CommunityFeed />
            </main>
          </>
        ) : (
          <main className="relative z-10 flex-1 min-h-0 overflow-hidden flex flex-col">
            <CommunityPage initialTopic={communityTopic} onDetailOpenChange={setIsDetailOpen} />
          </main>
        )}

        {/* Modals & Overlays */}
        {currentView === 'schedule' && (
          <SchedulePage onBack={() => setCurrentView('main')} />
        )}
        {currentView === 'grades' && (
          <GradesPage onBack={() => setCurrentView('main')} />
        )}
        {currentView === 'exams' && (
          <ExamsPage onBack={() => setCurrentView('main')} />
        )}
        {currentView === 'passRateList' && (
          <PassRateList 
            onBack={() => setCurrentView('main')} 
            onSelectCourse={() => setCurrentView('passRateDetail')} 
          />
        )}
        {currentView === 'passRateDetail' && (
          <PassRatePage onBack={() => setCurrentView('passRateList')} />
        )}
        <PublishActionSheet 
          isOpen={isPublishOpen} 
          onClose={() => setIsPublishOpen(false)} 
          onSelect={(type) => {
            setPublishMode(type);
            setIsPublishOpen(false);
          }}
        />
        <PublishForm mode={publishMode} onClose={() => setPublishMode(null)} />

        {/* Hide BottomNav when a detail page is open */}
        {!isDetailOpen && (
          <BottomNav 
            activeTab={activeTab} 
            onChange={(tab) => {
              if (tab === 'community') setCommunityTopic('全部');
              setActiveTab(tab);
            }} 
            onPublish={() => setIsPublishOpen(true)} 
          />
        )}
      </div>

      {/* Global CSS for hiding scrollbar nicely but allowing scroll */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
