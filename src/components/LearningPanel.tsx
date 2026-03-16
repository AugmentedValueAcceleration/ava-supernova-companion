'use client';

import { useState, useEffect } from 'react';
import { t } from '@/lib/i18n';

type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

interface Lesson {
  id: string;
  title: string;
  status: LessonStatus;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Curriculum {
  id: string;
  title: string;
  description?: string;
  modules: Module[];
}

const statusColors: Record<LessonStatus, string> = {
  locked: 'bg-gray-600 text-gray-400',
  available: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
};

const statusLabels: Record<LessonStatus, string> = {
  locked: 'Locked',
  available: 'Available',
  in_progress: 'In Progress',
  completed: 'Completed',
};

function getCurriculumProgress(curriculum: Curriculum): number {
  let total = 0;
  let completed = 0;
  for (const mod of curriculum.modules) {
    for (const lesson of mod.lessons) {
      total++;
      if (lesson.status === 'completed') completed++;
    }
  }
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

export default function LearningPanel() {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [expandedCurriculum, setExpandedCurriculum] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ava-learning');
      if (stored) {
        const data = JSON.parse(stored);
        // Support both array format and object with curriculums key
        const list = Array.isArray(data) ? data : (data.curriculums || []);
        setCurriculums(list);
      }
    } catch {
      setCurriculums([]);
    }
    setLoading(false);
  }, []);

  const toggleCurriculum = (id: string) => {
    setExpandedCurriculum(prev => prev === id ? null : id);
    setExpandedModule(null);
  };

  const toggleModule = (id: string) => {
    setExpandedModule(prev => prev === id ? null : id);
  };

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading...</div>;
  }

  if (curriculums.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
          </svg>
          <p className="text-sm text-gray-500">{t('noLearningPaths')}</p>
          <p className="text-xs text-gray-600 mt-1">{t('askAvaToTeach')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {curriculums.map(curriculum => {
        const progress = getCurriculumProgress(curriculum);
        const isExpanded = expandedCurriculum === curriculum.id;

        return (
          <div key={curriculum.id} className="bg-ava-surface border border-ava-border rounded-xl overflow-hidden">
            {/* Curriculum header */}
            <button
              onClick={() => toggleCurriculum(curriculum.id)}
              className="w-full text-left p-4 hover:bg-ava-surface-hover transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">{curriculum.title}</h3>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {curriculum.description && (
                <p className="text-xs text-gray-500 mb-2">{curriculum.description}</p>
              )}
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-ava-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ava-purple rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-500 tabular-nums">{progress}%</span>
              </div>
            </button>

            {/* Expanded modules */}
            {isExpanded && (
              <div className="border-t border-ava-border">
                {curriculum.modules.map(mod => {
                  const isModExpanded = expandedModule === mod.id;
                  const modCompleted = mod.lessons.filter(l => l.status === 'completed').length;
                  const modTotal = mod.lessons.length;

                  return (
                    <div key={mod.id} className="border-b border-ava-border/50 last:border-b-0">
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="w-full text-left px-4 py-3 hover:bg-ava-surface-hover transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-3 h-3 text-gray-500 transition-transform ${isModExpanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm text-gray-300">{mod.title}</span>
                        </div>
                        <span className="text-[11px] text-gray-500">{modCompleted}/{modTotal}</span>
                      </button>

                      {isModExpanded && (
                        <div className="pl-8 pr-4 pb-2 space-y-1">
                          {mod.lessons.map(lesson => (
                            <div
                              key={lesson.id}
                              className="flex items-center justify-between py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                {lesson.status === 'completed' ? (
                                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                ) : lesson.status === 'locked' ? (
                                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                  </svg>
                                ) : (
                                  <div className="w-4 h-4 border-2 border-gray-500 rounded" />
                                )}
                                <span className={`text-sm ${lesson.status === 'locked' ? 'text-gray-600' : lesson.status === 'completed' ? 'text-gray-500' : 'text-white'}`}>
                                  {lesson.title}
                                </span>
                              </div>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[lesson.status]}`}>
                                {statusLabels[lesson.status]}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
