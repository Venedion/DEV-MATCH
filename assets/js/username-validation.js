(() => {
  const messages = Object.freeze({
    minimumLength: 'Username must be at least 3 characters.',
    maximumLength: 'Username cannot exceed 20 characters.',
    lowercase: 'Username can only contain lowercase letters.',
    spaces: 'Username cannot contain spaces.',
    characters: 'Username can only contain letters, numbers, periods (.), and underscores (_).',
    period: 'Username cannot start or end with a period.',
    consecutivePeriods: 'Username cannot contain consecutive periods.',
    cooldown: 'You can change your username again after 7 days.',
    taken: 'This username is already taken.'
  });

  function normalize(value) {
    return String(value ?? '').toLowerCase();
  }

  function validate(value) {
    const username = String(value ?? '');
    const length = Array.from(username).length;
    if (length < 3) return {valid: false, message: messages.minimumLength};
    if (length > 20) return {valid: false, message: messages.maximumLength};
    if (/[A-Z]/.test(username)) return {valid: false, message: messages.lowercase};
    if (/\s/.test(username)) return {valid: false, message: messages.spaces};
    if (!/^[a-z0-9._]+$/.test(username)) return {valid: false, message: messages.characters};
    if (username.startsWith('.') || username.endsWith('.')) return {valid: false, message: messages.period};
    if (username.includes('..')) return {valid: false, message: messages.consecutivePeriods};
    return {valid: true, message: ''};
  }

  async function isAvailable(value) {
    const username = normalize(value);
    const {data, error} = await window.devMatchBackend.checkUsernameAvailability(username);
    if (error) throw error;
    if (typeof data !== 'boolean') {
      throw new Error('Supabase returned an invalid username availability result.');
    }
    return data;
  }

  window.DEVMATCH_USERNAME = Object.freeze({
    messages,
    normalize,
    validate,
    isAvailable,
    cooldownMs: 7 * 24 * 60 * 60 * 1000
  });
})();
