import { parseTagList } from '@/lib/profile';

describe('parseTagList', () => {
  it('splits on commas and trims whitespace', () => {
    expect(parseTagList('Uniqlo, J.Crew,  Nike')).toEqual(['Uniqlo', 'J.Crew', 'Nike']);
  });

  it('drops empty entries from stray/trailing commas', () => {
    expect(parseTagList('Uniqlo, , J.Crew,')).toEqual(['Uniqlo', 'J.Crew']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseTagList('')).toEqual([]);
    expect(parseTagList('   ')).toEqual([]);
  });

  it('returns a single entry unchanged when there are no commas', () => {
    expect(parseTagList('minimalist')).toEqual(['minimalist']);
  });
});
