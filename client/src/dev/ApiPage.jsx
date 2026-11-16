import React from 'react'
import {
  useBrowse,
  useKeywords,
  useLikeUser,
  useMatches,
  useMe,
  useUpdateProfile,
} from '../api/queries'

function Section({ title, children }) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  )
}

export default function ApiPage() {
  const meQuery = useMe()
  const browseQuery = useBrowse()
  const matchesQuery = useMatches()
  const keywordsQuery = useKeywords()
  const profileMutation = useUpdateProfile()
  const likeMutation = useLikeUser()

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>API test page</h1>

      <Section title="/me">
        {meQuery.isLoading && <p>Loading...</p>}
        {meQuery.error && <pre>{JSON.stringify({ error: meQuery.error }, null, 2)}</pre>}
        {meQuery.data && <pre>{JSON.stringify(meQuery.data, null, 2)}</pre>}
      </Section>

      <Section title="/browse">
        {browseQuery.isLoading && <p>Loading...</p>}
        {browseQuery.error && <pre>{JSON.stringify({ error: browseQuery.error }, null, 2)}</pre>}
        {browseQuery.data && <pre>{JSON.stringify(browseQuery.data, null, 2)}</pre>}
      </Section>

      <Section title="/matches">
        {matchesQuery.isLoading && <p>Loading...</p>}
        {matchesQuery.error && <pre>{JSON.stringify({ error: matchesQuery.error }, null, 2)}</pre>}
        {matchesQuery.data && <pre>{JSON.stringify(matchesQuery.data, null, 2)}</pre>}
      </Section>

      <Section title="/keywords">
        {keywordsQuery.isLoading && <p>Loading...</p>}
        {keywordsQuery.error && <pre>{JSON.stringify({ error: keywordsQuery.error }, null, 2)}</pre>}
        {keywordsQuery.data && <pre>{JSON.stringify(keywordsQuery.data, null, 2)}</pre>}
      </Section>

      <Section title="Mutations">
        <button
          type="button"
          onClick={() => profileMutation.mutate({ nickname: 'Avery', gender: 'female', real_name: 'Avery Stone', department: 'Computer Science' })}
          style={{ marginRight: 8 }}
        >
          Save profile
        </button>
        <button
          type="button"
          onClick={() => likeMutation.mutate({ to_user_id: 3 })}
          style={{ marginRight: 8 }}
        >
          Like Luna
        </button>
        <div style={{ marginTop: 12 }}>
          {profileMutation.isPending && <p>Updating profile...</p>}
          {likeMutation.isPending && <p>Sending like...</p>}
          {profileMutation.isSuccess && <pre>{JSON.stringify(profileMutation.data, null, 2)}</pre>}
          {likeMutation.isSuccess && <pre>{JSON.stringify(likeMutation.data, null, 2)}</pre>}
        </div>
      </Section>
    </main>
  )
}
