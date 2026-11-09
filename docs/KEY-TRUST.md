# Public-key trust and rotation

Ed25519 signing proves that catalog bytes were produced by a holder of the matching private key. It does **not** make persona text trusted instructions. The trust boundary remains in the host and is described in `SECURITY.md` and `docs/PROTOCOL.md`.

## Trust anchor

`catalog/trusted-keys.json` is a convenience copy for this repository. For a remote deployment, consumers must obtain the public-key ring through an out-of-band channel that is independent of the MCP response, for example:

- a signed Git tag or release asset with a separately verified commit signature;
- a pinned, immutable URL on a distinct control plane;
- an organization-managed configuration repository;
- an operator-published key transparency log.

For Git tags, prefer SSH signing with a key registered in the GitHub account used to publish the repository. A verifier pins the signer identity separately in an `allowed_signers` file and runs:

```bash
git -c gpg.format=ssh \
  -c gpg.ssh.allowedSignersFile=/path/to/allowed_signers \
  tag -v v0.3.0
```

`scripts/sign-tag.mjs` prints the exact verification shape from a public key path and checks whether a tag already verifies; it deliberately does not create, delete, or force-update tags. Do not treat an unsigned tag as a trust anchor merely because the Git commit hash matches.

Do not bootstrap trust from `/v1/signature.json` alone. That endpoint is useful for auditing, but a compromised server could return both catalog bytes and a matching public key.

## Key file

The private key is never committed. Keep it in a secret manager or encrypted offline storage with access restricted to the signing operator. The repository ignores `*.pem` and `deploy/private-keys/`. Use `node src/sign-cli.js keygen <dir>` to generate a key pair.

Each public key entry has:

```text
keyId       stable lowercase identifier
status      active or retired
publicKey   PEM SPKI Ed25519 public key
retiredAt   optional ISO timestamp; signatures created at/after this time are rejected
```

## Planned rotation

1. Generate a new key pair offline and store the private key in the secret manager.
2. Publish the new public key out of band with `status: "active"` while the old key remains active.
3. Distribute the updated key ring to clients and wait for rollout confirmation.
4. Re-sign the canonical catalog with the new `keyId` and deploy catalog bytes, signature, and key ring together.
5. Verify from an external client that `/v1/catalog.raw.json` and the signature validate against the locally pinned key ring.
6. Mark the old key `retired` with a `retiredAt` timestamp after the new signature is live.
7. Keep the retired public key in the ring only as long as historical signatures must remain verifiable.

Run `node scripts/rotation-drill.mjs` to exercise overlap, pre-cutoff verification, and post-cutoff rejection with ephemeral test keys. It writes no private keys to disk and does not alter the repository catalog.

## Compromise or accidental exposure

1. Stop publishing signatures with the affected key immediately.
2. Add the replacement key as active through the out-of-band channel and publish a new signature.
3. Mark the affected key `retired` with a `retiredAt` at or before the suspected exposure time.
4. Invalidate caches that may hold the old catalog/signature pair.
5. Publish an incident note with the old `keyId`, new `keyId`, catalog digest, and deployment time. Do not publish private key material.
6. Ask hosts to refresh their pinned key rings; a server-side key ring change alone is not enough for clients that pin trust anchors.

## Verification responsibilities

| Party | Responsibility |
| --- | --- |
| Signing operator | Protect private keys, canonicalize catalog bytes, publish versioned signatures. |
| Deployment operator | Deploy catalog, signature, and key ring atomically; avoid mixed versions during rollout. |
| Host/consumer | Pin an out-of-band key ring, recompute the catalog digest, verify signature and key status, freeze the resolved persona. |
| Reviewer | Treat persona text as untrusted data; signing does not replace content review. |

The repository's `npm run verify` checks only the bundled files against the bundled key ring. A production consumer must supply its own trusted key ring through `DAILY_PERSONA_TRUSTED_KEYS` or equivalent host logic.
