function hasLeadingZeroBits(digest, difficulty) {
  const wholeBytes = Math.floor(difficulty / 8);
  for (let index = 0; index < wholeBytes; index += 1) {
    if (digest[index] !== 0) return false;
  }
  const remainingBits = difficulty % 8;
  return remainingBits === 0 || (digest[wholeBytes] >> (8 - remainingBits)) === 0;
}

self.onmessage = async event => {
  const {input, difficulty} = event.data;
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 32) {
    self.postMessage({error: 'Unable to complete registration verification.'});
    return;
  }
  const encoder = new TextEncoder();
  let counter = 0;
  while (counter <= 0xffffffff) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`${input}.${counter}`)));
    if (hasLeadingZeroBits(digest, difficulty)) {
      self.postMessage({counter});
      return;
    }
    counter += 1;
  }
  self.postMessage({error: 'Unable to complete registration verification.'});
};
