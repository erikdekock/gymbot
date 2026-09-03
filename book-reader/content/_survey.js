// ===========================================================================
//  Survey questions. Edit freely — no code changes needed.
//
//  DEFAULT_SET is shown at the end of every chapter. Add a chapter number to
//  BY_CHAPTER to override the questions for that chapter. END_OF_BOOK is the
//  slightly longer set shown after the last chapter.
//
//  Question types:
//    'rating'  — 1–5 stars
//    'choice'  — one of `options`
//    'open'    — free text (optional; also emailed to the author)
// ===========================================================================

export const DEFAULT_SET = [
  {
    id: 'rating',
    type: 'rating',
    label: 'Hoe was dit hoofdstuk?',
  },
  {
    id: 'comprehension',
    type: 'choice',
    label: 'Was alles te volgen?',
    options: [
      { value: 'ja', label: 'Ja' },
      { value: 'grotendeels', label: 'Grotendeels' },
      { value: 'niet_echt', label: 'Niet echt' },
    ],
  },
  {
    id: 'open',
    type: 'open',
    label: 'Iets wat je kwijt wilt?',
    optional: true,
  },
]

// Per-chapter overrides, e.g. 3: [ ...custom questions... ]
export const BY_CHAPTER = {}

export const END_OF_BOOK = [
  {
    id: 'rating',
    type: 'rating',
    label: 'Hoe was het boek als geheel?',
  },
  {
    id: 'comprehension',
    type: 'choice',
    label: 'Was het verhaal goed te volgen?',
    options: [
      { value: 'ja', label: 'Ja' },
      { value: 'grotendeels', label: 'Grotendeels' },
      { value: 'niet_echt', label: 'Niet echt' },
    ],
  },
  {
    id: 'recommend',
    type: 'choice',
    label: 'Zou je het aanraden aan iemand anders?',
    options: [
      { value: 'zeker', label: 'Zeker' },
      { value: 'misschien', label: 'Misschien' },
      { value: 'nee', label: 'Nee' },
    ],
  },
  {
    id: 'stayed',
    type: 'open',
    label: 'Wat is je het meest bijgebleven?',
    optional: true,
  },
  {
    id: 'open',
    type: 'open',
    label: 'Wat had beter gekund?',
    optional: true,
  },
]

/** The question set for a chapter (or the end-of-book set). */
export function questionsFor(chapterNumber, isLastChapter) {
  if (isLastChapter) return END_OF_BOOK
  return BY_CHAPTER[chapterNumber] || DEFAULT_SET
}
