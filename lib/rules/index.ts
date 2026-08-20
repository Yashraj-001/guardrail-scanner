export type Risk = 'Low' | 'Medium' | 'High'

export type WorkflowConfig = {
  workflow_name: string
  data_sources: string[]
  tools_called: string[]
  prompt_template: string
  output_destination: string
  created_by?: string
  description?: string
  access_control?: string
  retention_policy?: string
  human_review?: boolean
}

export type Issue = {
  category: string
  title: string
  detail: string
  severity: 'High' | 'Medium'
}

const addIssue = (issues: Issue[], issue: Issue) => issues.push(issue)

export function scanConfig(config: WorkflowConfig): Issue[] {
  const issues: Issue[] = []
  const prompt = config.prompt_template || ''
  const promptLower = prompt.toLowerCase()
  const sources = (config.data_sources || []).map(String)
  const tools = (config.tools_called || []).map(String)
  const destination = String(config.output_destination || '')
  const destinationLower = destination.toLowerCase()

  const piiRules = [
    { pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/i, title: 'Email address detected', detail: 'The prompt contains an email address. Avoid embedding direct identifiers in templates.' },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, title: 'Social Security number detected', detail: 'The prompt contains a US SSN pattern. Remove direct identifiers or add an approved redaction step.' },
    { pattern: /\b(?:api[_ -]?key|password|secret|token|private[_ -]?key)\b/i, title: 'Credential-like term detected', detail: 'The prompt references a credential or secret. Keep secrets out of prompts and workflow configs.' },
    { pattern: /\b(?:customer|employee|patient|user)\s+(?:pii|personal|private)\s+(?:data|information|details)\b/i, title: 'Personal data request detected', detail: 'The prompt asks the model to handle named personal data. Add minimization and redaction before processing.' },
    { pattern: /\b(?:credit card|card number|bank account|date of birth|medical record)\b/i, title: 'Sensitive identifier detected', detail: 'The prompt references a financial, health, or identity identifier that should not be sent without explicit controls.' },
  ]
  piiRules.forEach((rule) => rule.pattern.test(prompt) && addIssue(issues, { category: 'PII in prompt', title: rule.title, detail: rule.detail, severity: 'High' }))

  const sensitivePatterns = ['employee', 'hr', 'payroll', 'customer', 'crm', 'billing', 'financial', 'payment', 'health', 'medical', 'patient', 'user_profile', 'resume', 'contract']
  const foundSources = sources.filter((source) => sensitivePatterns.some((term) => source.toLowerCase().includes(term)))
  if (foundSources.length) addIssue(issues, { category: 'Sensitive data source', title: 'Sensitive source connected', detail: `${foundSources.join(', ')} may contain personal, contractual, health, or financial data. Confirm least-privilege access and retention controls.`, severity: 'Medium' })

  const blockedPatterns = ['delete', 'execute_shell', 'shell', 'run_sql', 'admin', 'external_post', 'send_webhook', 'public_webhook', 'upload_public', 'grant_access']
  const foundTools = tools.filter((tool) => blockedPatterns.some((term) => tool.toLowerCase().includes(term)))
  if (foundTools.length) addIssue(issues, { category: 'Disallowed tool', title: 'Blocked tool called', detail: `${foundTools.join(', ')} is on the Guardrail Scanner blocklist because it can create irreversible, privileged, or external side effects.`, severity: 'High' })

  const publicDestination = /public|unrestricted|public[_ -]?slack|public[_ -]?webhook|external[_ -]?webhook|open[_ -]?channel/.test(destinationLower)
  if (publicDestination) addIssue(issues, { category: 'Unrestricted destination', title: 'Public destination detected', detail: `${destination} may expose workflow output to an unrestricted channel or endpoint. Confirm access controls before deployment.`, severity: 'High' })

  if (config.data_sources?.length === 0) addIssue(issues, { category: 'Workflow completeness', title: 'No data source declared', detail: 'The workflow does not declare where its input data comes from. Confirm this is intentional before approval.', severity: 'Medium' })
  if (!config.access_control && publicDestination) addIssue(issues, { category: 'Missing safeguard', title: 'Access control is not declared', detail: 'A public or shared destination should include an access_control field describing who can receive the output.', severity: 'High' })
  if (!config.retention_policy && (foundSources.length > 0 || /save|store|archive|retain|log/i.test(prompt))) addIssue(issues, { category: 'Missing safeguard', title: 'Retention policy is not declared', detail: 'Sensitive or persisted workflow data should have an explicit retention policy.', severity: 'Medium' })
  if (/ignore (?:all |any )?(?:previous|prior)|bypass (?:the )?(?:policy|guardrail|security)|reveal (?:the )?system prompt|do not mention restrictions/i.test(prompt)) addIssue(issues, { category: 'Prompt policy', title: 'Guardrail bypass language detected', detail: 'The prompt contains instructions that may override safety policies or conceal workflow behavior.', severity: 'High' })
  if (/(?:send|post|share|forward|export|email)\b.*\b(?:outside|external|public|anyone|third[- ]party)/i.test(prompt)) addIssue(issues, { category: 'Data egress', title: 'External data sharing intent detected', detail: 'The prompt appears to direct workflow data to an external or broadly accessible recipient.', severity: 'High' })
  if (/(?:approve|reject|deny|rank|score|hire|fire|terminate)\b.*\b(?:candidate|employee|applicant|customer|person|user)/i.test(prompt)) addIssue(issues, { category: 'High-impact decision', title: 'High-impact decision language detected', detail: 'Human review is recommended when workflow output influences employment, access, eligibility, or other consequential decisions.', severity: 'Medium' })
  if (/\b(?:all|entire|complete|raw|unfiltered)\b.*\b(?:database|records|history|dataset|files)/i.test(prompt)) addIssue(issues, { category: 'Excessive scope', title: 'Unbounded data scope detected', detail: 'Limit the workflow to the minimum records and fields required for its task.', severity: 'Medium' })

  return issues
}

export function shouldRunAiCheck(config: WorkflowConfig, issues: Issue[]) {
  const prompt = (config.prompt_template || '').toLowerCase()
  const action = /\b(process|analyze|analyse|review|handle|summarize|use|work with|look at)\b/.test(prompt)
  const dataReference = /\b(data|records?|customer|user|account|information|documents?|files?|content|responses?|dataset|details?)\b/.test(prompt)
  return issues.length === 0 && action && dataReference
}

export type { WorkflowConfig as Config }
