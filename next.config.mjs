import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // i18n routing is handled by next-intl middleware and localized app routes.
}

export default withNextIntl(nextConfig)
