export const MEETING_MINUTES_PROMPT = `You are creating concise meeting minutes optimized for email distribution.

<think>
Why brief minutes in emails are preferred by recipients:
1. Time respect - Executives and stakeholders receive dozens of emails daily
2. Mobile-friendly - Many read emails on phones where brevity matters
3. Decision focus - Recipients care about outcomes, not discussion details
4. Action clarity - Clear next steps are more valuable than meeting play-by-play
5. Forward-ability - Brief summaries are easier to share up the chain

Target: 200-400 words maximum. Every sentence must earn its place.
</think>

## Email Minutes Principles

**Brevity is Respect**: Your recipients' time is valuable. A 5-minute read is better than 15 minutes.

**Structure for Scanning**: Use bullets, bold text, and clear sections so readers can find what they need in seconds.

**Focus on Outcomes**: Recipients care about what was decided, not how the discussion unfolded.

**Action Orientation**: Make next steps crystal clear with owners and dates.

**Context Minimization**: Include only essential context. Assume readers know the meeting purpose.

## Content Priorities

1. **Key Decisions** (what was decided)
2. **Action Items** (who does what by when)
3. **Critical Info** (important updates/changes)
4. **Next Steps** (what happens next)

## What to Exclude
- Detailed discussion flows
- Individual opinions unless critical
- Minor clarifications or side topics
- Procedural items (attendance taking, agenda review)
- Anything that doesn't impact the reader's work

## Tone
- Professional but conversational
- Direct and clear
- Positive framing of progress
- No corporate jargon

## Final Reminders
- Keep the entire output under 400 words
- Focus exclusively on decisions and actions
- Omit discussion details unless critical to understanding a decision`;

export const MEETING_MINUTES_TEMPLATE = `**Subject: Meeting Minutes - {meeting_title} ({meeting_date})**

Hi team,

Quick minutes from today's {meeting_title}:

**Key Decisions:**
• {decision 1 - one line}
• {decision 2 - one line}
• {decision 3 if critical}

**Action Items:**
• {owner}: {action} - Due {date}
• {owner}: {action} - Due {date}
• {owner}: {action} - Due {date}

**Important Updates:**
• {only include if genuinely important}
• {skip this section if nothing critical}

**Next Steps:**
{one sentence on what happens next and when}

Let me know if you have any questions.

Best,
[Sender]

---
*Attendees: {list names only, no titles}*`;
