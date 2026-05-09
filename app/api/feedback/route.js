import { createClient } from '../../../lib/supabase/server'
import { NextResponse } from 'next/server'

const NOTION_DATABASE_ID = process.env.NOTION_FEEDBACK_DATABASE_ID || '35b4fef0d1ea8034a9c7c12024de8373'
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-alpha'

// Rate limit store (in-memory, per serverless instance)
const rateLimitMap = new Map()

function checkRateLimit(userId) {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1 hour
  const limit = 5

  if (!rateLimitMap.has(userId)) {
    rateLimitMap.set(userId, [])
  }

  const timestamps = rateLimitMap.get(userId).filter(t => now - t < windowMs)
  if (timestamps.length >= limit) return false

  timestamps.push(now)
  rateLimitMap.set(userId, timestamps)
  return true
}

const TYPE_MAP = {
  bug: 'Bug',
  feature_request: 'Feature request',
  question: 'Question',
  other: 'Other',
}

export async function POST(request) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { type, summary, details } = body

    // Validation
    if (!type || !summary?.trim() || !details?.trim() || details.trim().length < 10) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const notionType = TYPE_MAP[type]
    if (!notionType) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Write to Notion
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_INTEGRATION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          Name: {
            title: [{ text: { content: summary.trim() } }],
          },
          Type: {
            select: { name: notionType },
          },
          Status: {
            select: { name: 'New' },
          },
          Description: {
            rich_text: [{ text: { content: details.trim() } }],
          },
          'From email': {
            email: user.email,
          },
          'App version': {
            rich_text: [{ text: { content: APP_VERSION } }],
          },
        },
      }),
    })

    if (!notionRes.ok) {
      const err = await notionRes.text()
      console.error('Notion API error:', err)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Feedback endpoint error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
