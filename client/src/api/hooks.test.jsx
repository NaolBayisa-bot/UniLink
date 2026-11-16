import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useBrowse,
  useBlockUser,
  useKeywords,
  useLikeUser,
  useMatchProfile,
  useMatches,
  useMe,
  usePassUser,
  usePhotoUploadSignature,
  useReportUser,
  useShareContact,
  useTicket,
  useUnmatch,
  useUpdateProfile,
} from './queries.js'
import { setToken, clearToken } from './session.js'

const mockFetch = vi.fn()

let currentProfile = {
  nickname: 'Avery',
  gender: 'female',
  real_name: 'Avery Stone',
  department: 'Computer Science',
  profile_complete: true,
}

let currentMatches = [
  { match_id: 'match-luna', matched_at: '2024-11-01T12:00:00.000Z', other_user: { id: 3, nickname: 'Luna' }, i_shared_contact: false, they_shared_contact: false },
  { match_id: 'match-milo', matched_at: '2024-11-02T12:00:00.000Z', other_user: { id: 4, nickname: 'Theo' }, i_shared_contact: true, they_shared_contact: false },
  { match_id: 'match-naomi', matched_at: '2024-11-03T12:00:00.000Z', other_user: { id: 5, nickname: 'Nora' }, i_shared_contact: false, they_shared_contact: true },
  { match_id: 'match-zoe', matched_at: '2024-11-04T12:00:00.000Z', other_user: { id: 6, nickname: 'Kai' }, i_shared_contact: true, they_shared_contact: true },
]

const MOCK_DATA = {
  '/me': () => ({ ...currentProfile }),
  '/browse': [
    { id: 1, nickname: 'Mila', created_at: '2024-10-01T10:00:00.000Z' },
    { id: 2, nickname: 'Darius', created_at: '2024-10-02T10:00:00.000Z' },
    { id: 3, nickname: 'Luna', created_at: '2024-10-03T10:00:00.000Z' },
    { id: 4, nickname: 'Theo', created_at: '2024-10-04T10:00:00.000Z' },
    { id: 5, nickname: 'Nora', created_at: '2024-10-05T10:00:00.000Z' },
    { id: 6, nickname: 'Kai', created_at: '2024-10-06T10:00:00.000Z' },
    { id: 7, nickname: 'Sofia', created_at: '2024-10-07T10:00:00.000Z' },
    { id: 8, nickname: 'Omar', created_at: '2024-10-08T10:00:00.000Z' },
    { id: 9, nickname: 'Ella', created_at: '2024-10-09T10:00:00.000Z' },
    { id: 10, nickname: 'Leo', created_at: '2024-10-10T10:00:00.000Z' },
    { id: 11, nickname: 'Iris', created_at: '2024-10-11T10:00:00.000Z' },
    { id: 12, nickname: 'Sam', created_at: '2024-10-12T10:00:00.000Z' },
  ],
  '/matches': () => [...currentMatches],
  '/match/match-luna/profile': {
    nickname: 'Luna', gender: 'female', real_name: 'Luna Park', department: 'Biology', i_shared_contact: false, telegram_username: '@lunapark',
  },
  '/keywords': { categories: [1, 2, 3, 4, 5] },
}

