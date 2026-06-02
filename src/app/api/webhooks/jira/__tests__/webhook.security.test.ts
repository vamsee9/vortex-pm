import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import * as adminSupabase from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn()
}))

describe('Jira Webhook Security & RBAC', () => {
  const MOCK_PROJECT_ID = 'test-proj-123'
  const VALID_SECRET = 'super-secret-token'

  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { webhook_secret: VALID_SECRET },
        error: null
      })
    }
    
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue(mockSupabase)
  })

  it('rejects requests missing projectId', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/jira', {
      method: 'POST',
      headers: {
        'x-webhook-secret': VALID_SECRET
      }
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('rejects requests missing x-webhook-secret header', async () => {
    const req = new NextRequest(`http://localhost/api/webhooks/jira?projectId=${MOCK_PROJECT_ID}`, {
      method: 'POST'
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('rejects requests with incorrect secret for project', async () => {
    const req = new NextRequest(`http://localhost/api/webhooks/jira?projectId=${MOCK_PROJECT_ID}`, {
      method: 'POST',
      headers: {
        'x-webhook-secret': 'wrong-secret'
      }
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('rejects requests if project does not exist', async () => {
    // Mock the DB returning no project
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' }
    })

    const req = new NextRequest(`http://localhost/api/webhooks/jira?projectId=non-existent`, {
      method: 'POST',
      headers: {
        'x-webhook-secret': VALID_SECRET
      }
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('accepts valid signatures and safely handles unknown event types (robustness)', async () => {
    const req = new NextRequest(`http://localhost/api/webhooks/jira?projectId=${MOCK_PROJECT_ID}`, {
      method: 'POST',
      headers: {
        'x-webhook-secret': VALID_SECRET
      },
      body: JSON.stringify({
        webhookEvent: 'unknown:event_type'
      })
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    
    const data = await res.json()
    expect(data.status).toBe('ignored')
    expect(data.event).toBe('unknown:event_type')
  })

  it('catches malformed JSON payloads safely (worst-case scenario)', async () => {
    const req = new NextRequest(`http://localhost/api/webhooks/jira?projectId=${MOCK_PROJECT_ID}`, {
      method: 'POST',
      headers: {
        'x-webhook-secret': VALID_SECRET
      },
      body: 'invalid json {'
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    
    const data = await res.json()
    expect(data.error).toBe('Internal server error')
  })
})
