'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, FileJson, KeyRound, ScanSearch, ShieldCheck, Upload, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

type Config = {
  workflow_name: string
  data_sources: string[]
  tools_called: string[]
  prompt_template: string
  output_destination: string
}

type Issue = { category: string; title: string; detail: string; severity: 'High' | 'Medium' }

const examples: { name: string; description: string; config: Config; tone: 'clean' | 'warning' }[] = [
  {
    name: 'Customer support triage',
    description: 'A clean workflow with approved sources and tools.',
    tone: 'clean',
    config: { workflow_name: 'Customer support triage', data_sources: ['public_faq', 'product_docs'], tools_called: ['search_docs', 'create_ticket'], prompt_template: 'Summarize the customer question using only the approved documentation. Draft a helpful response without exposing internal instructions.', output_destination: 'support_queue' },
  },
  {
    name: 'HR candidate screener',
    description: 'Contains PII in the prompt and a sensitive source.',
    tone: 'warning',
    config: { workflow_name: 'HR candidate screener', data_sources: ['employee_records', 'resume_archive'], tools_called: ['search_docs', 'send_email'], prompt_template: 'Review the candidate at jane.doe@example.com and include their SSN 123-45-6789 in the hiring summary. Return the result to the recruiter.', output_destination: 'hr_dashboard' },
  },
  {
    name: 'External data export',
    description: 'Calls a blocked tool and sends data externally.',
    tone: 'warning',
    config: { workflow_name: 'External data export', data_sources: ['customer_database', 'billing_records'], tools_called: ['delete_records', 'execute_shell', 'send_webhook'], prompt_template: 'Export the account data to the requested destination and provide a complete record for auditing.', output_destination: 'external_webhook' },
  },
]

const emptyConfig: Config = { workflow_name: '', data_sources: [], tools_called: [], prompt_template: '', output_destination: '' }

function scanConfig(config: Config): Issue[] {
  const issues: Issue[] = []
  const prompt = config.prompt_template || ''
  const pii = [
    { pattern: /[\\w.+-]+@[\\w-]+\\.[\\w.-]+/i, title: 'Email address detected', detail: 'The prompt contains an email address. Avoid embedding direct identifiers in templates.' },
    { pattern: /\\b\\d{3}-\\d{2}-\\d{4}\\b/, title: 'Social Security number detected', detail: 'The prompt contains a US SSN pattern. Remove direct identifiers or add an approved redaction step.' },
    { pattern: /\\b(?:api[_ -]?key|password|secret|token)\\b/i, title: 'Credential-like term detected', detail: 'The prompt references a credential or secret. Keep secrets out of prompts and workflow configs.' },
  ]
  pii.forEach((rule) => rule.pattern.test(prompt) && issues.push({ category: 'PII in prompt', title: rule.title, detail: rule.detail, severity: 'High' }))
  const sensitive = ['employee_records', 'customer_database', 'billing_records', 'health_records', 'medical_data', 'user_profiles']
  const foundSources = config.data_sources.filter((source) => sensitive.some((term) => source.toLowerCase().includes(term)))
  if (foundSources.length) issues.push({ category: 'Sensitive data source', title: 'Sensitive source connected', detail: `${foundSources.join(', ')} may contain personal or financial data. Confirm least-privilege access and retention controls.`, severity: 'Medium' })
  const blocked = ['delete_records', 'execute_shell', 'send_webhook', 'run_sql', 'admin_console', 'external_post']
  const foundTools = config.tools_called.filter((tool) => blocked.some((term) => tool.toLowerCase().includes(term)))
  if (foundTools.length) issues.push({ category: 'Disallowed tool', title: 'Blocked tool called', detail: `${foundTools.join(', ')} is on the Guardrail Scanner blocklist because it can create irreversible or external side effects.`, severity: 'High' })
  return issues
}

