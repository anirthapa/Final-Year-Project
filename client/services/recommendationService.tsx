// services/recommendationService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchData, postData, updateData } from './api';

// Interface for habit recommendation
export interface HabitRecommendation {
    habit_name: string;
    description: string;
    frequency: string;
    tracking_type: string;
    domain: string;
    difficulty: string;
    implementation_tips: string;
}

// Interface for user stats
export interface UserStats {
    name: string;
    totalHabits: number;
    currentDailyStreak: number;
}

// Interface for the response from the API
interface RecommendationResponse {
    success: boolean;
    data: {
        recommendations: HabitRecommendation[];
        user: UserStats;
    };
    message?: string;
}

// Interface for domain recommendation response
interface DomainResponse {
    success: boolean;
    data: {
        recommendedDomains: Array<{
            domain_id: number;
            name: string;
            description: string;
            currentCount: number;
        }>;
        domainDistribution: Array<{
            count: number;
            name: string;
        }>;
        averageHabitsPerDomain: number;
    };
    message?: string;
}

// Function to get the JWT token from AsyncStorage
const getToken = async (): Promise<string | null> => {
    try {
        const token = await AsyncStorage.getItem('userToken');
        return token;
    } catch (error) {
        console.error('Error retrieving token:', error);
        return null;
    }
};

/**
 * Get personalized habit recommendations for the user
 * @returns Promise with habit recommendations and user stats
 */
export const getHabitRecommendations = async (): Promise<{
    success: boolean;
    data?: {
        recommendations: HabitRecommendation[];
        user: UserStats;
    };
    error?: string;
}> => {
    try {
        const response = await fetchData<RecommendationResponse>(
            '/recommendation/getHabitRecommendation'
        );

        if (response.success) {
            return {
                success: true,
                data: response.data
            };
        } else {
            throw new Error(response.message || 'Failed to get recommendations');
        }
    } catch (error) {
        console.error('Error in recommendation service:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get recommendations'
        };
    }
};

/**
 * Get recommended habit domains based on current distribution
 * @returns Promise with domain recommendations
 */
export const getRecommendedDomains = async (): Promise<{
    success: boolean;
    data?: DomainResponse['data'];
    error?: string;
}> => {
    try {
        const response = await fetchData<DomainResponse>(
            '/recommendation/getRecommendedHabitDomains'
        );

        if (response.success) {
            return {
                success: true,
                data: response.data
            };
        } else {
            throw new Error(response.message || 'Failed to get domain recommendations');
        }
    } catch (error) {
        console.error('Error in domain recommendation service:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get domain recommendations'
        };
    }
};

/**
 * Saves recommendation cache to AsyncStorage
 * @param recommendations - Array of recommendations to save
 */
export const saveRecommendationCache = async (recommendations: HabitRecommendation[]): Promise<void> => {
    try {
        await AsyncStorage.setItem('recommendationCache', JSON.stringify(recommendations));
    } catch (error) {
        console.error('Error saving recommendation cache:', error);
    }
};

/**
 * Loads recommendation cache from AsyncStorage
 * @returns Promise with array of cached recommendations
 */
export const loadRecommendationCache = async (): Promise<HabitRecommendation[]> => {
    try {
        const cache = await AsyncStorage.getItem('recommendationCache');
        return cache ? JSON.parse(cache) : [];
    } catch (error) {
        console.error('Error loading recommendation cache:', error);
        return [];
    }
};

/**
 * Clears recommendation cache from AsyncStorage
 */
export const clearRecommendationCache = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem('recommendationCache');
    } catch (error) {
        console.error('Error clearing recommendation cache:', error);
    }
};

export default {
    getHabitRecommendations,
    getRecommendedDomains,
    saveRecommendationCache,
    loadRecommendationCache,
    clearRecommendationCache
};