const TOKEN = 'f10d8735106af4d397a065ee1963ae46';

let _mixpanel = null;

try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const { Mixpanel } = require('mixpanel-react-native');
  const instance = new Mixpanel(TOKEN, true);
  instance.init().then(() => { _mixpanel = instance; }).catch(() => {});
} catch (e) {
  // Native module not available (old binary) — analytics disabled
}

export function trackSignUp(userId, email) {
  if (!_mixpanel) return;
  _mixpanel.identify(String(userId));
  _mixpanel.getPeople().set({ $email: email, $created: new Date().toISOString() });
  _mixpanel.track('Sign Up');
}

export function trackLogin(userId, email) {
  if (!_mixpanel) return;
  _mixpanel.identify(String(userId));
  _mixpanel.getPeople().set({ $email: email, $last_login: new Date().toISOString() });
  _mixpanel.track('Login');
}

export function trackWriteEntry() {
  if (!_mixpanel) return;
  _mixpanel.track('Write Entry');
}
