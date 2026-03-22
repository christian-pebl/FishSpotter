/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const remotePatterns = [];

if (supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  remotePatterns.push({
    protocol: "https",
    hostname,
  });
}

const nextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
