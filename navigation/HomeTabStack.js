import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MeowHomeScreen from '../screens/MeowHomeScreen';
import WriteScreen from '../screens/WriteScreen';
import WriteCompleteScreen from '../screens/WriteCompleteScreen';
import LandingScreen from '../screens/LandingScreen';
import CategoryListScreen from '../screens/CategoryListScreen';
import HomeScreen from '../screens/HomeScreen';
import InsightScreen from '../screens/InsightScreen';

const Stack = createNativeStackNavigator();

export default function HomeTabStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MeowHome" component={MeowHomeScreen} />
      <Stack.Screen name="Write" component={WriteScreen} />
      <Stack.Screen
        name="WriteComplete"
        component={WriteCompleteScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} />
      <Stack.Screen name="Notes" component={HomeScreen} />
      <Stack.Screen name="InsightDetail" component={InsightScreen} />
    </Stack.Navigator>
  );
}
