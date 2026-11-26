const {writeFileSync} = require('node:fs');
const {resolve} = require('node:path');

const environment = process.env.DEVMATCH_MIDTRANS_ENVIRONMENT || 'sandbox';
if (!['sandbox', 'production'].includes(environment)) {
  throw new Error('DEVMATCH_MIDTRANS_ENVIRONMENT must be sandbox or production.');
}

const snapHost = environment === 'sandbox'
  ? 'https://app.sandbox.midtrans.com'
  : 'https://app.midtrans.com';
const configuredSnapUrl = process.env.DEVMATCH_MIDTRANS_SNAP_JS_URL;
const snapJsUrl = configuredSnapUrl || `${snapHost}/snap/snap.js`;
let parsedSnapUrl;
try {
  parsedSnapUrl = new URL(snapJsUrl);
} catch {
  throw new Error('DEVMATCH_MIDTRANS_SNAP_JS_URL must be a valid HTTPS URL.');
}
if (parsedSnapUrl.protocol !== 'https:' ||
    !['app.sandbox.midtrans.com', 'app.midtrans.com'].includes(parsedSnapUrl.hostname) ||
    parsedSnapUrl.pathname !== '/snap/snap.js') {
  throw new Error('DEVMATCH_MIDTRANS_SNAP_JS_URL must use an approved Midtrans Snap host.');
}
if (parsedSnapUrl.hostname !== new URL(snapHost).hostname) {
  throw new Error('The Snap JavaScript host must match DEVMATCH_MIDTRANS_ENVIRONMENT.');
}

const clientKey = process.env.DEVMATCH_MIDTRANS_CLIENT_KEY || '';
const expectedClientPrefix = environment === 'sandbox' ? 'SB-Mid-client-' : 'Mid-client-';
if (clientKey && !clientKey.startsWith(expectedClientPrefix)) {
  throw new Error('DEVMATCH_MIDTRANS_CLIENT_KEY does not match the selected environment.');
}

const supabaseUrlValue = process.env.DEVMATCH_SUPABASE_URL || '';
const supabaseAnonKey = process.env.DEVMATCH_SUPABASE_ANON_KEY || '';
if (Boolean(supabaseUrlValue) !== Boolean(supabaseAnonKey)) {
  throw new Error('Set both DEVMATCH_SUPABASE_URL and DEVMATCH_SUPABASE_ANON_KEY, or neither.');
}

const config = {
  ...(supabaseUrlValue ? {supabaseUrl: supabaseUrlValue} : {}),
  ...(supabaseAnonKey ? {supabaseAnonKey} : {}),
  ...(clientKey ? {midtransClientKey: clientKey} : {}),
  midtransPaymentsEnabled: Boolean(supabaseUrlValue && supabaseAnonKey && clientKey),
  midtransEnvironment: environment,
  midtransSnapJsUrl: snapJsUrl
};
if (config.supabaseUrl) {
  let supabaseUrl;
  try {
    supabaseUrl = new URL(config.supabaseUrl);
  } catch {
    throw new Error('DEVMATCH_SUPABASE_URL must be a valid HTTPS URL.');
  }
  if (supabaseUrl.protocol !== 'https:' ||
      !supabaseUrl.hostname.endsWith('.supabase.co') ||
      !['', '/'].includes(supabaseUrl.pathname) ||
      supabaseUrl.search ||
      supabaseUrl.hash) {
    throw new Error('DEVMATCH_SUPABASE_URL must be an HTTPS Supabase project URL.');
  }
  config.supabaseUrl = supabaseUrl.origin;
}
const output = `window.DEVMATCH_PUBLIC_CONFIG = Object.freeze(${JSON.stringify(config)});\n`;
writeFileSync(resolve(__dirname, '../assets/js/deployment-config.js'), output, {encoding: 'utf8'});
