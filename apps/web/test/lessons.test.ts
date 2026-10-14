import { describe, expect, it } from 'vitest';
import { FEATURE_LAYERS } from '../src/chart/primitives/feature-layout';
import { CONCEPTS } from '../src/content/concepts';
import { glossaryById } from '../src/content/glossary';
import { LESSON_MODULES, LESSONS, nextLesson } from '../src/content/lessons';

describe('learning path content (D73)', () => {
  it('has unique module and lesson ids, every lesson inside a module', () => {
    expect(new Set(LESSON_MODULES.map((m) => m.id)).size).toBe(LESSON_MODULES.length);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect(LESSONS).toEqual(LESSON_MODULES.flatMap((m) => m.lessons));
    expect(LESSON_MODULES.every((m) => m.lessons.length > 0)).toBe(true);
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))(
    '%s only points at glossary terms, concepts and layers that exist',
    (_, lesson) => {
      for (const term of lesson.terms) expect(glossaryById(term), term).toBeDefined();
      for (const c of lesson.concepts) expect(CONCEPTS.map((x) => x.id)).toContain(c);
      for (const a of lesson.actions) {
        if (a.kind === 'OPEN_GLOSSARY') expect(glossaryById(a.term), a.term).toBeDefined();
        if (a.kind === 'OPEN_CONCEPT') expect(CONCEPTS.map((x) => x.id)).toContain(a.concept);
        if (a.kind === 'OPEN_CHART_LAYER') expect(FEATURE_LAYERS).toContain(a.layer);
      }
      expect(lesson.title.trim()).not.toBe('');
      expect(lesson.goal.trim()).not.toBe('');
      expect(lesson.body.trim()).not.toBe('');
    },
  );

  it('never speaks in advice or probability terms (CLAUDE.md rules 6 and 9)', () => {
    const banned =
      /\b(al sinyali|sat sinyali|kesin kazan|garanti|kazanma olasılığı|tavsiye ederim)\b/i;
    for (const l of LESSONS) expect(`${l.title} ${l.goal} ${l.body}`).not.toMatch(banned);
  });
});

describe('nextLesson', () => {
  it('is the first lesson not yet completed, in path order', () => {
    expect(nextLesson([])).toBe(LESSONS[0]);
    expect(nextLesson([LESSONS[0]!.id])).toBe(LESSONS[1]);
    expect(nextLesson([LESSONS[1]!.id])).toBe(LESSONS[0]);
  });

  it('is null when the whole path is done, ignoring unknown ids', () => {
    expect(nextLesson([...LESSONS.map((l) => l.id), 'eski-ders'])).toBeNull();
  });
});
