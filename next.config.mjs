const isDev = process.env.NODE_ENV !== "production"

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://njkjunedpxvhkahocjuv.supabase.co wss://njkjunedpxvhkahocjuv.supabase.co${isDev ? " ws: wss:" : ""}`,,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!isDev ? ["upgrade-insecure-requests"] : []),
].join("; ")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const common = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ]
    if (!isDev) {
      common.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" })
    }
    return [{ source: "/:path*", headers: common }]
  },
}

export default nextConfig
