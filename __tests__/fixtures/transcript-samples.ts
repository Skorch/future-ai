// Test fixtures for transcript parser tests

export const validWebVTT = `WEBVTT

1
00:00:03.840 --> 00:00:08.200
Drew Beaupre: Welcome to the meeting.

2
00:00:08.500 --> 00:00:15.000
Sarah Chen: Thanks for having me.

3
00:00:15.500 --> 00:00:22.750
Drew Beaupre: Let's discuss the implementation.`;

export const validFathom = `Team Meeting - January 15
VIEW RECORDING - 30 mins: https://fathom.video/share/abc123

---

0:00 - Drew Beaupre (Mammoth Growth)
  Welcome to the meeting.

0:15 - Sarah Chen (Engineering)
  Thanks for having me.

0:30 - Drew Beaupre
  Let's discuss the implementation.`;

export const webVTTWithHours = `WEBVTT

1
01:30:45.500 --> 01:30:50.000
John Doe: Testing hours in timestamp.

2
02:15:30.250 --> 02:15:35.000
Jane Smith: Another test with hours.`;

export const malformedWebVTT = `WEBVTT

No timestamp here
Just some text

00:00:05.000 --> 
Missing end time

4
00:00:10.000 --> 00:00:15.000
No speaker format here

5

6
00:00:20.000 --> 00:00:25.000
Drew Beaupre: Valid entry after malformed ones.`;

export const webVTTWithEmptyBlocks = `WEBVTT

1
00:00:05.000 --> 00:00:10.000


2
00:00:15.000 --> 00:00:20.000
Speaker: Text after empty block`;

export const webVTTNoSpeaker = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
Just text without speaker format

2
00:00:15.000 --> 00:00:20.000
Another line without colon`;

export const fathomWithMultiLine = `VIEW RECORDING

0:00 - Speaker Name
  Line 1 of text
  Line 2 of text
  
0:15 - Next Speaker
  Next text`;

export const fathomNoText = `VIEW RECORDING

0:00 - Speaker One
  Text here
  
0:15 - Speaker Two

0:30 - Speaker Three
  More text`;

export const fathomWithCompanyNames = `VIEW RECORDING

0:00 - Drew Beaupre (Mammoth Growth)
  Text with company name.
  
0:30 - Sarah Chen (Engineering Department)
  Another speaker with department.
  
1:00 - Mike Johnson
  Speaker without company.`;

export const edgeCaseDocument = `# Header 1

Some content here

## Header 2

More content

### Header 3

Final content`;

export const plainTextDocument = `This is just plain text without any headers.
It should be treated as a single document chunk.
Multiple lines but no markdown structure.`;

export const documentWithCodeBlocks = `# Technical Documentation

Here's some regular text.

\`\`\`javascript
const example = 'code block';
\`\`\`

## Another Section

More content here.`;

export const emptyContent = ``;

export const webVTTLowercase = `webvtt

1
00:00:05.000 --> 00:00:10.000
Speaker: Should not be detected as WebVTT`;

export const fathomNoViewRecording = `Team Meeting - January 15

0:00 - Speaker Name
  Text without the special marker`;

export const webVTTWithMultipleColons = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
Speaker: URL: https://example.com - more text`;

export const unicodeContent = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
Speaker: 你好世界 🌍 Unicode test`;

export const veryLongSpeakerName = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
${'A'.repeat(200)}: Text with very long speaker name`;

export const webVTTWithSpecialChars = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
John@Doe.com: Email as speaker name

2
00:00:15.000 --> 00:00:20.000
Speaker [Admin]: Brackets in name`;

export const invalidTimeFormats = [
  '99:99:99',
  'abc:def',
  '1:2:3:4',
  '',
  'NaN:NaN',
  '-10:30',
];

export const fathomHoursFormat = `VIEW RECORDING

1:30:45 - Speaker One
  Text with hours in timestamp.
  
2:00:00 - Speaker Two
  Exactly two hours.`;

export const mixedFormatContent = `WEBVTT
VIEW RECORDING

This content has markers from both formats`;

// Edge case: Very large transcript
export const largeTranscript = (() => {
  let content = 'WEBVTT\n\n';
  for (let i = 0; i < 1000; i++) {
    const mins = Math.floor(i / 2);
    const secs = (i % 2) * 30;
    const startTime = `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.000`;
    const endTime = `00:${mins.toString().padStart(2, '0')}:${(secs + 25).toString().padStart(2, '0')}.000`;
    content += `${i + 1}\n${startTime} --> ${endTime}\nSpeaker ${i % 3}: Message number ${i + 1}.\n\n`;
  }
  return content;
})();