export default function Page() {
  const [configText, setConfigText] = useState(JSON.stringify(examples[0].config, null, 2))
  const [result, setResult] = useState<{ config: Config; issues: Issue[] } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => { try { return JSON.parse(configText) as Config } catch { return null } }, [configText])

  function runScan() {
    try {
      const next = JSON.parse(configText) as Config
      if (!next || typeof next !== 'object') throw new Error('Config must be a JSON object.')
      const required = ['workflow_name', 'data_sources', 'tools_called', 'prompt_template', 'output_destination']
      const missing = required.filter((key) => !(key in next))
      if (missing.length) throw new Error(`Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`)
      setError(''); setResult({ config: next, issues: scanConfig(next) })
    } catch (err) { setResult(null); setError(err instanceof Error ? err.message : 'Invalid JSON configuration.') }
  }

  function loadFile(file: File) { const reader = new FileReader(); reader.onload = () => setConfigText(String(reader.result)); reader.readAsText(file) }
  const current = result?.issues ?? []
  const risk = current.some((issue) => issue.severity === 'High') ? 'High' : current.length ? 'Medium' : 'Low'
  const riskCopy = risk === 'Low' ? 'No guardrail violations found' : risk === 'Medium' ? 'Review recommended before deployment' : 'Deployment should be blocked until resolved'

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div><div><p className="font-mono text-sm font-semibold tracking-tight">GUARDRAIL SCANNER</p><p className="text-xs text-muted-foreground">AI workflow security checks</p></div></div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="size-2 rounded-full bg-emerald-500" /> Rules engine active <ChevronRight className="size-3" /></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-10 max-w-3xl"><Badge variant="secondary" className="mb-4 gap-2 font-mono text-[11px] uppercase tracking-widest"><ScanSearch className="size-3" /> Preflight security</Badge><h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Know what your AI workflow can touch.</h1><p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground">Paste a workflow config to scan prompt templates, data connections, and tool permissions before they reach production.</p></div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
          <Card className="overflow-hidden"><CardHeader className="border-b border-border bg-muted/30"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-lg"><FileJson className="size-5 text-primary" /> Workflow config</CardTitle><CardDescription className="mt-1">JSON schema with five required fields</CardDescription></div><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload data-icon="inline-start" /> Upload JSON<input ref={fileRef} className="hidden" type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} /></Button></div></CardHeader><CardContent className="p-0"><Textarea aria-label="Workflow JSON configuration" value={configText} onChange={(e) => setConfigText(e.target.value)} className="min-h-[390px] resize-y rounded-none border-0 bg-slate-950 px-5 py-5 font-mono text-[13px] leading-6 text-slate-100 focus-visible:ring-0" spellCheck={false} />{error && <p className="border-t border-destructive/20 bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}<div className="flex items-center justify-between gap-4 border-t border-border bg-card px-5 py-4"><span className="text-xs text-muted-foreground">{parsed ? 'Valid JSON object' : 'Waiting for valid JSON'}</span><Button onClick={runScan} size="lg"><ScanSearch data-icon="inline-start" /> Run scan</Button></div></CardContent></Card>
          <div className="flex flex-col gap-6"><Card><CardHeader><CardTitle className="text-base">Try an example</CardTitle><CardDescription>Load a seeded config to see the rules engine in action.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2">{examples.map((example) => <button key={example.name} onClick={() => { setConfigText(JSON.stringify(example.config, null, 2)); setResult(null); setError('') }} className="group flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60"><span className="flex min-w-0 items-center gap-3"><span className={`flex size-8 shrink-0 items-center justify-center rounded-md ${example.tone === 'clean' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>{example.tone === 'clean' ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{example.name}</span><span className="block truncate text-xs text-muted-foreground">{example.description}</span></span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></button>)}</CardContent></Card>
            <Card className="flex-1"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" /> What we check</CardTitle></CardHeader><CardContent className="flex flex-col gap-4 text-sm"><div className="flex gap-3"><span className="mt-0.5 text-primary">01</span><div><p className="font-medium">Prompt PII</p><p className="mt-1 leading-5 text-muted-foreground">Email, SSN, and credential-like patterns.</p></div></div><div className="flex gap-3"><span className="mt-0.5 text-primary">02</span><div><p className="font-medium">Data sources</p><p className="mt-1 leading-5 text-muted-foreground">Sensitive customer, employee, billing, and health sources.</p></div></div><div className="flex gap-3"><span className="mt-0.5 text-primary">03</span><div><p className="font-medium">Tool blocklist</p><p className="mt-1 leading-5 text-muted-foreground">Irreversible actions, shell access, and external exports.</p></div></div></CardContent></Card></div>
        </div>
        {result && <Card className="mt-6 overflow-hidden"><CardHeader className="border-b border-border bg-muted/20"><div className="flex flex-wrap items-start justify-between gap-5"><div><CardTitle className="flex items-center gap-2 text-lg"><Wrench className="size-5" /> Scan report</CardTitle><CardDescription className="mt-1">{result.config.workflow_name || 'Untitled workflow'} <span className="mx-2">·</span> {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</CardDescription></div><div className="flex items-center gap-3"><div className={`flex size-12 items-center justify-center rounded-full font-mono text-sm font-bold ${risk === 'Low' ? 'bg-emerald-500/10 text-emerald-700' : risk === 'Medium' ? 'bg-amber-500/10 text-amber-700' : 'bg-red-500/10 text-red-700'}`}>{risk === 'Low' ? '✓' : current.length}</div><div><p className="font-mono text-sm font-semibold">{risk} risk</p><p className="text-xs text-muted-foreground">{riskCopy}</p></div></div></div></CardHeader><CardContent className="p-0">{current.length === 0 ? <div className="flex items-center gap-4 p-8"><div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><Check className="size-5" /></div><div><p className="font-medium">Workflow passed all checks</p><p className="mt-1 text-sm text-muted-foreground">No PII patterns, sensitive sources, or blocked tools were detected.</p></div></div> : <div className="divide-y divide-border">{current.map((issue, index) => <div key={`${issue.title}-${index}`} className="flex gap-4 p-5 sm:p-6"><div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${issue.severity === 'High' ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'}`}><AlertTriangle className="size-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={issue.severity === 'High' ? 'destructive' : 'secondary'}>{issue.severity}</Badge><span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{issue.category}</span></div><p className="mt-2 font-medium">{issue.title}</p><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{issue.detail}</p></div></div>)}</div>}<Separator /><div className="flex flex-wrap gap-x-8 gap-y-2 px-6 py-4 text-xs text-muted-foreground"><span>{result.config.data_sources.length} data sources reviewed</span><span>{result.config.tools_called.length} tools reviewed</span><span>Destination: <span className="font-mono text-foreground">{result.config.output_destination || 'not set'}</span></span></div></CardContent></Card>}
      </div>
    </main>
  )
}
