import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, useColorScheme, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import {
    ChevronRight,
    Zap,
    Calendar,
    Award,
    CheckCircle2,
    Settings
} from 'lucide-react-native';
import { router } from 'expo-router';
import { format, subDays, isSameDay } from 'date-fns';

// Components
import HabitCard from '../../components/HabitCard';
import ErrorMessage from '../../components/ErrorMessage';
import CompletionFormModal from '../../components/CompletionFormModal';

// Services
import { getUserHabits, getHabitsByDate, logHabitCompletion, skipHabit } from '../../services/habitService';

const Index = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const isFocused = useIsFocused();

    const [habits, setHabits] = useState([]);
    const [todayHabits, setTodayHabits] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [habitsForDate, setHabitsForDate] = useState([]);
    const [completionStats, setCompletionStats] = useState({
        total: 0,
        completed: 0,
        completionRate: 0,
        goalAchieved: false,
        dailyGoal: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [errorVisible, setErrorVisible] = useState(false);

    // Modal state
    const [completionModalVisible, setCompletionModalVisible] = useState(false);
    const [selectedHabit, setSelectedHabit] = useState(null);

    // Get active domains from habits
    const activeDomains = [...new Set(habits.map(habit => habit.domain?.name || 'General'))];

    // Today's date
    const today = new Date();
    const formattedDate = format(today, 'yyyy-MM-dd');

    // Load data when screen is focused
    useEffect(() => {
        if (isFocused) {
            loadData();
        }
    }, [isFocused]);

    // Load habits for selected date
    useEffect(() => {
        if (!isLoading) {
            loadHabitsForDate(selectedDate);
        }
    }, [selectedDate, todayHabits]);

    // Auto-hide error after 5 seconds
    useEffect(() => {
        if (error) {
            setErrorVisible(true);
            const timer = setTimeout(() => {
                setErrorVisible(false);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [error]);

    const loadData = async () => {
        try {
            setIsLoading(true);

            // Fetch all habits
            let allHabitsResponse;
            try {
                allHabitsResponse = await getUserHabits();

                // Ensure we have valid data
                const habitsData = allHabitsResponse?.habits || allHabitsResponse || [];

                // Filter active habits
                const activeHabits = Array.isArray(habitsData)
                    ? habitsData.filter(habit => habit && typeof habit === 'object' && habit.is_active === true)
                    : [];

                setHabits(activeHabits);
            } catch (err) {
                console.error('Failed to fetch all habits:', err);
                setHabits([]);
            }

            // Fetch today's habits specifically
            try {
                const todayHabitsResponse = await getHabitsByDate(formattedDate);

                if (todayHabitsResponse && todayHabitsResponse.data) {
                    setTodayHabits(todayHabitsResponse.data);
                    setHabitsForDate(todayHabitsResponse.data);

                    // Update completion stats
                    if (todayHabitsResponse.stats) {
                        setCompletionStats({
                            total: todayHabitsResponse.stats.total || 0,
                            completed: todayHabitsResponse.stats.completed || 0,
                            completionRate: todayHabitsResponse.stats.completionRate || 0,
                            goalAchieved: todayHabitsResponse.stats.goalAchieved || false,
                            dailyGoal: todayHabitsResponse.stats.dailyGoal || 0
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch today\'s habits:', err);
                // If today's specific API fails, fall back to filtering all habits
                const todayFormatted = format(today, 'yyyy-MM-dd');
                const todayStart = new Date(todayFormatted);
                const todayEnd = new Date(todayFormatted);
                todayEnd.setHours(23, 59, 59, 999);

                // Filter habits that have logs for today
                if (Array.isArray(habits)) {
                    const filteredHabits = habits.filter(habit => {
                        return habit.scheduledToday || habit.completedToday;
                    });
                    setTodayHabits(filteredHabits);
                    setHabitsForDate(filteredHabits);
                }
            }

            setError(null);
        } catch (err) {
            console.error('Error loading data:', err);
            setError('Failed to load habits');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const loadHabitsForDate = async (date) => {
        try {
            // If date is today, use the todayHabits that were already fetched
            if (isSameDay(date, new Date())) {
                setHabitsForDate(todayHabits);
            } else {
                // Otherwise, fetch habits for the selected date
                const formattedDate = format(date, 'yyyy-MM-dd');
                const response = await getHabitsByDate(formattedDate);

                if (response && response.data) {
                    setHabitsForDate(response.data);
                } else {
                    setHabitsForDate([]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch habits for date:', err);
            setHabitsForDate([]);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await loadData();
    };

    const openCompletionModal = (habit) => {
        setSelectedHabit(habit);
        setCompletionModalVisible(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const closeCompletionModal = () => {
        setCompletionModalVisible(false);
        setSelectedHabit(null);
    };

    const handleSubmitCompletion = async (completionData) => {
        if (!selectedHabit) return;

        try {
            // Map the CompletionData from the modal to what the API expects
            const apiCompletionData = {
                completed: true,
                completed_at: completionData?.completed_at || new Date().toISOString(),
                completion_notes: completionData?.notes,
                mood: completionData?.mood_rating,
                energy_level: completionData?.energy_level,
                difficulty_rating: completionData?.difficulty_rating,
                evidence_image: completionData?.evidence_url,
                location_name: completionData?.location_name,
                skipped: false
            };

            await logHabitCompletion(selectedHabit.habit_id, apiCompletionData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Close modal and refresh data
            closeCompletionModal();
            loadData();
        } catch (err) {
            console.error('Error completing habit:', err);
            setError('Failed to complete habit');
        }
    };

    const handleSkip = async (habitId, reason = 'Skipped by user') => {
        try {
            const skipData = {
                date: formattedDate,
                reason: reason,
                skipped: true
            };

            await skipHabit(habitId, skipData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Refresh data to update UI
            loadData();
        } catch (err) {
            console.error('Error skipping habit:', err);
            setError('Failed to skip habit');
        }
    };

    // Navigation function for managing habits
    const navigateToManageHabits = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/habits');
    };

    if (isLoading && !isRefreshing) {
        return (
            <View className={`flex-1 justify-center items-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text className={`mt-2 font-montserrat-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Loading your habits...
                </Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <SafeAreaView edges={['left', 'right']} className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingTop: 0 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            colors={['#6366F1']}
                            tintColor={isDark ? '#E5E7EB' : '#6366F1'}
                        />
                    }
                >
                    {errorVisible && error && (
                        <View className="px-4">
                            <ErrorMessage
                                message={error}
                                severity="error"
                                onDismiss={() => setErrorVisible(false)}
                                autoHide={true}
                            />
                        </View>
                    )}

                    {/* Header Section with Date and Manage Habits Button */}
                    <View className="px-4 mb-3 flex-row justify-between items-center">
                        <View>
                            <Text className={`text-lg font-montserrat-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {format(today, 'EEEE, MMM d')}
                            </Text>
                            <Text className={`text-2xl font-montserrat-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                My Habits
                            </Text>
                        </View>


                    </View>

                    {/* Progress Summary Card */}
                    <View className="px-4 mb-3">
                        <View className={`rounded-xl shadow-sm p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                              style={{ elevation: 2 }}>
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className={`font-montserrat-semibold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Today's Progress
                                </Text>
                                <View className={`rounded-full py-1 px-3 ${
                                    completionStats.completionRate >= 80 ? 'bg-green-100' :
                                        completionStats.completionRate >= 50 ? 'bg-amber-100' : 'bg-red-100'
                                }`}>
                                    <Text className={`text-xs font-montserrat-bold ${
                                        completionStats.completionRate >= 80 ? 'text-green-800' :
                                            completionStats.completionRate >= 50 ? 'text-amber-800' : 'text-red-800'
                                    }`}>
                                        {completionStats.completionRate}%
                                    </Text>
                                </View>
                            </View>

                            {/* Progress Bar */}
                            <View className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                                <View
                                    className={`h-full ${
                                        completionStats.completionRate >= 80 ? 'bg-green-500' :
                                            completionStats.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${completionStats.completionRate}%` }}
                                />
                            </View>

                            <View className="flex-row justify-between">
                                <View className="flex-row items-center">
                                    <CheckCircle2 size={16} color={isDark ? "#60A5FA" : "#3B82F6"} />
                                    <Text className={`ml-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'} font-montserrat`}>
                                        {completionStats.completed}/{completionStats.total} Completed
                                    </Text>
                                </View>

                                <View className="flex-row items-center">
                                    <Award size={16} color={
                                        completionStats.goalAchieved ?
                                            (isDark ? "#4ADE80" : "#10B981") :
                                            (isDark ? "#9CA3AF" : "#6B7280")
                                    } />
                                    <Text className={`ml-1.5 font-montserrat ${
                                        completionStats.goalAchieved ?
                                            (isDark ? "text-green-400" : "text-green-600") :
                                            (isDark ? "text-gray-400" : "text-gray-600")
                                    }`}>
                                        Goal: {completionStats.dailyGoal}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Habits Section with Date Selector */}
                    <View className="px-4 mb-4">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className={`text-lg font-montserrat-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {isSameDay(selectedDate, new Date()) ? "Today's Habits" : format(selectedDate, 'MMM d') + " Habits"}
                            </Text>
                            <TouchableOpacity
                                className="flex-row items-center"
                                onPress={() => router.push('habits')}
                            >
                                <Text className="text-primary-500 font-montserrat-medium text-sm mr-1">
                                    View All
                                </Text>
                                <ChevronRight size={16} color="#6366F1" />
                            </TouchableOpacity>
                        </View>

                        {/* Enhanced Date Selector */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingRight: 16 }}
                            className="mb-4"
                        >
                            {Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i)).map((date) => {
                                const isToday = isSameDay(date, new Date());
                                const isSelected = isSameDay(date, selectedDate);
                                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                                return (
                                    <TouchableOpacity
                                        key={date.toISOString()}
                                        onPress={() => setSelectedDate(date)}
                                        className={`mr-3 px-4 py-3 rounded-xl ${
                                            isSelected
                                                ? 'bg-primary-500'
                                                : isDark ? 'bg-gray-800' : 'bg-white'
                                        }`}
                                        style={{
                                            minWidth: 75,
                                            alignItems: 'center',
                                            elevation: isSelected ? 4 : 2,
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: isSelected ? 0.25 : 0.1,
                                            shadowRadius: isSelected ? 3 : 2,
                                            borderWidth: isToday && !isSelected ? 1.5 : 0,
                                            borderColor: '#6366F1'
                                        }}
                                    >
                                        <Text
                                            className={`text-xs font-montserrat-bold ${
                                                isSelected
                                                    ? 'text-white'
                                                    : isDark ? 'text-gray-400' : 'text-gray-500'
                                            }`}
                                        >
                                            {format(date, 'EEE')}
                                        </Text>
                                        <Text
                                            className={`text-xl font-montserrat-bold mt-1 ${
                                                isSelected
                                                    ? 'text-white'
                                                    : isDark ? 'text-white' : 'text-gray-900'
                                            }`}
                                        >
                                            {format(date, 'd')}
                                        </Text>
                                        {isToday && (
                                            <View className={`mt-1 px-2 py-0.5 rounded-full ${
                                                isSelected ? 'bg-white' : 'bg-primary-100'
                                            }`}>
                                                <Text
                                                    className={`text-xs font-montserrat-bold ${
                                                        isSelected ? 'text-primary-500' : 'text-primary-700'
                                                    }`}
                                                >
                                                    Today
                                                </Text>
                                            </View>
                                        )}
                                        {isPast && !isToday && (
                                            <View className={`mt-1 w-1.5 h-1.5 rounded-full ${
                                                isSelected ? 'bg-white' : 'bg-gray-400'
                                            }`} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Info text for past date */}
                        {!isSameDay(selectedDate, new Date()) && (
                            <View className="mb-3 px-1">
                                <Text className={`text-xs italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    You're viewing past habits. Completion is only available for today's habits.
                                </Text>
                            </View>
                        )}

                        {/* Habits list - use habitsForDate instead of todayHabits */}
                        {habitsForDate.length === 0 ? (
                            <View className={`py-8 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} items-center justify-center mb-2`}
                                  style={{
                                      elevation: 2,
                                      shadowColor: "#000",
                                      shadowOffset: { width: 0, height: 1 },
                                      shadowOpacity: 0.1,
                                      shadowRadius: 2,
                                  }}>
                                <Calendar size={32} color={isDark ? "#9CA3AF" : "#6B7280"} />
                                <Text className={`mt-2 text-base font-montserrat-medium text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    No habits scheduled for {isSameDay(selectedDate, new Date()) ? 'today' : 'this day'}
                                </Text>
                                <TouchableOpacity
                                    onPress={navigateToManageHabits}
                                    className="mt-3 bg-primary-500 px-4 py-2 rounded-lg flex-row items-center"
                                    style={{
                                        elevation: 3,
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 2,
                                    }}
                                >
                                    <Settings size={16} color="white" />
                                    <Text className="ml-2 text-white font-montserrat-medium">Manage Habits</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            habitsForDate.map(habit => (
                                <View key={habit.habit_id}>
                                    {/* For today's habits, allow completion */}
                                    {isSameDay(selectedDate, new Date()) ? (
                                        <TouchableOpacity
                                            onPress={() => !habit.completedToday && !habit.isCompleted && openCompletionModal(habit)}
                                            activeOpacity={habit.completedToday || habit.isCompleted ? 1 : 0.7}
                                        >
                                            <HabitCard
                                                habit={habit}
                                                isDark={isDark}
                                                onComplete={() => openCompletionModal(habit)}
                                                isCompleted={habit.completedToday || habit.isCompleted}
                                            />
                                        </TouchableOpacity>
                                    ) : (
                                        // For past habits, disable completion entirely
                                        <View>
                                            <HabitCard
                                                habit={habit}
                                                isDark={isDark}
                                                onComplete={null} // No completion function for past habits
                                                isCompleted={habit.completedToday || habit.isCompleted}
                                                isPast={true} // Add a prop to style past habits differently if needed
                                            />
                                        </View>
                                    )}
                                </View>
                            ))
                        )}
                    </View>

                    {/* Domain-Based Habits Section */}
                    {activeDomains.length > 0 && (
                        <View className="px-4 mb-4">
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className={`text-lg font-montserrat-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Categories
                                </Text>
                                <TouchableOpacity
                                    className="flex-row items-center"

                                >
                                    <Text className="text-primary-500 font-montserrat-medium text-sm mr-1">
                                        View All
                                    </Text>
                                    <ChevronRight size={16} color="#6366F1" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 8, paddingRight: 16 }}
                                className="mb-2"
                            >
                                {activeDomains.map((domain, index) => {
                                    const domainHabits = habits.filter(h => h.domain?.name === domain || (!h.domain && domain === 'General'));
                                    const color = getColorForDomain(domain, index);

                                    // Calculate completion rate for this domain's habits today
                                    const domainTodayHabits = todayHabits.filter(h => h.domain?.name === domain || (!h.domain && domain === 'General'));
                                    const completedCount = domainTodayHabits.filter(h => h.isCompleted || h.completedToday).length;
                                    const completionPercent = domainTodayHabits.length > 0
                                        ? Math.round((completedCount / domainTodayHabits.length) * 100)
                                        : 0;

                                    return (
                                        <TouchableOpacity
                                            key={domain}
                                            className={`mr-3 p-4 rounded-xl shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'} w-40`}
                                            style={{ elevation: 2 }}

                                        >
                                            <View className="flex-row justify-between items-center mb-2">
                                                <View className={`p-2.5 rounded-full w-8 h-8 items-center justify-center`}
                                                      style={{ backgroundColor: `${color}20` }} // 20% opacity
                                                >
                                                    <Zap size={16} color={color} />
                                                </View>

                                                {domainTodayHabits.length > 0 && (
                                                    <View className={`rounded-full h-6 px-2 items-center justify-center ${
                                                        completionPercent === 100 ? 'bg-green-100' :
                                                            completionPercent > 0 ? 'bg-amber-100' : 'bg-gray-200'
                                                    }`}>
                                                        <Text className={`text-xs font-montserrat-bold ${
                                                            completionPercent === 100 ? 'text-green-800' :
                                                                completionPercent > 0 ? 'text-amber-800' : 'text-gray-800'
                                                        }`}>
                                                            {completionPercent}%
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            <Text className={`text-base font-montserrat-bold ${isDark ? 'text-white' : 'text-gray-900'}`} numberOfLines={1}>
                                                {domain}
                                            </Text>

                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Add more bottom padding for better scrolling experience */}
                    <View className="h-32" />
                </ScrollView>

                {/* Completion Modal */}
                {completionModalVisible && selectedHabit && (
                    <CompletionFormModal
                        visible={completionModalVisible}
                        onClose={closeCompletionModal}
                        onSubmit={handleSubmitCompletion}
                        habitName={selectedHabit.title}
                        isDark={isDark}
                    />
                )}
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

// Helper function to get a consistent color for each domain
const getColorForDomain = (domain, index) => {
    const colors = [
        '#6366F1', // indigo (primary)
        '#10B981', // emerald
        '#F59E0B', // amber
        '#8B5CF6', // purple
        '#EF4444', // red
        '#3B82F6', // blue
        '#EC4899', // pink
    ];

    // Use the domain name to get a consistent color
    const hashCode = domain.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hashCode) % colors.length] || colors[index % colors.length];
};

export default Index;