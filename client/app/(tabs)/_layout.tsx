import { useColorScheme, View } from 'react-native';
import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from "@/components/TabBar";
import Header from "@/components/Header";

import { store } from '@/store/store';
import { Provider } from 'react-redux';

const TabsLayout = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Provider store={store}>
            <View className={`flex-1 ${isDark ? 'bg-theme-background-dark' : 'bg-gray-50'}`}>
                <Header />
                <Tabs tabBar={props => <TabBar {...props} options={{ headerShown: false }} />}>
                    <Tabs.Screen name='index' options={{ title: 'Home', headerShown: false }} />
                    <Tabs.Screen name='explore' options={{ title: 'Explore', headerShown: false }} />
                    <Tabs.Screen name='add' options={{ title: 'Add', headerShown: false }} />
                    <Tabs.Screen name='analytics' options={{ title: 'Analytics', headerShown: false }} />
                    <Tabs.Screen name='rank' options={{ title: 'Rank', headerShown: false }} />
                </Tabs>
            </View>
        </Provider>
    );
};

export default TabsLayout;
