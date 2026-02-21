import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import InsightScreen from '../screens/InsightScreen';

const Tab = createBottomTabNavigator();

// Dummy screen for the center tab (never rendered)
function DummyScreen() {
  return null;
}

function CenterTabButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.centerButton} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.centerButtonInner}>
        <Ionicons name="add" size={32} color="white" />
      </View>
    </TouchableOpacity>
  );
}

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'android' ? 60 + insets.bottom : 88;

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#666666',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 0,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: 'Note',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      >
        {(props) => <HomeScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen
        name="NewNote"
        component={DummyScreen}
        options={{
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <CenterTabButton
              onPress={() => {
                // Navigate to Home and trigger new note modal
                props.onPress && props.onPress();
              }}
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Home', { openNewNote: Date.now() });
          },
        })}
      />

      <Tab.Screen
        name="Insights"
        component={InsightScreen}
        options={{
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
