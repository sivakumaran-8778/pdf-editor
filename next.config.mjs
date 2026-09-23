/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ["@base-ui/react", "@pdf-lib/fontkit"],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        "node:fs": false,
        module: false,
        path: false,
        url: false,
        crypto: false,
      };

      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^(module|fs|path|url)$/,
        })
      );
    }
    return config;
  },
};

export default nextConfig;