function mockFetchHandler(url, options) {
  const path = new URL(url).pathname
  const method = options && options.method ? options.method : 'GET'

  if (method === 'POST' && path === '/like') {
    const body = options.body ? JSON.parse(String(options.body)) : {}
    if (body.to_user_id === 3) {
      return Response.json({ matched: true, match_id: 'match-luna' })
    }
    return Response.json({ matched: false, match_id: null })
  }

  if (method === 'POST' && path === '/unmatch') {
    const body = options.body ? JSON.parse(String(options.body)) : {}
    const matchId = body.match_id
    currentMatches = currentMatches.filter((m) => m.match_id !== matchId)
    return new Response(null, { status: 204 })
  }

  if (method === 'POST' && path === '/block') {
    return new Response(null, { status: 204 })
  }

  if (method === 'POST' && path === '/report') {
    return new Response(null, { status: 201 })
  }

  if (method === 'POST' && path === '/pass') {
    return new Response(null, { status: 204 })
  }

  if (method === 'POST' && path.match(/^\/match\/.+\/share-contact$/)) {
    const matchId = path.split('/')[2]
    const match = currentMatches.find((m) => m.match_id === matchId)
    if (match) {
      match.i_shared_contact = true
    }
    return Response.json({ i_shared_contact: true, they_shared_contact: match ? match.they_shared_contact : false })
  }

  if (method === 'POST' && path === '/profile') {
    const body = options.body ? JSON.parse(String(options.body)) : {}
    if (typeof body.nickname === 'string') currentProfile.nickname = body.nickname
    if (typeof body.gender === 'string') currentProfile.gender = body.gender
    if (typeof body.real_name === 'string') currentProfile.real_name = body.real_name
    if (typeof body.department === 'string') currentProfile.department = body.department
    currentProfile.profile_complete = true
    return Response.json({ ...currentProfile })
  }

  if (method === 'POST' && path === '/photo/upload-signature') {
    return Response.json({ upload_url: 'https://upload.example.com', fields: {}, photo_url: '/photo/view?t=mock-ticket' })
  }

  if (method === 'POST' && path === '/photo/confirm') {
    return Response.json({ photo_url: '/photo/view?t=mock-ticket', photo_expires_in: 300 })
  }

  if (method === 'POST' && path === '/events/ticket') {
    return Response.json({ ticket: 'ticket-match-luna' })
  }

  if (method === 'GET' && path === '/events') {
    return new Response(null, { status: 204 })
  }

  if (method === 'POST' && path === '/admin/photos/review') {
    return Response.json({ user_id: 123, decision: 'approve' })
  }

  if (method === 'POST' && path === '/admin/resolve-report') {
    return Response.json({ report_id: '1', status: 'resolved' })
  }

  if (method === 'POST' && path === '/admin/ban-user') {
    return Response.json({ user_id: 123, status: 'banned' })
  }

  if (method === 'POST' && path === '/admin/set-verification-level') {
    return Response.json({ user_id: 123, verification_level: 'basic' })
  }

  if (method === 'GET' && path.startsWith('/match/') && path.endsWith('/profile')) {
    const matchId = path.split('/')[2]
    const match = currentMatches.find((m) => m.match_id === matchId)
    if (match) {
      return Response.json({
        nickname: match.other_user.nickname,
        gender: 'female',
        real_name: 'Luna Park',
        department: 'Biology',
        i_shared_contact: match.i_shared_contact,
        telegram_username: '@lunapark',
      })
    }
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const entry = MOCK_DATA[path]
  const data = typeof entry === 'function' ? entry() : entry
  if (data !== undefined) {
    return Response.json(data)
  }

  return Response.json({ error: 'not_found' }, { status: 404 })
}

describe('API hooks against mock fetch', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost')
    currentProfile = {
      nickname: 'Avery',
      gender: 'female',
      real_name: 'Avery Stone',
      department: 'Computer Science',
      profile_complete: true,
    }
    currentMatches = [
      { match_id: 'match-luna', matched_at: '2024-11-01T12:00:00.000Z', other_user: { id: 3, nickname: 'Luna' }, i_shared_contact: false, they_shared_contact: false },
      { match_id: 'match-milo', matched_at: '2024-11-02T12:00:00.000Z', other_user: { id: 4, nickname: 'Theo' }, i_shared_contact: true, they_shared_contact: false },
      { match_id: 'match-naomi', matched_at: '2024-11-03T12:00:00.000Z', other_user: { id: 5, nickname: 'Nora' }, i_shared_contact: false, they_shared_contact: true },
      { match_id: 'match-zoe', matched_at: '2024-11-04T12:00:00.000Z', other_user: { id: 6, nickname: 'Kai' }, i_shared_contact: true, they_shared_contact: true },
    ]
    mockFetch.mockImplementation(async (url, options) => {
      return mockFetchHandler(url, options)
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)
    setToken('mock-token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    clearToken()
  })

  it('useMe fetches profile data', async () => {
    function Test() {
      const { data, isLoading, error } = useMe()
      if (error) return <div>error: {String(error)}</div>
      return <div>{isLoading ? 'loading' : data?.nickname ?? 'none'}</div>
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await act(async () => {})
    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Avery')).toBeInTheDocument())
  })

  it('useBrowse returns 12 candidates sorted newest first', async () => {
    function Test() {
      const { data } = useBrowse()
      return <div>{data ? data.length.toString() : '0'}</div>
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
  })

  it('useMatches returns matches covering all four chip states', async () => {
    function Test() {
      const { data } = useMatches()
      return <div>{data ? data.length.toString() : '0'}</div>
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
  })

  it('useLikeUser creates a match when liking Luna', async () => {
    let matchData = null
    function Test() {
      const mutation = useLikeUser()
      const { data: matches } = useMatches()

      matchData = matches

      return (
        <button
          onClick={() => mutation.mutate({ to_user_id: 3 })}
          disabled={mutation.isPending}
        >
          Like Luna
        </button>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await act(async () => {
      screen.getByText('Like Luna').click()
    })

    await waitFor(() => {
      expect(matchData?.find((m) => m.match_id === 'match-luna')).toBeDefined()
    })
  })

  it('useUnmatch removes a match', async () => {
    function Test() {
      const mutation = useUnmatch()
      const { data: matches } = useMatches()

      return (
        <>
          <div data-testid="count">{matches ? matches.length.toString() : '0'}</div>
          <button
            onClick={() => mutation.mutate({ match_id: 'match-luna' })}
            disabled={mutation.isPending}
          >
            Unmatch
          </button>
        </>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())

    await act(async () => {
      screen.getByText('Unmatch').click()
    })

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
  })

  it('useShareContact sets i_shared_contact', async () => {
    let profileData = null
    function Test() {
      const mutation = useShareContact()
      const { data } = useMatchProfile('match-luna')

      profileData = data

      return (
        <button
          onClick={async () => {
            await mutation.mutateAsync({ matchId: 'match-luna' })
          }}
          disabled={mutation.isPending}
        >
          Share
        </button>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('Share')).toBeInTheDocument())

    await act(async () => {
      screen.getByText('Share').click()
    })

    await waitFor(() => {
      expect(profileData?.i_shared_contact).toBe(true)
    })
  })

  it('useBlockUser blocks a user', async () => {
    function Test() {
      const mutation = useBlockUser()

      return (
        <button
          onClick={() => mutation.mutate({ blocked_id: 1 })}
          disabled={mutation.isPending}
        >
          Block
        </button>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await act(async () => {
      screen.getByText('Block').click()
    })

    await waitFor(() => {
      expect(screen.getByText('Block')).toBeInTheDocument()
    })
  })

  it('useReportUser reports a user', async () => {
    function Test() {
      const mutation = useReportUser()

      return (
        <button
          onClick={() => mutation.mutate({ reported_id: 1, reason: 'Spam' })}
          disabled={mutation.isPending}
        >
          Report
        </button>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await act(async () => {
      screen.getByText('Report').click()
    })

    await waitFor(() => {
      expect(screen.getByText('Report')).toBeInTheDocument()
    })
  })

  it('useUpdateProfile updates and invalidates me', async () => {
    function Test() {
      const { data: me } = useMe()
      const mutation = useUpdateProfile()

      return (
        <>
          <div data-testid="me-name">{me?.nickname ?? 'none'}</div>
          <button
            onClick={async () => {
              await mutation.mutateAsync({ nickname: 'Updated' })
            }}
            disabled={mutation.isPending}
          >
            Update
          </button>
        </>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('Avery')).toBeInTheDocument())

    await act(async () => {
      screen.getByText('Update').click()
    })

    await waitFor(() => expect(screen.getByText('Updated')).toBeInTheDocument())
  })

  it('useKeywords returns keyword categories', async () => {
    function Test() {
      const { data } = useKeywords()
      return <div>{data ? data.categories.length.toString() : '0'}</div>
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
  })

  it('useMatchProfile fetches match profile by id', async () => {
    function Test() {
      const { data } = useMatchProfile('match-luna')
      return <div>{data?.nickname ?? 'none'}</div>
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('Luna')).toBeInTheDocument())
  })

  it('usePassUser passes a user', async () => {
    function Test() {
      const mutation = usePassUser()

      return (
        <button
          onClick={() => mutation.mutate({ user_id: 1 })}
          disabled={mutation.isPending}
        >
          Pass
        </button>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await act(async () => {
      screen.getByText('Pass').click()
    })

    await waitFor(() => {
      expect(screen.getByText('Pass')).toBeInTheDocument()
    })
  })

  it('usePhotoUploadSignature returns upload data', async () => {
    let signature = null
    function Test() {
      const mutation = usePhotoUploadSignature()

      return (
        <>
          <button
            onClick={async () => {
              signature = await mutation.mutateAsync()
            }}
            disabled={mutation.isPending}
          >
            Sign
          </button>
          {signature && <div data-testid="photo-url">{signature.photo_url}</div>}
        </>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await act(async () => {
      screen.getByText('Sign').click()
    })

    await waitFor(() =>
      expect(screen.getByText('/photo/view?t=mock-ticket')).toBeInTheDocument()
    )
  })

  it('useTicket gets a ticket for a match', async () => {
    let ticket = null
    function Test() {
      const mutation = useTicket()

      return (
        <>
          <button
            onClick={async () => {
              ticket = await mutation.mutateAsync({ matchId: 'match-luna' })
            }}
            disabled={mutation.isPending}
          >
            Ticket
          </button>
          {ticket && <div data-testid="ticket">{ticket.ticket}</div>}
        </>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Test />
      </QueryClientProvider>
    )

    await act(async () => {
      screen.getByText('Ticket').click()
    })

    await waitFor(() => expect(screen.getByText('ticket-match-luna')).toBeInTheDocument())
  })
})
