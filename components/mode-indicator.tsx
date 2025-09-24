'use client';

import { useEffect, useState, useRef } from 'react';
import { useDataStream } from './data-stream-provider';

interface ModeIndicatorProps {
  initialMode?: 'discovery' | 'build';
  goal?: string | null;
  todos?: string | null;
  className?: string;
}

export function ModeIndicator({
  initialMode = 'discovery',
  goal,
  todos,
  className = '',
}: ModeIndicatorProps) {
  const [currentMode, setCurrentMode] = useState(initialMode);
  const [todoCount, setTodoCount] = useState(0);
  const { dataStream } = useDataStream();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    // Parse todos if provided
    if (todos) {
      try {
        const todoList = JSON.parse(todos);
        setTodoCount(todoList.todos?.length || 0);
      } catch (e) {
        console.error('Failed to parse todos:', e);
      }
    }
  }, [todos]);

  useEffect(() => {
    // Listen for mode changes via dataStream
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    newDeltas.forEach((delta) => {
      if (
        delta.type === 'data-modeChanged' &&
        delta.data &&
        typeof delta.data === 'object' &&
        'mode' in delta.data
      ) {
        setCurrentMode(delta.data.mode as 'discovery' | 'build');
      }
    });
  }, [dataStream]);

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-sidebar-border transition-all duration-200 ${
        currentMode === 'discovery'
          ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10'
          : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10'
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {currentMode === 'discovery' ? (
          <>
            <svg
              className="size-4 text-blue-600 dark:text-blue-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Discovery Mode
            </span>
            {!goal && (
              <span className="text-xs text-blue-600/70 dark:text-blue-400/70">
                - Understanding requirements
              </span>
            )}
          </>
        ) : (
          <>
            <svg
              className="size-4 text-green-600 dark:text-green-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Build Mode
            </span>
            {todoCount > 0 && (
              <span className="text-xs text-green-600/70 dark:text-green-400/70">
                - {todoCount} todos
              </span>
            )}
          </>
        )}
      </div>

      {goal && (
        <span
          className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]"
          title={goal}
        >
          Goal: {goal}
        </span>
      )}
    </div>
  );
}
