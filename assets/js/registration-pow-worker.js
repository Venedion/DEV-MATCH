self.onmessage = async event => {
  const {input, difficulty} = event.data;
  const encoder = new TextEncoder();
  let counter = 0;
  while (counter <= 0xffffffff) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`${input}.${counter}`)));
    if (digest[0] === 0 && (digest[1] >> (8 - (difficulty - 8))) === 0) {
      self.postMessage({counter});
      return;
    }
    counter += 1;
  }
  self.postMessage({error: 'Unable to complete registration verification.'});
};
