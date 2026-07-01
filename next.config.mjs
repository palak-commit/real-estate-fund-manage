/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure the SQL schema file is bundled into serverless functions, since
  // lib/db.ts reads it at runtime to auto-create the schema.
  outputFileTracingIncludes: {
    "/**": ["./scripts/schema.sql"],
  },
  webpack: (config) => {
    // jspdf lazily references html2canvas / canvg / dompurify for its doc.html() feature,
    // which we don't use (we only use jspdf-autotable + text). Stub them so webpack doesn't
    // try to bundle/emit those optional chunks (avoids "Cannot find module html2canvas").
    config.resolve.alias = {
      ...config.resolve.alias,
      html2canvas: false,
      canvg: false,
      dompurify: false,
    };
    return config;
  },
};

export default nextConfig;
