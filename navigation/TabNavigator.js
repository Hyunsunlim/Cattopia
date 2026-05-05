import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import HomeTabStack from './HomeTabStack';
import OurHouseScreen from '../screens/OurHouseScreen';
import MyLogsScreen from '../screens/MyLogsScreen';

const Tab = createBottomTabNavigator();

const ORANGE = '#f97316';
const ORANGE_BG = 'rgba(251,146,60,0.13)';
const INACTIVE = '#a8a29e';
const BAR_BG = 'rgba(251,249,248,0.94)';
const BORDER = 'rgba(251,146,60,0.18)';

const TABS = [
  { name: 'Home',     label: 'Home',      icon: 'home',     iconOut: 'home-outline' },
  { name: 'OurHouse', label: 'Our House', icon: 'paw',      iconOut: 'paw-outline' },
  { name: 'MyLogs',   label: 'My Logs',   icon: 'time',     iconOut: 'time-outline' },
];

function MeowTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  // Hide bar when navigated into a sub-screen inside HomeTabStack (e.g. Notes)
  const homeRoute = state.routes[0];
  const isDeepInHome = state.index === 0 && (homeRoute?.state?.index ?? 0) > 0;
  if (isDeepInHome) return null;

  return (
    <View style={[
      tabS.bar,
      {
        paddingBottom: insets.bottom + 6,
        backgroundColor: BAR_BG,
      },
    ]}>
      {state.routes.map((route, i) => {
        const active = state.index === i;
        const tab = TABS[i];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={tabS.item}
            onPress={onPress}
            activeOpacity={0.75}
          >
            <View style={[tabS.pill, active && tabS.pillActive]}>
              <Ionicons
                name={active ? tab.icon : tab.iconOut}
                size={22}
                color={active ? ORANGE : INACTIVE}
              />
              <Text style={[tabS.label, active && tabS.labelActive]}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <MeowTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeTabStack} />
      <Tab.Screen name="OurHouse" component={OurHouseScreen} />
      <Tab.Screen name="MyLogs"   component={MyLogsScreen} />
    </Tab.Navigator>
  );
}

const tabS = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  pillActive: {
    backgroundColor: ORANGE_BG,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  labelActive: {
    color: ORANGE,
  },
});
