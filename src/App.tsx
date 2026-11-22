import { useState } from 'react';
import { CourseMap } from './app/CourseMap';
import { LessonView } from './app/LessonView';
import { StartScreen } from './app/StartScreen';
import { wakeWithin } from './app/wake';
import { createEngine, type AudioEngine } from './audio/engine';
import { course } from './lessons/content';
import type { Lesson } from './lessons/types';
import './app/app.css';

type Screen =
  { name: 'start'; waking: boolean } | { name: 'map' } | { name: 'lesson'; index: number };

export interface AppProps {
  /** For tests; defaults to the real engine. */
  engine?: AudioEngine;
  /** For tests; defaults to the real course. */
  lessons?: Lesson[];
}

/** Start screen → course map → lesson view. */
export function App({ engine: injected, lessons = course }: AppProps) {
  const [engine] = useState(() => injected ?? createEngine());
  const [screen, setScreen] = useState<Screen>({ name: 'start', waking: false });

  switch (screen.name) {
    case 'start':
      return (
        <StartScreen
          waking={screen.waking}
          onWake={() => {
            setScreen({ name: 'start', waking: true });
            // Inside the click: browsers only let audio start from a user gesture. Sounds keep
            // loading after this resolves; the lesson stage shows their status (and any error).
            void wakeWithin(engine).then(() => {
              setScreen({ name: 'map' });
            });
          }}
        />
      );
    case 'map':
      return (
        <CourseMap
          lessons={lessons}
          onOpen={(index) => {
            setScreen({ name: 'lesson', index });
          }}
        />
      );
    case 'lesson':
      return (
        <LessonView
          key={screen.index}
          engine={engine}
          lessons={lessons}
          index={screen.index}
          onBack={() => {
            setScreen({ name: 'map' });
          }}
          onNext={() => {
            const next = screen.index + 1;
            setScreen(next < lessons.length ? { name: 'lesson', index: next } : { name: 'map' });
          }}
        />
      );
  }
}
