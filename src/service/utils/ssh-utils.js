import sshpk from 'sshpk';

export function normalisePublicKey(raw) {
  // sshpk trims & ignores trailing comment
  const key = sshpk.parseKey(raw, 'ssh');
  return key.toString('ssh');
}

export function fingerprintSHA256(pubKey) {
  const key = sshpk.parseKey(pubKey, 'ssh');
  return key.fingerprint('sha256').toString();
}
