(() => {
  'use strict';
  const backend = window.devMatchBackend;
  if (!backend) return;

  const phoneInput = document.getElementById('settingsPhone');
  const startButton = document.getElementById('startWhatsAppVerification');
  const openWhatsApp = document.getElementById('openWhatsAppVerification');
  const checkButton = document.getElementById('checkWhatsAppVerification');
  const status = document.getElementById('phoneVerificationStatus');
  const continueLink = document.getElementById('continuePhoneSetup');
  let account, profile, destinationNumber, expiresAt, busy = false;

  async function isVerified() {
    if (profile.phone_verified_at && profile.verified_phone === profile.phone) return true;
    const {data, error} = await backend.client.rpc('is_whatsapp_phone_verified');
    if (error) throw error;
    return data === true;
  }

  function showVerified() {
    startButton.disabled = true;
    openWhatsApp.hidden = true;
    openWhatsApp.removeAttribute('href');
    checkButton.hidden = true;
    status.textContent = 'Phone number verified in both modes.';
    if (continueLink) {
      location.replace(backend.destination({...profile, phone_verified_at: true, verified_phone: profile.phone}, account));
    }
  }

  async function initialize() {
    account = await backend.ready;
    if (!account?.email_confirmed_at) return;
    profile = await backend.loadProfile(account);
    phoneInput.value = profile.phone || '';
    if (continueLink) {
      if (profile.onboarding_complete) return location.replace(backend.destination(profile, account));
      continueLink.href = 'devmatch-profile.html?role=' + profile.account_role;
      continueLink.hidden = false;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(profile.phone || '')) {
      status.textContent = 'A valid account phone number is required.';
      return;
    }
    if (await isVerified()) return showVerified();
    const endpoint = backend.client.supabaseUrl + '/functions/v1/whatsapp-verification?availability=1';
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Availability check failed');
    const {available, number} = await response.json();
    if (!available || !/^[1-9]\d{7,14}$/.test(number || '')) {
      status.textContent = 'WhatsApp verification is currently unavailable.';
      return;
    }
    destinationNumber = number;
    startButton.disabled = false;
    status.textContent = 'Send the verification message from the WhatsApp number shown above.';
  }

  startButton.addEventListener('click', async () => {
    if (busy || !destinationNumber) return;
    busy = true;
    startButton.disabled = true;
    try {
      const {data:code, error} = await backend.client.rpc('start_whatsapp_phone_verification');
      if (error) throw error;
      openWhatsApp.href = 'https://wa.me/' + destinationNumber
        + '?text=' + encodeURIComponent('DEV-MATCH VERIFY ' + code);
      openWhatsApp.hidden = false;
      checkButton.hidden = false;
      expiresAt = Date.now() + 600000;
      status.textContent = 'Open WhatsApp and send the prepared message. Then return and check verification.';
    } catch (error) {
      status.textContent = error.code === '22023' ? 'Wait one minute before requesting another message.' : 'Could not prepare verification. Try again.';
    } finally {
      busy = false;
      startButton.disabled = false;
    }
  });

  checkButton.addEventListener('click', async () => {
    if (busy || !profile) return;
    busy = true;
    checkButton.disabled = true;
    try {
      if (await isVerified()) showVerified();
      else status.textContent = Date.now() >= expiresAt
        ? 'This code expired. Prepare a new message.'
        : 'No matching message yet. Send it from your account number and check again.';
    } catch {
      status.textContent = 'Could not check verification. Try again.';
    } finally {
      busy = false;
      checkButton.disabled = false;
    }
  });

  void initialize().catch(() => {
    status.textContent = 'Could not load WhatsApp verification. Reload to try again.';
  });
})();
