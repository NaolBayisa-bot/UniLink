import { http, HttpResponse } from 'msw'

let mockScenario = 'normal'
let profile = {
  nickname: 'Avery',
  gender: 'female',
  real_name: 'Avery Stone',
  department: 'Computer Science',
  profile_complete: true,
}

const pendingPhotos = []
const adminUsers = new Map()

const browseCandidates = [
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
]

const matchState = new Map()
matchState.set('match-luna', {
  match_id: 'match-luna',
  matched_at: '2024-11-01T12:00:00.000Z',
  other_user: { id: 3, nickname: 'Luna' },
  i_shared_contact: false,
  they_shared_contact: false,
})
matchState.set('match-milo', {
  match_id: 'match-milo',
  matched_at: '2024-11-02T12:00:00.000Z',
  other_user: { id: 4, nickname: 'Theo' },
  i_shared_contact: true,
  they_shared_contact: false,
})
matchState.set('match-naomi', {
  match_id: 'match-naomi',
  matched_at: '2024-11-03T12:00:00.000Z',
  other_user: { id: 5, nickname: 'Nora' },
  i_shared_contact: false,
  they_shared_contact: true,
})
matchState.set('match-zoe', {
  match_id: 'match-zoe',
  matched_at: '2024-11-04T12:00:00.000Z',
  other_user: { id: 6, nickname: 'Kai' },
  i_shared_contact: true,
  they_shared_contact: true,
})

const keywordLibrary = [
  'Design', 'Music', 'Gaming', 'Reading', 'Hiking', 'Coffee', 'Travel', 'Photography', 'Art', 'Coding',
  'Cooking', 'Dancing', 'Cycling', 'Tech', 'Movies', 'Running', 'Volunteering', 'Science', 'Anime', 'Writing',
  'Board games', 'Basketball', 'Football', 'Yoga', 'Language exchange', 'Fitness', 'Museums', 'Comedy', 'Dogs',
  'Cats', 'Campus events', 'Study groups', 'Innovation', 'Startups', 'Books', 'Poetry', 'Marine biology', 'Math',
  'Astronomy', 'Skiing', 'Surfing', 'Camping', 'Calligraphy', 'Gardening', 'Podcasts', 'Korean drama', 'Cinema',
  'History', 'Theater', 'Bouldering', 'Sustainability', 'Chess', 'Sketching', 'Data science', 'Robotics', 'Brunch',
  'Night markets', 'Festivals', 'Museum hopping', 'Swimming', 'Day trips', 'Volunteer work', 'Markets', 'Makerspaces',
  'Public speaking', 'Tennis', 'Guitar', 'Piano', 'Birdwatching', 'Journalism', 'Psychology', 'Climbing', 'Architecture',
  'Philosophy', 'Community building', 'Singing', 'Hiking trails', 'Fashion', 'Wellness', 'Nature walks', 'Coffee shops',
  'Late-night study', 'Documentaries',
]

const keywordCategories = [
  { category: 'Creative', keywords: keywordLibrary.slice(0, 10).map((name, index) => ({ id: index + 1, name })) },
  { category: 'Outdoors', keywords: keywordLibrary.slice(10, 20).map((name, index) => ({ id: index + 11, name })) },
  { category: 'Culture', keywords: keywordLibrary.slice(20, 30).map((name, index) => ({ id: index + 21, name })) },
  { category: 'Academic', keywords: keywordLibrary.slice(30, 40).map((name, index) => ({ id: index + 31, name })) },
  { category: 'Tech', keywords: keywordLibrary.slice(40, 50).map((name, index) => ({ id: index + 41, name })) },
  { category: 'Lifestyle', keywords: keywordLibrary.slice(50, 60).map((name, index) => ({ id: index + 51, name })) },
  { category: 'Food', keywords: keywordLibrary.slice(60, 70).map((name, index) => ({ id: index + 61, name })) },
  { category: 'Wellbeing', keywords: keywordLibrary.slice(70, 80).map((name, index) => ({ id: index + 71, name })) },
]

const reports = []

export function getMockScenario() {
  return mockScenario
}

export function setMockScenario(nextScenario) {
  mockScenario = nextScenario
}

function handleOfflineFailure() {
  if (mockScenario === 'offline') {
    throw new Error('offline')
  }
}

function validateProfileUpdate(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, json: { error: 'validation_error' } }
  }

  const candidate = body

  if ('nickname' in candidate) {
    const nickname = String(candidate.nickname ?? '')
    if (nickname.length < 2 || nickname.length > 30) {
      return { ok: false, status: 400, json: { error: 'invalid_nickname_length' } }
    }
  }

  if ('real_name' in candidate) {
    const realName = String(candidate.real_name ?? '')
    if (realName.length < 1 || realName.length > 100) {
      return { ok: false, status: 400, json: { error: 'invalid_real_name' } }
    }
  }

  if ('department' in candidate) {
    const department = String(candidate.department ?? '')
    if (department.length < 1 || department.length > 100) {
      return { ok: false, status: 400, json: { error: 'invalid_department' } }
    }
  }

  if ('gender' in candidate) {
    const gender = candidate.gender
    if (gender !== 'male' && gender !== 'female') {
      return { ok: false, status: 400, json: { error: 'invalid_gender' } }
    }
  }

  return { ok: true }
}

