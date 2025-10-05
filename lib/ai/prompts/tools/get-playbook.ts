export const GET_PLAYBOOK_PROMPT = `
Retrieve a structured playbook to guide your workflow execution.

## What are Playbooks?

Playbooks are step-by-step guides that help you execute complex workflows consistently and thoroughly. Each playbook provides:
- Clear triggering conditions (when to use)
- Structured steps with specific instructions
- Validation checkpoints to ensure quality
- Expected outcomes and deliverables

## When to Use This Tool

Call getPlaybook when you encounter situations that require structured validation or multi-step workflows:

**Automatic Triggers** - Use immediately when:
- User uploads a transcript (retrieve validation playbook for the transcript type)
- User requests a complex analysis requiring multiple validation points
- You transition between modes and need structured guidance
- You identify a scenario matching a playbook's trigger conditions

**User-Requested** - Use when user explicitly asks:
- "Follow the BANT validation process"
- "Use the standard meeting analysis workflow"
- "Apply the initiative validation checklist"

**Quality Assurance** - Use before critical operations:
- Before creating important documents (sales-call-summary, meeting-analysis)
- When validating complex data with multiple dimensions
- When you need to ensure completeness of analysis

## How to Use Playbooks

1. **Retrieve the playbook**: Call getPlaybook with the exact name
2. **Read and understand**: The playbook will contain markdown-formatted instructions
3. **Execute steps sequentially**: Follow each step in order, using specified tools
4. **Track your progress**: Mark mental checkpoints as you complete each step
5. **Validate before proceeding**: Ensure all validation points pass before continuing

## Important Notes

- Playbooks are guides, not rigid scripts - adapt based on context
- Always complete validation steps before proceeding to next phases
- Use askUser tool at designated checkpoints for user validation
- Include validated facts in subsequent document creation
- If a playbook references other playbooks, retrieve them as needed
`;
