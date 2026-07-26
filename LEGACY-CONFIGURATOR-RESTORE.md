# Legacy 3D Configurator Recovery

The customer-facing 3D configurator was preserved before the guided project
configurator replaced it on July 26, 2026.

## Recovery references

- Archive branch: `archive/legacy-3d-configurator`
- Last committed legacy tag: `legacy-3d-configurator-final-2026-07-26`
- Archive snapshot commit: `e648cc0885c7ba5de061b99cce8f79487f91a2ae`
- Last committed legacy baseline: `38097dc334c2ee2f125d3388523dcd41e9b11883`

The archive branch includes the complete working-tree snapshot that existed
immediately before replacement, including the in-progress responsive legacy
configurator work. The tag identifies the final committed legacy baseline.

## Restore the legacy configurator

To inspect or resume the preserved implementation without disturbing current
work:

```sh
git switch archive/legacy-3d-configurator
npm install
npm run build
npm test
npm run serve
```

To create a new recovery branch from the preserved snapshot:

```sh
git switch -c recovery/legacy-3d-configurator archive/legacy-3d-configurator
```

The guided public route deliberately does not import `configurator-3d.js`,
Three.js, cabinet AR, direct hardware editing, or the legacy configurator
styles. The legacy engine and its business-logic tests remain available in git
for engineering reference and future restoration.