export const handlers = [
  http.post('http://localhost/auth/telegram', async ({ request }) => {
    handleOfflineFailure()

    if (mockScenario === 'disabled') {
      return HttpResponse.json({ error: 'account_disabled' }, { status: 403 })
    }

    const body = await request.json()
    if (body.init_data === 'invalid') {
      return HttpResponse.json({ error: 'invalid_init_data' }, { status: 401 })
    }

    return HttpResponse.json({
      token: 'mock-token',
      user: {
        id: 42,
        nickname: 'Avery',
        gender: 'female',
        profile_complete: true,
      },
    })
  }),

  http.get('http://localhost/me', () => {
    handleOfflineFailure()

    if (mockScenario === 'expired') {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (mockScenario === 'disabled') {
      return HttpResponse.json({ error: 'account_disabled' }, { status: 403 })
    }

    return HttpResponse.json({
      nickname: profile.nickname,
      gender: profile.gender,
      real_name: profile.real_name,
      department: profile.department,
      profile_complete: profile.profile_complete,
    })
  }),

  http.post('http://localhost/profile', async ({ request }) => {
    handleOfflineFailure()

    const body = await request.json()
    const validation = validateProfileUpdate(body)
    if (!validation.ok) {
      return HttpResponse.json(validation.json, { status: validation.status })
    }

    if (typeof body.nickname === 'string') {
      profile = { ...profile, nickname: body.nickname }
    }

    if (typeof body.real_name === 'string') {
      profile = { ...profile, real_name: body.real_name }
    }

    if (typeof body.department === 'string') {
      profile = { ...profile, department: body.department }
    }

    if (typeof body.gender === 'string' && body.gender) {
      profile = { ...profile, gender: body.gender }
    }

    profile.profile_complete = true

    return HttpResponse.json({
      nickname: profile.nickname,
      gender: profile.gender,
      real_name: profile.real_name,
      department: profile.department,
      profile_complete: profile.profile_complete,
    })
  }),

  http.get('http://localhost/browse', () => {
    handleOfflineFailure()

    if (mockScenario === 'empty') {
      return HttpResponse.json([])
    }

    return HttpResponse.json(
      browseCandidates.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    )
  }),

  http.post('http://localhost/like', async ({ request }) => {
    handleOfflineFailure()

    const body = await request.json()
    const toUserId = Number(body.to_user_id)
    const match = browseCandidates.find((person) => person.id === toUserId)

    if (!match) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (match.nickname === 'Luna') {
      const existing = matchState.get('match-luna') ?? {
        match_id: 'match-luna',
        matched_at: new Date().toISOString(),
        other_user: { id: 3, nickname: 'Luna' },
        i_shared_contact: false,
        they_shared_contact: false,
      }
      matchState.set('match-luna', existing)
      return HttpResponse.json({ matched: true, match_id: 'match-luna' })
    }

    return HttpResponse.json({ matched: false, match_id: null })
  }),

  http.get('http://localhost/matches', () => {
    handleOfflineFailure()
    return HttpResponse.json(Array.from(matchState.values()))
  }),

  http.get('http://localhost/match/:matchId/profile', ({ params }) => {
    handleOfflineFailure()
    const matchId = String(params.matchId)
    const match = matchState.get(matchId)
    if (!match) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const matchProfiles = {
      'match-luna': {
        nickname: 'Luna',
        gender: 'female',
        real_name: 'Luna Park',
        department: 'Biology',
        i_shared_contact: false,
        telegram_username: '@lunapark',
      },
      'match-milo': {
        nickname: 'Theo',
        gender: 'male',
        real_name: 'Theo Mendez',
        department: 'Engineering',
        i_shared_contact: true,
        has_shared_contact: false,
      },
      'match-naomi': {
        nickname: 'Nora',
        gender: 'female',
        real_name: 'Nora Kim',
        department: 'Design',
        i_shared_contact: false,
        contact_unavailable: true,
      },
      'match-zoe': {
        nickname: 'Kai',
        gender: 'male',
        real_name: 'Kai Li',
        department: 'Psychology',
        i_shared_contact: true,
        telegram_username: '@kaili',
      },
    }

    return HttpResponse.json(matchProfiles[matchId])
  }),

  http.post('http://localhost/match/:matchId/share-contact', ({ params }) => {
    handleOfflineFailure()
    const matchId = String(params.matchId)
    const match = matchState.get(matchId)

    if (!match) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    match.i_shared_contact = true
    return HttpResponse.json({
      i_shared_contact: true,
      they_shared_contact: match.they_shared_contact,
    })
  }),

  http.post('http://localhost/unmatch', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const matchId = body.match_id

    if (!matchId || !matchState.has(matchId)) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    matchState.delete(matchId)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('http://localhost/block', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const blockedId = Number(body.blocked_id)

    if (!Number.isFinite(blockedId)) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return new HttpResponse(null, { status: 204 })
  }),

  http.post('http://localhost/report', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const reportedId = Number(body.reported_id)
    const reason = String(body.reason ?? '')

    if (!Number.isFinite(reportedId) || reason.length < 1 || reason.length > 1000) {
      return HttpResponse.json({ error: 'validation_error' }, { status: 400 })
    }

    reports.push({
      id: reports.length + 1,
      reported_id: reportedId,
      reason,
      status: 'open',
      created_at: new Date().toISOString(),
    })

    return new HttpResponse(null, { status: 201 })
  }),

  http.get('http://localhost/keywords', () => {
    handleOfflineFailure()
    return HttpResponse.json({ categories: keywordCategories })
  }),

  http.post('http://localhost/profile/keywords', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const keywordIds = body.keyword_ids ?? []

    if (keywordIds.length < 5 || keywordIds.length > 10) {
      return HttpResponse.json({ error: 'keyword_count_out_of_range' }, { status: 400 })
    }

    if (new Set(keywordIds).size !== keywordIds.length) {
      return HttpResponse.json({ error: 'duplicate_keyword_ids' }, { status: 400 })
    }

    const validIds = keywordIds.every((id) => id >= 1 && id <= 80)
    if (!validIds) {
      return HttpResponse.json({ error: 'unknown_keyword_id' }, { status: 400 })
    }

    return HttpResponse.json({ keyword_ids: keywordIds })
  }),

  http.post('http://localhost/pass', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const userId = Number(body.user_id)

    if (!Number.isFinite(userId)) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return new HttpResponse(null, { status: 204 })
  }),

  // Photo upload
  http.post('http://localhost/photo/upload-signature', () => {
    handleOfflineFailure()
    return HttpResponse.json({
      upload_url: 'https://upload.example.com',
      fields: {},
      photo_url: '/photo/view?t=mock-ticket',
    })
  }),

  http.post('http://localhost/photo/confirm', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const ticket = body.ticket

    if (!ticket) {
      return HttpResponse.json({ error: 'invalid_ticket' }, { status: 400 })
    }

    return HttpResponse.json({
      photo_url: '/photo/view?t=' + ticket,
      photo_expires_in: 300,
    })
  }),

  // Events
  http.post('http://localhost/events/ticket', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const matchId = body.match_id

    if (!matchId) {
      return HttpResponse.json({ error: 'invalid_match_id' }, { status: 400 })
    }

    return HttpResponse.json({ ticket: 'ticket-' + matchId })
  }),

  http.get('http://localhost/events', () => {
    handleOfflineFailure()
    return new HttpResponse(null, { status: 204 })
  }),

  // Admin
  http.get('http://localhost/admin/photos/pending', () => {
    handleOfflineFailure()
    return HttpResponse.json(pendingPhotos)
  }),

  http.post('http://localhost/admin/photos/review', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const userId = Number(body.user_id)
    const decision = body.decision

    if (!userId || !decision) {
      return HttpResponse.json({ error: 'not_pending' }, { status: 409 })
    }

    return HttpResponse.json({ user_id: userId, decision })
  }),

  http.get('http://localhost/admin/reports', ({ url }) => {
    handleOfflineFailure()
    const status = url.searchParams.get('status')
    let filtered = reports

    if (status) {
      filtered = reports.filter((r) => r.status === status)
    }

    return HttpResponse.json(filtered)
  }),

  http.post('http://localhost/admin/resolve-report', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const reportId = body.report_id

    const report = reports.find((r) => r.id === Number(reportId))
    if (!report) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    report.status = 'resolved'
    return HttpResponse.json({ report_id: reportId, status: 'resolved' })
  }),

  http.post('http://localhost/admin/ban-user', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const userId = Number(body.user_id)

    if (!Number.isFinite(userId)) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return HttpResponse.json({ user_id: userId, status: 'banned' })
  }),

  http.get('http://localhost/admin/users/:userId', ({ params }) => {
    handleOfflineFailure()
    const userId = Number(params.userId)
    const user = adminUsers.get(userId)

    if (!user) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return HttpResponse.json(user)
  }),

  http.post('http://localhost/admin/set-verification-level', async ({ request }) => {
    handleOfflineFailure()
    const body = await request.json()
    const userId = Number(body.user_id)
    const level = body.verification_level

    if (!userId || !level) {
      return HttpResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    return HttpResponse.json({ user_id: userId, verification_level: level })
  }),

  http.get('http://localhost/admin/users', ({ url }) => {
    handleOfflineFailure()
    const signupIp = url.searchParams.get('signup_ip')
    let filtered = Array.from(adminUsers.values())

    if (signupIp) {
      filtered = filtered.filter((u) => u.signup_ip === signupIp)
    }

    return HttpResponse.json(filtered)
  }),
]

export { reports }
