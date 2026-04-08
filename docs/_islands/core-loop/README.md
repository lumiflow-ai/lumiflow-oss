# Core Loop Island

This React island is copied from the original marketing site in `~/frontend` and adapted for static GitHub Pages output.

The built assets are checked in at:

- `docs/assets/core-loop.js`
- `docs/assets/core-loop.css`

To rebuild:

```sh
NODE_PATH=frontend/node_modules \
  frontend/node_modules/.bin/esbuild docs/_islands/core-loop/index.tsx \
  --bundle \
  --format=esm \
  --jsx=automatic \
  --outdir=docs/assets \
  --entry-names=core-loop \
  --minify
```
