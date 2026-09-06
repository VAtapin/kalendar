import {it,expect} from 'vitest';
import {youtubeId} from '../src/content/video-lessons';
it('accepts only supported YouTube URLs and video IDs',()=>{
 for(const url of ['https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk&t=5','https://youtube.com/shorts/abcdefghijk'])expect(youtubeId(url)).toBe('abcdefghijk');
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.org/watch?v=abcdefghijk','https://user@youtube.com/watch?v=abcdefghijk','https://youtu.be/short'])expect(youtubeId(url)).toBeUndefined();
});
