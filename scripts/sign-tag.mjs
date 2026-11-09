import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2];
const keyPath = process.argv[3] ?? process.env.DAILY_PERSONA_GIT_SIGNING_KEY;
if (!tag || !keyPath) {
  console.error('usage: node scripts/sign-tag.mjs <tag> <ssh-public-key-path>');
  process.exit(2);
}
if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('tag must look like vX.Y.Z');

const publicKey = (await readFile(path.resolve(keyPath), 'utf8')).trim();
const parts = publicKey.split(/\s+/);
if (parts.length < 2 || !/^(ssh-ed25519|ecdsa-sha2-nistp256|ssh-rsa)$/.test(parts[0])) {
  throw new Error('public key must be an SSH public-key line');
}

const tagger = spawnSync('git', ['var', 'GIT_COMMITTER_IDENT'], { cwd: root, encoding: 'utf8' });
if (tagger.status !== 0) throw new Error(tagger.stderr.trim() || 'git committer identity is unavailable');
const email = tagger.stdout.match(/<([^>]+)>/)?.[1];
if (!email) throw new Error('git committer email is unavailable');

const verify = spawnSync('git', [
  '-c', 'gpg.format=ssh',
  '-c', `user.signingkey=${keyPath}`,
  '-c', `gpg.ssh.allowedSignersFile=${path.join(root, 'work', 'allowed-signers')}`,
  'tag', '-v', tag,
], { cwd: root, encoding: 'utf8' });

process.stdout.write(`${JSON.stringify({
  tag,
  publicKeyType: parts[0],
  expectedIdentity: email,
  verifyCommand: `git -c gpg.format=ssh -c user.signingkey=${keyPath} -c gpg.ssh.allowedSignersFile=<allowed-signers> tag -v ${tag}`,
  verifyAlreadyPassed: verify.status === 0,
  note: 'Use an SSH signing key registered with GitHub; publish the public key out of band as a release trust anchor. This script does not create or force-update tags.',
}, null, 2)}\n`);
