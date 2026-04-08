# Banner Animation Island

This source is a small React island copied from the original marketing site in `~/frontend`.

The built bundle is checked in at `docs/assets/banner-animation.js` so GitHub Pages can still publish the site directly from `/docs` without a build step.

To rebuild the bundle after editing this island:

```sh
NODE_PATH=/tmp/lumiflow-banner-node/node_modules:frontend/node_modules \
  frontend/node_modules/.bin/esbuild docs/_islands/banner/index.tsx \
  --bundle \
  --format=esm \
  --jsx=automatic \
  --outfile=docs/assets/banner-animation.js \
  --minify
```

The temporary dependency cache needs:

```sh
npm install --prefix /tmp/lumiflow-banner-node framer-motion motion
```
