import { expect, it } from 'bun:test';
import { formatDuration } from './duration';

it('affiche les minutes puis les heures, avec un arrondi avant la conversion', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(33)).toBe('33 min');
    expect(formatDuration(59)).toBe('59 min');
    expect(formatDuration(59.5)).toBe('1h00');
    expect(formatDuration(60)).toBe('1h00');
    expect(formatDuration(63)).toBe('1h03');
    expect(formatDuration(120)).toBe('2h00');
    expect(formatDuration(125)).toBe('2h05');
});
