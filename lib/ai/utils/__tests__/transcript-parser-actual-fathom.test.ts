import { describe, it, expect } from 'vitest';
import { parseTranscript } from '../transcript-parser';

describe('Actual Fathom Transcript Format', () => {
  it('should parse actual Fathom format with text on next line', () => {
    const content = `Neil and Andrew Beaupre - September 11
VIEW RECORDING - 74 mins (No highlights): https://fathom.video/share/H3JWdnh6YtkYcCXSpscx1vASV_TN_sNk

---

0:01 - Drew Beaupre (Mammoth Growth)
  Hey, Neil. How are you?

0:03 - Neil Welman (Lulalend)
  Good. How are you doing? Oh, sorry. Good. Good. Good. Apologies for being a bit late. End of problem. My wife's down in London, so I'm going to mess it up.

0:21 - Drew Beaupre (Mammoth Growth)
  Yeah, all those extra little things that, like, when you're soloing.

0:28 - Neil Welman (Lulalend)
  I don't even know. I'm just running around like a headless chicken. Yeah. That's all good. All good. Cool. Should we jump in?  Let's do it.

0:40 - Drew Beaupre (Mammoth Growth)
  You want to hear the latest?

0:41 - Neil Welman (Lulalend)
  Yeah.

0:42 - Drew Beaupre (Mammoth Growth)
  Let's do it.`;

    const items = parseTranscript(content);

    // Should have parsed 7 speaker turns
    expect(items).toHaveLength(7);

    // Check first item
    expect(items[0]).toEqual({
      timecode: 1, // 0:01 = 1 second
      speaker: 'Drew Beaupre',
      text: 'Hey, Neil. How are you?',
    });

    // Check second item with longer text
    expect(items[1]).toEqual({
      timecode: 3, // 0:03 = 3 seconds
      speaker: 'Neil Welman',
      text: "Good. How are you doing? Oh, sorry. Good. Good. Good. Apologies for being a bit late. End of problem. My wife's down in London, so I'm going to mess it up.",
    });

    // Check item with multi-line text
    expect(items[3]).toEqual({
      timecode: 28, // 0:28 = 28 seconds
      speaker: 'Neil Welman',
      text: "I don't even know. I'm just running around like a headless chicken. Yeah. That's all good. All good. Cool. Should we jump in?  Let's do it.",
    });

    // Check all speakers are parsed correctly
    const speakers = [...new Set(items.map((i) => i.speaker))];
    expect(speakers).toContain('Drew Beaupre');
    expect(speakers).toContain('Neil Welman');
  });

  it('should handle multi-line text correctly', () => {
    const content = `VIEW RECORDING

0:01 - Speaker One (Company)
  This is line one.
  This is line two.
  This is line three.

0:05 - Speaker Two (Company)
  Another message here.`;

    const items = parseTranscript(content);

    expect(items).toHaveLength(2);
    expect(items[0].text).toBe(
      'This is line one. This is line two. This is line three.',
    );
    expect(items[1].text).toBe('Another message here.');
  });

  it('should stop at empty lines between speakers', () => {
    const content = `VIEW RECORDING

0:01 - Speaker One (Company)
  Message one.

0:05 - Speaker Two (Company)
  Message two.`;

    const items = parseTranscript(content);

    expect(items).toHaveLength(2);
    expect(items[0].text).toBe('Message one.');
    expect(items[1].text).toBe('Message two.');
  });
});
