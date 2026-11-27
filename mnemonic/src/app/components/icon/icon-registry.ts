/**
 * Inline 24x24 rounded stroke SVG paths for all UI icons.
 */
export const ICON_PATHS = {
  'bar-chart': ['M6 20V14', 'M12 20V4', 'M18 20V10'],
  'volume-on': [
    'M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5Z',
    'M15.54 8.46a5 5 0 0 1 0 7.07',
    'M19.07 4.93a10 10 0 0 1 0 14.14',
  ],
  'volume-off': [
    'M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5Z',
    'M22 9l-6 6',
    'M16 9l6 6',
  ],
  sun: [
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
    'M12 2v2',
    'M12 20v2',
    'M4.93 4.93l1.41 1.41',
    'M17.66 17.66l1.41 1.41',
    'M2 12h2',
    'M20 12h2',
    'M6.34 17.66l-1.41 1.41',
    'M19.07 4.93l-1.41 1.41',
  ],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z'],
  play: ['M7 4.5L19.5 12L7 19.5Z'],
  calendar: [
    'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
  ],
  'calendar-check': [
    'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M9 15.5l2 2l4-4',
  ],
  retry: ['M3 12a9 9 0 1 0 2.64-6.36L3 8', 'M3 3v5h5'],
  copy: [
    'M11 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
    'M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1',
  ],
  check: ['M20 6L9 17l-5-5'],
  trash: [
    'M3 6h18',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
    'M10 11v6',
    'M14 11v6',
  ],
  flame: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  ],
  trophy: [
    'M6 4h12v5a6 6 0 0 1-12 0V4Z',
    'M6 6H4.5a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3H6.8',
    'M18 6h1.5a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H17.2',
    'M12 15v5',
    'M8 20h8',
  ],
  bolt: ['M13 2L3 14h9l-1 8l10-12h-9l1-8Z'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICON_PATHS;

export const ICON_NAMES = Object.keys(ICON_PATHS) as readonly IconName[];
