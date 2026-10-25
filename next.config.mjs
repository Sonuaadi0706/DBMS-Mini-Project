/** @type {import('next').NextConfig} */
// Next.js hands middleware only the first 10 MB of a request body. Uploads (file + form fields) must fit
// completely, so allow the configured max file size plus headroom; anything bigger is refused with a clear
// message by the upload code instead of arriving truncated.
const bodyLimitMb = Number(process.env.STORAGE_MAX_FILE_MB ?? 10) + 2;

const nextConfig = {
  experimental: { middlewareClientMaxBodySize: `${bodyLimitMb}mb` },
  // Native / server-only packages must not be bundled into route handlers.
  serverExternalPackages: ['pg', 'bcryptjs', 'mongodb', '@huggingface/transformers', 'onnxruntime-node'],
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
  ],
};
export default nextConfig;
