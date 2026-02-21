import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import MessagesScreen from '../screens/MessagesScreen';
import DataPrivacyScreen from '../screens/DataPrivacyScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator({ onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Settings">
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
