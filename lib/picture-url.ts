const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export function isExternalPictureUrl(url?: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

export function getPictureApiUrl(ownerType: string, ownerId: number) {
  const params = new URLSearchParams({
    owner_type: ownerType,
    owner_id: String(ownerId),
  });
  return `${API_BASE}/pictures/?${params.toString()}`;
}
