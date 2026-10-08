import { classifyYouTubeError, parseYouTubeId } from '../youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`],
    [`youtube.com/watch?v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}?si=abc`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://music.youtube.com/watch?v=${ID}&feature=share`],
    [`  https://youtu.be/${ID}  `],
  ])('accepts %s', (input) => {
    expect(parseYouTubeId(input)).toBe(ID);
  });

  it.each([
    [''],
    ['not a url'],
    ['https://vimeo.com/123456'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/channel/UCabcdefghijk'],
    [`https://youtube.com.evil.example/watch?v=${ID}`],
  ])('rejects %s', (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});

describe('classifyYouTubeError', () => {
  it('treats 101 and 150 as embedding disabled', () => {
    expect(classifyYouTubeError(101)).toBe('notEmbeddable');
    expect(classifyYouTubeError(150)).toBe('notEmbeddable');
  });
  it('treats everything else as unavailable', () => {
    for (const code of [2, 5, 100, -1]) expect(classifyYouTubeError(code)).toBe('unavailable');
  });
});
