export type FeatureEnvironment = 'development' | 'staging' | 'production'
export type FeatureFlagType = 'BOOLEAN' | 'MULTIVARIANT'

export type FeatureFlagEnvironment = {
  environment: FeatureEnvironment
  enabled: boolean
  rolloutPercentage: number | null
  forceEnabled: boolean | null
  forceDisabled: boolean | null
  userTargets?: Array<{ userId: string; include: boolean }>
}

export type FeatureFlag = {
  id: string
  key: string
  name: string
  description?: string | null
  tags: string[]
  type: FeatureFlagType
  environments: FeatureFlagEnvironment[]
}

export type CreateFlagPayload = {
  key: string
  name: string
  description?: string | null
  tags?: string[]
  type?: FeatureFlagType
  environments?: Array<
    Pick<
      FeatureFlagEnvironment,
      'environment' | 'enabled' | 'rolloutPercentage' | 'forceEnabled' | 'forceDisabled'
    >
  >
  userTargets?: Array<{
    environment: FeatureEnvironment
    userId: string
    include: boolean
  }>
}

export type UpdateFlagPayload = {
  name?: string
  description?: string | null
  tags?: string[]
  type?: FeatureFlagType
  environments?: Array<
    {
      environment: FeatureEnvironment
    } & Partial<
      Pick<
        FeatureFlagEnvironment,
        'enabled' | 'rolloutPercentage' | 'forceEnabled' | 'forceDisabled'
      >
    >
  >
  userTargets?: Array<{
    environment: FeatureEnvironment
    userId: string
    include: boolean
  }>
}

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '/api'

const withBase = (path: string) => `${API_BASE.replace(/\/$/, '')}${path}`

const defaultHeaders = {
  'Content-Type': 'application/json',
  'x-user-id': 'admin-panel',
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let details: unknown
    try {
      details = await res.json()
    } catch {
      /* noop */
    }
    const message =
      typeof details === 'object' && details && 'error' in details
        ? (details as { error?: { message?: string } }).error?.message ?? res.statusText
        : res.statusText
    throw new Error(message || 'Request failed')
  }

  if (res.status === 204) {
    // @ts-expect-error nothing to return
    return undefined
  }

  return res.json() as Promise<T>
}

export async function fetchFlags(): Promise<FeatureFlag[]> {
  const res = await fetch(withBase('/flags'), {
    headers: defaultHeaders,
  })
  const body = await handleResponse<{ data: FeatureFlag[] }>(res)
  return body.data ?? []
}

export async function fetchFlag(key: string): Promise<FeatureFlag> {
  const res = await fetch(withBase(`/flags/${encodeURIComponent(key)}`), {
    headers: defaultHeaders,
  })
  const body = await handleResponse<{ data: FeatureFlag }>(res)
  return body.data
}

export async function createFlag(payload: CreateFlagPayload): Promise<FeatureFlag> {
  const res = await fetch(withBase('/flags'), {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  })

  const body = await handleResponse<{ data: FeatureFlag }>(res)
  return body.data
}

export async function updateFlag(
  key: string,
  payload: UpdateFlagPayload,
): Promise<FeatureFlag> {
  const res = await fetch(withBase(`/flags/${encodeURIComponent(key)}`), {
    method: 'PATCH',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  })

  const body = await handleResponse<{ data: FeatureFlag }>(res)
  return body.data
}

export async function deleteFlag(key: string): Promise<void> {
  const res = await fetch(withBase(`/flags/${encodeURIComponent(key)}`), {
    method: 'DELETE',
    headers: defaultHeaders,
  })

  await handleResponse(res)
}
