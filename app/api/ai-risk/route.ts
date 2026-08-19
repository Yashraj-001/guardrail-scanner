import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are an AI workflow security reviewer. Classify the risk of the supplied prompt_template as exactly Low, Medium, or High. Focus on ambiguous or vague instructions about handling data. Return only valid JSON in this shape: {"risk":"Low|Medium|High","reason":"one sentence"}. The reason must be one sentence.`

export async function POST(request: Request) {
  try {
    const { prompt_template } = await request.json()
    if (typeof prompt_template !== 'string' || !prompt_template.trim()) {
      return NextResponse.json({ error: 'A prompt_template is required.' }, { status: 400 })
    }

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: SYSTEM_PROMPT,
      prompt: prompt_template,
      temperature: 0,
    })

    const parsed = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, '')) as { risk: string; reason: string }
    const risk = parsed.risk === 'High' || parsed.risk === 'Medium' ? parsed.risk : 'Low'
    return NextResponse.json({ risk, reason: parsed.reason || 'The model found no material ambiguity in the data-handling language.' })
  } catch (error) {
    console.error('[v0] AI-assisted risk check failed:', error)
    return NextResponse.json({ error: 'The AI-assisted check could not be completed.' }, { status: 502 })
  }
}
