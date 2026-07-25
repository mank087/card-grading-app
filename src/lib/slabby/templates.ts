import { SlabbyScene } from './types';

/**
 * Built-in scene templates. Card slots are left empty — apply a template,
 * then load a card into the beats that reference one. Users can also save
 * their own templates (stored in the browser by the Lab).
 */
export const BUILTIN_TEMPLATES: { name: string; description: string; scene: SlabbyScene }[] = [
  {
    name: 'Grade Reveal',
    description: 'Rumbling "?" → GEM MINT celebration. Load a card as slab mockup into beats 2-3.',
    scene: {
      name: 'grade-reveal',
      beats: [
        { duration: 2, expression: 'happy', motion: 'enter', gradeText: '?', gradeLabel: 'GRADING…', caption: 'Today’s submission is back…', voiceover: 'Today’s submission just came back from grading…' },
        { duration: 2.5, expression: 'thinking', motion: 'shake', gradeText: '?', gradeLabel: 'GRADING…', headline: 'THE MOMENT OF TRUTH', voiceover: 'This is the moment of truth. I can’t look.' },
        { duration: 3, expression: 'excited', motion: 'celebrate', gradeText: '10', gradeLabel: 'GEM MINT', headline: 'GEM MINT 10!', caption: 'Grade yours at dcmgrading.com', voiceover: 'GEM MINT TEN! Are you kidding me?!' },
      ],
    },
  },
  {
    name: 'Card Commentary',
    description: 'Slabby walks through a card’s details page. Load a card as scrolling page into both beats.',
    scene: {
      name: 'card-commentary',
      beats: [
        { duration: 4, expression: 'happy', motion: 'point', scrollFrom: 0, scrollTo: 0.5, caption: 'Let’s break this one down…', voiceover: 'Alright collectors, let’s break this one down.' },
        { duration: 4, expression: 'excited', motion: 'jump', scrollFrom: 0.5, scrollTo: 1, bgAnimation: 'static', caption: 'Look at those subgrades!', voiceover: 'Look at those subgrades. That surface is immaculate.' },
      ],
    },
  },
  {
    name: 'News React',
    description: 'Reaction to a screenshot. Paste/upload the news image into beat 2.',
    scene: {
      name: 'news-react',
      beats: [
        { duration: 2, expression: 'happy', motion: 'enter', caption: 'Big news in the hobby…', voiceover: 'Big news in the hobby today.' },
        { duration: 3, expression: 'shocked', motion: 'jump', bgAnimation: 'pop', headline: 'WAIT… WHAT?!', voiceover: 'Wait. WHAT?! No way this is real.' },
        { duration: 2.5, expression: 'thinking', motion: 'idle', bgAnimation: 'static', caption: 'Here’s what it means for your collection…', voiceover: 'Here’s what it actually means for your collection.' },
      ],
    },
  },
];
