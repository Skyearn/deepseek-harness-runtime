#!/usr/bin/env node
// Prints the @deepseek-ai/dsh version that the prebuilt runtime should mirror.
//
// Upstream publishes prereleases under the `next` dist-tag (`alpha` for the
// earlier line) and only moves `latest` when a version graduates, so
// `npm view @deepseek-ai/dsh version` — which reads `latest` — lags behind
// every release candidate. Take the highest of `next` and `latest` so an rc is
// mirrored as soon as it is published, while a graduated stable release still
// wins. `alpha` is intentionally ignored so alpha builds are never published
// to every shell.
//
// Zero-dependency: this runs on the checked-out runner before `npm ci`.

import https from 'node:https'

const PACKAGE = '@deepseek-ai/dsh'
const REGISTRY = 'https://registry.npmjs.org'
const TAGS = ['next', 'latest']

function request(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'deepseek-harness-runtime' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume()
        resolve(request(new URL(res.headers.location, url), redirects + 1))
        return
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
  })
}

// Parses `0.1.5-rc.2` into its numeric release segments and prerelease
// identifiers.
function parseVersion(value) {
  const [release, prerelease = ''] = String(value).split('-')
  return {
    release: release.split('.').map(part => Number.parseInt(part, 10) || 0),
    prerelease: prerelease ? prerelease.split('.') : [],
  }
}

// Compares two versions the way semver does. A release outranks any of its own
// prereleases (0.1.5 > 0.1.5-rc.2), prerelease identifiers compare segment by
// segment with numeric identifiers ordered numerically (rc.2 < rc.10), and a
// shorter identifier list sorts first (alpha < alpha.1). Returns -1, 0 or 1.
function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  const releaseCount = Math.max(left.release.length, right.release.length)
  for (let i = 0; i < releaseCount; i++) {
    const x = left.release[i] || 0
    const y = right.release[i] || 0
    if (x !== y) return x < y ? -1 : 1
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0
    return left.prerelease.length === 0 ? 1 : -1
  }
  const prereleaseCount = Math.max(left.prerelease.length, right.prerelease.length)
  for (let i = 0; i < prereleaseCount; i++) {
    const x = left.prerelease[i]
    const y = right.prerelease[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xNumeric = /^\d+$/.test(x)
    const yNumeric = /^\d+$/.test(y)
    if (xNumeric && yNumeric) return Number(x) < Number(y) ? -1 : 1
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}

async function main() {
  const tags = JSON.parse(await request(`${REGISTRY}/-/package/${PACKAGE}/dist-tags`))
  const candidates = TAGS.filter(tag => typeof tags[tag] === 'string' && tags[tag])
  if (candidates.length === 0) throw new Error(`no dist-tags published for ${PACKAGE}`)
  const version = candidates.reduce(
    (best, tag) => (best === '' || compareVersions(tags[tag], best) > 0 ? tags[tag] : best),
    '',
  )
  process.stdout.write(`${version}\n`)
}

main().catch(error => {
  process.stderr.write(`ERROR: ${error.message}\n`)
  process.exit(1)
})
