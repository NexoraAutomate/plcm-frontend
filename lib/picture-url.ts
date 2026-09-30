import { getApiBaseUrl } from "./api-base"

export function isExternalPictureUrl(url?: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url)
}

export function getPictureApiUrl(ownerType: string, ownerId: number) {
  const params = new URLSearchParams({
    owner_type: ownerType,
    owner_id: String(ownerId),
  })
  return `${getApiBaseUrl()}/pictures/?${params.toString()}`
}
