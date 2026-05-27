import { NativeModules } from 'react-native';

const TOKEN = 'f10d8735106af4d397a065ee1963ae46';

let _mixpanel = null;

// NativeModules 체크로 native module 없는 환경에서의 crash 방지
if (NativeModules.MixpanelReactNative) {
  try {
    const { Mixpanel } = require('mixpanel-react-native');
    const instance = new Mixpanel(TOKEN, true);
    instance.init().then(() => { _mixpanel = instance; }).catch(() => {});
  } catch (e) {
    // init failed — analytics disabled
  }
}

export function trackSignUp(userId, email) {
  try {
    if (!_mixpanel) return;
    _mixpanel.identify(String(userId));
    _mixpanel.getPeople().set({ $email: email, $created: new Date().toISOString() });
    _mixpanel.track('Sign Up');
  } catch (e) {}
}

export function trackLogin(userId, email) {
  try {
    if (!_mixpanel) return;
    _mixpanel.identify(String(userId));
    _mixpanel.getPeople().set({ $email: email, $last_login: new Date().toISOString() });
    _mixpanel.track('Login');
  } catch (e) {}
}

export function trackWriteEntry() {
  try {
    if (!_mixpanel) return;
    _mixpanel.track('Write Entry');
  } catch (e) {}
}
