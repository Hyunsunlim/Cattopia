import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = 'f10d8735106af4d397a065ee1963ae46';
const mixpanel = new Mixpanel(TOKEN, true);
mixpanel.init();

export function trackSignUp(userId, email) {
  mixpanel.identify(String(userId));
  mixpanel.getPeople().set({ $email: email, $created: new Date().toISOString() });
  mixpanel.track('Sign Up');
}

export function trackLogin(userId, email) {
  mixpanel.identify(String(userId));
  mixpanel.getPeople().set({ $email: email, $last_login: new Date().toISOString() });
  mixpanel.track('Login');
}

export function trackWriteEntry() {
  mixpanel.track('Write Entry');
}
