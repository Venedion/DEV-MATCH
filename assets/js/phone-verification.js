(() => {
  'use strict';
  const backend = window.devMatchBackend;
  if (!backend) return;

  const field = document.getElementById('settingsPhone');
  const activePhone = document.getElementById('activeAccountPhone');
  const send = document.getElementById('startWhatsAppVerification');
  const confirm = document.getElementById('checkWhatsAppVerification');
  const code = document.getElementById('whatsappOtpCode');
  const panel = document.getElementById('whatsappOtpPanel');
  const destination = document.getElementById('whatsappOtpDestination');
  const status = document.getElementById('phoneVerificationStatus');
  const continueLink = document.getElementById('continuePhoneSetup');
  let user, profile, pending, timer, nextSend = 0, available = false, busy = false;
  const messages = {
    phone: 'Enter a valid WhatsApp number.',
    cooldown: 'Wait 60 seconds before requesting another code.',
    delivery: 'WhatsApp could not accept the message. Check the number and try again.',
    invalid: 'Incorrect code. Check the six digits and try again.',
    locked: 'Five incorrect attempts. Request a new code.',
    expired: 'This code is no longer valid. Request a new code.',
    quota: 'The free WhatsApp message quota has been used. Try again when it resets.',
    unavailable: 'WhatsApp verification is currently unavailable.'
  };

  function normalize(value) {
    const phone = value.trim().replace(/[\s()-]/g, '');
    if (/^08\d+$/.test(phone)) return '+62' + phone.slice(1);
    if (/^8\d+$/.test(phone)) return '+62' + phone;
    if (/^62\d+$/.test(phone)) return '+' + phone;
    return phone;
  }

  function render() {
    const seconds = Math.max(0, Math.ceil((nextSend - Date.now()) / 1000));
    send.disabled = !available || busy || seconds > 0;
    send.textContent = seconds ? 'Kirim ulang (' + seconds + 's)' : pending ? 'Kirim ulang' : 'Kirim kode via WhatsApp';
    confirm.disabled = busy;
    window.clearTimeout(timer);
    if (seconds) timer = window.setTimeout(render, 1000);
  }

  function showPhone() {
    const verified = Boolean(profile.phone_verified_at && profile.verified_phone === profile.phone);
    if (activePhone) {
      activePhone.textContent = (profile.phone || 'No account phone') + (verified ? ' · Terverifikasi' : ' · Unverified');
    }
    if (continueLink && (verified || profile.onboarding_complete)) {
      location.replace(backend.destination(profile, user));
    }
  }

  async function invoke(body) {
    const {data, error} = await backend.client.functions.invoke('whatsapp-otp', {body});
    if (!error) return data;
    const info = await error.context?.json?.().catch(() => null);
    throw new Error(info?.error || 'unavailable');
  }

  async function initialize() {
    user = await backend.ready;
    if (!user?.email_confirmed_at) return;
    profile = await backend.loadProfile(user);
    field.value = profile.phone || '';
    if (continueLink) {
      continueLink.href = 'devmatch-profile.html?role=' + profile.account_role;
      continueLink.hidden = false;
    }
    showPhone();
    const response = await fetch(backend.client.supabaseUrl + '/functions/v1/whatsapp-otp');
    if (!response.ok) throw new Error('unavailable');
    available = (await response.json()).available === true;
    status.textContent = available ? 'A six-digit code will be sent from DEV-MATCH (…7073).' : messages.unavailable;
    render();
  }

  send.addEventListener('click', async () => {
    if (!available || busy || Date.now() < nextSend) return;
    const phone = normalize(field.value);
    if (!/^\+[1-9]\d{8,14}$/.test(phone)) {
      status.textContent = messages.phone;
      return;
    }
    field.value = phone;
    busy = true;
    render();
    try {
      const {challenge} = await invoke({action: 'send', phone});
      pending = {challenge, phone};
      destination.textContent = 'WhatsApp code for ' + phone;
      nextSend = Date.now() + 60000;
      panel.hidden = false;
      code.value = '';
      code.focus();
      status.textContent = 'Code requested for ' + phone + '. Enter the six digits from WhatsApp within 5 minutes.';
    } catch (error) {
      if (error.message === 'cooldown') nextSend = Date.now() + 60000;
      status.textContent = (messages[error.message] || messages.unavailable)
        + (pending ? ' The verification form is for ' + pending.phone + '.' : '');
    } finally {
      busy = false;
      render();
    }
  });

  async function verify() {
    if (busy || !pending) return;
    const value = code.value.trim();
    if (!/^\d{6}$/.test(value)) {
      status.textContent = 'Enter the six-digit WhatsApp code.';
      return;
    }
    busy = true;
    render();
    try {
      await invoke({action: 'verify', ...pending, code: value});
      profile = {...profile, phone: pending.phone, verified_phone: pending.phone, phone_verified_at: true};
      field.value = profile.phone;
      panel.hidden = true;
      pending = null;
      code.value = '';
      status.textContent = 'Nomor WhatsApp terverifikasi.';
      showPhone();
    } catch (error) {
      status.textContent = messages[error.message] || messages.unavailable;
      if (error.message === 'locked' || error.message === 'expired') {
        panel.hidden = true;
        pending = null;
      }
    } finally {
      busy = false;
      render();
    }
  }

  confirm.addEventListener('click', verify);
  code.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void verify();
  });
  void initialize().catch(() => { status.textContent = messages.unavailable; });
})();
