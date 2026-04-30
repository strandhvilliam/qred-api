import type { AppEnv } from "../env"

/** Shared secret encoding and optional issuer/audience for HS256 JWT sign/verify with `jose`. */
export function jwtSecretAndClaimsFromEnv(e: AppEnv) {
  const secret = e.JWT_SECRET?.trim()
  if (!secret) {
    throw new Error("JWT_SECRET is required")
  }

  const issuer = e.JWT_ISSUER?.trim() || undefined
  const audRaw = e.JWT_AUDIENCE
  let audience: string | string[] | undefined
  if (audRaw?.trim()) {
    const parts = audRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 1) audience = parts[0]
    else if (parts.length > 1) audience = parts
  }

  return {
    secretKey: new TextEncoder().encode(secret),
    issuer,
    audience,
  }
}
