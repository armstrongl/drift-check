# Developing Drift-Check

---

Feel free to contribute if you have suggestions or find bugs!

## Building for publish

```bash
pnpm --filter @ordomesh/drift-check build
```

Produces a single bundled `dist/index.js` (CJS, Node 18+, shebang included). Only the `dist/` folder is shipped to npm.

To auto-build before publish, add to `package.json`:

```json
"prepublishOnly": "pnpm build"
```

---
