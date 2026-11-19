(() => {
  'use strict';
  const backend = window.devMatchBackend;
  if (!backend) return;
  const phoneInput = document.getElementById('settingsPhone');
  const sendButton = document.getElementById('sendPhoneCode');
  const verifyButton = document.getElementById('verifyPhoneCode');
  const codeField = document.getElementById('phoneCodeField');
  const codeInput = document.getElementById('phoneCode');
  const status = document.getElementById('phoneVerificationStatus');
  const continueLink = document.getElementById('continuePhoneSetup');
  let account;
  let phone;
  let pending = false;
  let requested = false;
  let available = false;
  let verified = false;
  let cooldownUntil = 0;

  function render() {
    sendButton.disabled = !available || verified || pending || Date.now() < cooldownUntil;
    sendButton.textContent = requested ? 'Resend SMS code' : 'Send SMS code';
    verifyButton.disabled = !available || verified || pending;
    codeField.hidden = !requested || verified;
  }

  async function getAccount() {
    const {data, error} = await backend.client.auth.getUser();
    if (error || data?.user?.id !== account?.id) throw new Error('Your session changed. Reload and log in again.');
    return data.user;
  }

  function showError(error) {
    if (continueLink) continueLink.hidden = false;
    if (error.code === 'phone_provider_disabled' || error.code === 'sms_send_failed') {
      status.textContent = 'SMS could not be delivered. Try again later.';
    } else if (error.status === 429) {
      status.textContent = 'Too many requests. Wait before trying again.';
    } else if (error.code === 'otp_expired') {
      status.textContent = 'The code is invalid or expired. Check it or request a new code.';
    } else if (error.code === 'phone_exists') {
      status.textContent = 'This number cannot be verified. Contact support if the number belongs to you.';
    } else {
      status.textContent = 'Phone verification could not be completed. Try again.';
    }
  }

  async function run(action) {
    if (!available || verified || pending) return;
    pending = true;
    render();
    try { await action(); }
    catch (error) { showError(error); }
    finally { pending = false; render(); }
  }

  sendButton.addEventListener('click', () => void run(async () => {
    if (Date.now() < cooldownUntil) return;
    await getAccount();
    const {error} = await backend.client.auth.updateUser({phone});
    if (error) throw error;
    requested = true;
    cooldownUntil = Date.now() + 60000;
    setTimeout(render, 60000);
    status.textContent = 'Code requested. Check your SMS and enter the six digits.';
    render();
    codeInput.value = '';
    codeInput.focus();
  }));

  verifyButton.addEventListener('click', () => void run(async () => {
    const token = codeInput.value.trim();
    if (!requested || !/^\d{6}$/.test(token)) {
      status.textContent = 'Enter the six-digit code from your SMS.';
      return;
    }
    await getAccount();
    const {error} = await backend.client.auth.verifyOtp({phone, token, type: 'phone_change'});
    if (error) throw error;
    const row = await backend.loadProfile(await getAccount());
    if (!row.phone_verified_at || row.verified_phone !== phone) throw new Error('Verification was not recorded.');
    verified = true;
    codeInput.value = '';
    status.textContent = 'Phone number verified in both modes.';
  }));
  codeInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    verifyButton.click();
  });

  async function initialize() {
    account = await backend.ready;
    if (!account?.email_confirmed_at) return;
    const row = await backend.loadProfile(account);
    if (continueLink) {
      if (row.onboarding_complete || (row.phone_verified_at && row.verified_phone === row.phone)) {
        location.replace(backend.destination(row, account));
        return;
      }
      continueLink.href = 'devmatch-profile.html?role=' + row.account_role;
    }
    phone = row.phone?.trim();
    phoneInput.value = phone || '';
    if (!/^\+[1-9]\d{7,14}$/.test(phone || '')) {
      if (continueLink) continueLink.hidden = false;
      status.textContent = 'A valid account phone number is required.';
      return;
    }
    verified = Boolean(row.phone_verified_at && row.verified_phone === phone);
    if (verified) {
      status.textContent = 'Phone number verified in both modes.';
      return;
    }
    const {supabaseUrl, supabaseKey} = backend.client;
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {headers: {apikey: supabaseKey}});
    if (!response.ok) throw new Error('Could not load phone verification settings.');
    const settings = await response.json();
    available = settings.external?.phone === true && settings.phone_autoconfirm === false;
    if (continueLink) continueLink.hidden = available;
    status.textContent = available ? 'Verify your account number with an SMS code.' : 'SMS verification is currently unavailable.';
    render();
  }

  void initialize().catch(() => {
    if (continueLink?.hasAttribute('href')) continueLink.hidden = false;
    status.textContent = 'Could not load SMS verification. Reload to try again.';
  });
})();
