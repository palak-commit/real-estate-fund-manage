/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure the SQL schema file is bundled into serverless functions, since
  // lib/db.ts reads it at runtime to auto-create the schema.
  outputFileTracingIncludes: {
    "/**": ["./scripts/schema.sql"],
  },
};

export default nextConfig;
