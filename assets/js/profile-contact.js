(function () {
  'use strict';

  const dialCodes = Object.freeze([
    Object.freeze({country: 'Indonesia', dialCode: '62', flag: '🇮🇩'}),
    Object.freeze({country: 'Malaysia', dialCode: '60', flag: '🇲🇾'}),
    Object.freeze({country: 'Singapore', dialCode: '65', flag: '🇸🇬'})
  ]);

  function normalizeDialCode(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return dialCodes.find(option => option.dialCode === digits)?.dialCode || '';
  }

  function dialCodeForCountry(country) {
    return dialCodes.find(option => option.country === country)?.dialCode || '62';
  }

  function normalizeLocalNumber(value, dialCode) {
    let digits = String(value ?? '').replace(/\D/g, '');
    const code = normalizeDialCode(dialCode);
    if (code && digits.startsWith(code)) digits = digits.slice(code.length);
    return digits.replace(/^0+/, '');
  }

  function splitWhatsappNumber(value, preferredDialCode, country) {
    const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');
    const preferred = normalizeDialCode(preferredDialCode);
    const detected = dialCodes.find(option => digits.startsWith(option.dialCode))?.dialCode;
    const dialCode = preferred && digits.startsWith(preferred)
      ? preferred
      : detected || preferred || dialCodeForCountry(country);
    const number = normalizeLocalNumber(digits.startsWith(dialCode) ? digits.slice(dialCode.length) : digits, dialCode);
    return {dialCode, number};
  }

  function combineWhatsappNumber(dialCode, number) {
    const code = normalizeDialCode(dialCode) || '62';
    const localNumber = normalizeLocalNumber(number, code);
    return localNumber ? `${code}${localNumber}` : '';
  }

  function normalizeInstagramUsername(value) {
    let username = String(value ?? '').trim();
    if (/^(?:https?:\/\/|www\.|(?:www\.)?instagram\.com\/)/i.test(username)) {
      try {
        const url = new URL(/^https?:\/\//i.test(username) ? username : `https://${username}`);
        if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return username;
        username = decodeURIComponent(url.pathname.split('/').filter(Boolean)[0] || '');
      } catch {
        return username;
      }
    }
    return username.replace(/^@/, '').replace(/\/+$/, '');
  }

  function isValidInstagramUsername(value) {
    return /^[A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?$/.test(value)
      && !value.includes('..');
  }

  function instagramUrl(value) {
    const username = normalizeInstagramUsername(value);
    return isValidInstagramUsername(username)
      ? `https://www.instagram.com/${encodeURIComponent(username)}/`
      : '';
  }

  window.DEVMATCH_PROFILE_CONTACT = Object.freeze({
    dialCodes,
    normalizeDialCode,
    dialCodeForCountry,
    normalizeLocalNumber,
    splitWhatsappNumber,
    combineWhatsappNumber,
    normalizeInstagramUsername,
    isValidInstagramUsername,
    instagramUrl
  });
})();
