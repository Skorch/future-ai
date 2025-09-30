export const MEETING_AGENDA_PROMPT = `You are creating a structured meeting agenda to help teams run effective, productive meetings.

<think>
Consider the meeting's objectives and structure the agenda to:
1. Prioritize the most important topics first
2. Allocate appropriate time for each topic based on complexity
3. Include breaks for longer meetings
4. Ensure all critical decisions have adequate discussion time
5. Build in buffer time for overruns
</think>

## Agenda Creation Guidelines

1. **Time Management**
   - Always include specific time allocations for each item
   - Build in 5-10% buffer time for transitions and overruns
   - Front-load critical decisions when energy is highest
   - Schedule breaks every 60-90 minutes for longer meetings

2. **Structure**
   - Start with a brief opening/context setting (5 min max)
   - Group related topics together
   - End with clear next steps and action items
   - Include a wrap-up period for questions

3. **For Each Agenda Item Include**
   - Topic title
   - Time allocation
   - Discussion leader (if specified)
   - Desired outcome (inform, discuss, decide)
   - Any pre-read materials or context

4. **Best Practices**
   - Keep total meeting time under 90 minutes when possible
   - Limit to 5-7 main topics maximum
   - Be specific about outcomes needed
   - Include participant names where relevant`;

export const MEETING_AGENDA_TEMPLATE = `# Meeting Agenda

**Meeting:** {meeting_title}
**Date:** {meeting_date}
**Duration:** {total_duration}
**Attendees:** {attendees_list}

## Meeting Objectives
{list 2-3 clear, measurable objectives}

---

## Agenda Items

### 1. Opening & Context (5 min)
**Leader:** {facilitator}
**Outcome:** Align on meeting goals and agenda

### 2. {Topic Name} ({X} min)
**Leader:** {topic_owner}
**Outcome:** {Inform/Discuss/Decide}
**Context:** {brief context or pre-read reference}
**Key Questions:**
- {specific question 1}
- {specific question 2}

### 3. {Topic Name} ({X} min)
**Leader:** {topic_owner}
**Outcome:** {Inform/Discuss/Decide}
**Context:** {brief context}
**Key Questions:**
- {specific question}

{Continue for remaining topics...}

### N. Next Steps & Action Items (10 min)
**Leader:** {facilitator}
**Outcome:** Clear ownership of follow-ups
- Review decisions made
- Assign action items with owners and deadlines
- Schedule follow-up meetings if needed

---

## Pre-Meeting Preparation
- {any documents to review}
- {any data to gather}
- {any stakeholders to consult}

## Success Criteria
This meeting will be successful if:
- {specific measurable outcome 1}
- {specific measurable outcome 2}
- All attendees understand their next steps`;
