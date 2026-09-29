# Vendored MAHIM library

MAHIM is a versioned binary container format for portable application data.
Svelp consumes MAHIM as an external format dependency through this vendored
copy of the official build output of the MAHIM TypeScript reference
implementation. This directory is a build artifact, not a fork: no MAHIM
source, specification, or behavior is maintained inside Svelp.

- Upstream repository: https://github.com/mahimmazidul/mahim
- Integrated version: 1.0.0
- Pinned upstream commit: a66fffaab0ded384a58b13b3a3fc4c3aeac7ea65
- Upstream test status at pin time: 116 tests passed, 0 failed
- Contents: the complete `dist/` output of `npm run build` at the pinned
  commit, plus the upstream MIT license
- The `cli/` and `node/` subdirectories are unused by Svelp and kept only so
  this directory remains the unmodified, complete official artifact

To upgrade or regenerate:

1. `git clone https://github.com/mahimmazidul/mahim.git`
2. `git checkout <pinned commit>`
3. `npm ci && npm test`
4. Replace the contents of this directory with the new `dist/` contents and
   the upstream `LICENSE`
5. Update the version, commit, and test status recorded here, then run the
   full Svelp portability test suite
