import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions,
    BackHandler
} from 'react-native';
import { Camera, CheckCircle, Search, UserPlus, Users, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const CreateGroupModal = ({
                              visible,
                              onClose,
                              friends = [],
                              onCreateGroup,
                              loading = false
                          }) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();

    // Group form state
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [groupImage, setGroupImage] = useState(null);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Refs
    const nameInputRef = useRef(null);
    const scrollViewRef = useRef(null);

    // Theme colors
    const colors = {
        primary: isDark ? '#4ADE80' : '#22C55E',
        primaryLight: isDark ? '#86EFAC' : '#4ADE80',
        primaryBg: isDark ? 'rgba(74, 222, 128, 0.1)' : 'rgba(34, 197, 94, 0.05)',
        background: isDark ? '#0F172A' : '#FFFFFF',
        card: isDark ? '#1E293B' : '#F8FAFC',
        surface: isDark ? '#334155' : '#FFFFFF',
        input: isDark ? '#475569' : '#F1F5F9',
        textPrimary: isDark ? '#F8FAFC' : '#0F172A',
        textSecondary: isDark ? '#E2E8F0' : '#334155',
        textMuted: isDark ? '#94A3B8' : '#64748B',
        border: isDark ? '#475569' : '#E2E8F0',
        success: isDark ? '#4ADE80' : '#22C55E',
        overlay: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)'
    };

    // Handle Android back button
    useEffect(() => {
        if (!visible) return;

        const backAction = () => {
            handleClose();
            return true;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [visible]);

    // Reset form when modal opens
    useEffect(() => {
        if (visible) {
            setGroupName('');
            setGroupDescription('');
            setGroupImage(null);
            setSelectedFriends([]);
            setSearchQuery('');

            // Focus on name input after a delay
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 600);
        }
    }, [visible]);

    // Filter friends based on search
    const filteredFriends = friends.filter(friend => {
        if (!searchQuery) return true;
        return friend.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Handle selecting/deselecting a friend
    const toggleFriendSelection = (friend) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedFriends(prevSelected => {
            const isSelected = prevSelected.some(f => f.user_id === friend.user_id);
            if (isSelected) {
                return prevSelected.filter(f => f.user_id !== friend.user_id);
            } else {
                return [...prevSelected, friend];
            }
        });
    };

    // Pick image from gallery
    const pickImage = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert("Permission Required", "You need to allow access to your photos to set a group image.");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setGroupImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert("Error", "Could not select image. Please try again.");
        }
    };

    // Validate and submit
    const handleCreateGroup = () => {
        if (!groupName.trim()) {
            Alert.alert("Required Field", "Please enter a group name.");
            return;
        }

        if (selectedFriends.length === 0) {
            Alert.alert("Required Field", "Please select at least one friend for the group.");
            return;
        }

        const groupData = {
            name: groupName.trim(),
            description: groupDescription.trim(),
            participants: selectedFriends.map(friend => friend.user_id),
            avatar: groupImage
        };

        onCreateGroup(groupData);
    };

    // Clean close
    const handleClose = () => {
        if (groupName || groupDescription || selectedFriends.length > 0 || groupImage) {
            Alert.alert(
                "Discard Changes?",
                "You have unsaved changes. Are you sure you want to discard them?",
                [
                    { text: "Continue Editing", style: "cancel" },
                    { text: "Discard", style: "destructive", onPress: onClose }
                ]
            );
        } else {
            onClose();
        }
    };

    // Don't render if not visible
    if (!visible) return null;

    const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : insets.top;

    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                backgroundColor: colors.overlay,
            }}
        >
            {/* Background Overlay - Close on tap */}
            <Pressable
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                }}
                onPress={handleClose}
            />

            {/* Main Content Container */}
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.background,
                    marginTop: Platform.OS === 'android' ? statusBarHeight : 0,
                }}
            >
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        backgroundColor: colors.card,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        ...(Platform.OS === 'android' && {
                            elevation: 4,
                            shadowColor: '#000',
                        }),
                        ...(Platform.OS === 'ios' && {
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                        })
                    }}
                >
                    <TouchableOpacity
                        onPress={handleClose}
                        style={{
                            padding: 8,
                            borderRadius: 20,
                            backgroundColor: isDark ? colors.surface : '#F3F4F6',
                        }}
                        activeOpacity={0.7}
                    >
                        <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: 'bold',
                            color: colors.textPrimary,
                            textAlign: 'center',
                        }}
                    >
                        Create New Group
                    </Text>

                    <TouchableOpacity
                        onPress={handleCreateGroup}
                        disabled={loading}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: colors.primary,
                            opacity: loading ? 0.6 : 1,
                            minWidth: 70,
                            alignItems: 'center',
                        }}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text
                                style={{
                                    color: 'white',
                                    fontWeight: '600',
                                    fontSize: 14,
                                }}
                            >
                                Create
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                >
                    <ScrollView
                        ref={scrollViewRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            padding: 20,
                            paddingBottom: 100,
                        }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Group Image */}
                        <View style={{ alignItems: 'center', marginBottom: 30 }}>
                            <TouchableOpacity
                                onPress={pickImage}
                                style={{
                                    width: 100,
                                    height: 100,
                                    borderRadius: 50,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: colors.input,
                                    ...(Platform.OS === 'android' && { elevation: 3 }),
                                    ...(Platform.OS === 'ios' && {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                    })
                                }}
                                activeOpacity={0.8}
                            >
                                {groupImage ? (
                                    <Image
                                        source={{ uri: groupImage }}
                                        style={{
                                            width: 100,
                                            height: 100,
                                            borderRadius: 50,
                                        }}
                                    />
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Camera size={28} color={colors.textMuted} />
                                        <Text
                                            style={{
                                                marginTop: 4,
                                                fontSize: 11,
                                                color: colors.textMuted,
                                            }}
                                        >
                                            Add photo
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Group Name */}
                        <View style={{ marginBottom: 20 }}>
                            <Text
                                style={{
                                    marginBottom: 8,
                                    fontSize: 16,
                                    fontWeight: '600',
                                    color: colors.textPrimary,
                                }}
                            >
                                Group Name *
                            </Text>
                            <TextInput
                                ref={nameInputRef}
                                style={{
                                    padding: 14,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1.5,
                                    borderColor: colors.border,
                                    fontSize: 16,
                                    color: colors.textPrimary,
                                    ...(Platform.OS === 'android' && {
                                        elevation: 1,
                                        textAlignVertical: 'center',
                                    })
                                }}
                                placeholder="Enter group name"
                                placeholderTextColor={colors.textMuted}
                                value={groupName}
                                onChangeText={setGroupName}
                                maxLength={50}
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Group Description */}
                        <View style={{ marginBottom: 30 }}>
                            <Text
                                style={{
                                    marginBottom: 8,
                                    fontSize: 16,
                                    fontWeight: '600',
                                    color: colors.textPrimary,
                                }}
                            >
                                Description (Optional)
                            </Text>
                            <TextInput
                                style={{
                                    padding: 14,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1.5,
                                    borderColor: colors.border,
                                    fontSize: 16,
                                    minHeight: 90,
                                    color: colors.textPrimary,
                                    ...(Platform.OS === 'android' && {
                                        textAlignVertical: 'top',
                                        elevation: 1,
                                    })
                                }}
                                placeholder="What's this group about?"
                                placeholderTextColor={colors.textMuted}
                                value={groupDescription}
                                onChangeText={setGroupDescription}
                                multiline
                                numberOfLines={3}
                                maxLength={200}
                                autoCapitalize="sentences"
                            />
                        </View>

                        {/* Member Selection */}
                        <View>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 15
                            }}>
                                <Text
                                    style={{
                                        fontSize: 16,
                                        fontWeight: '600',
                                        color: colors.textPrimary,
                                    }}
                                >
                                    Add Members *
                                </Text>

                                {selectedFriends.length > 0 && (
                                    <View
                                        style={{
                                            backgroundColor: colors.primaryBg,
                                            paddingHorizontal: 12,
                                            paddingVertical: 4,
                                            borderRadius: 16,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontWeight: '600',
                                                color: colors.primary,
                                            }}
                                        >
                                            {selectedFriends.length} selected
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Selected Members Preview */}
                            {selectedFriends.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={{ marginBottom: 20 }}
                                    contentContainerStyle={{ paddingRight: 20 }}
                                >
                                    {selectedFriends.map((friend) => (
                                        <TouchableOpacity
                                            key={friend.user_id}
                                            onPress={() => toggleFriendSelection(friend)}
                                            style={{
                                                alignItems: 'center',
                                                marginRight: 15,
                                                padding: 5,
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ position: 'relative' }}>
                                                <Image
                                                    source={{
                                                        uri: friend.avatar ||
                                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.user_name || 'User')}`
                                                    }}
                                                    style={{
                                                        width: 50,
                                                        height: 50,
                                                        borderRadius: 25,
                                                        borderWidth: 2,
                                                        borderColor: colors.primary,
                                                    }}
                                                />
                                                <View
                                                    style={{
                                                        position: 'absolute',
                                                        top: -5,
                                                        right: -5,
                                                        backgroundColor: colors.primary,
                                                        borderRadius: 10,
                                                        padding: 3,
                                                        borderWidth: 2,
                                                        borderColor: colors.background,
                                                    }}
                                                >
                                                    <X size={10} color="white" />
                                                </View>
                                            </View>
                                            <Text
                                                style={{
                                                    marginTop: 6,
                                                    fontSize: 11,
                                                    color: colors.textSecondary,
                                                    textAlign: 'center',
                                                    width: 55,
                                                }}
                                                numberOfLines={1}
                                            >
                                                {friend.user_name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            {/* Search */}
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    marginBottom: 15,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1.5,
                                    borderColor: colors.border,
                                    ...(Platform.OS === 'android' && { elevation: 1 })
                                }}
                            >
                                <Search size={18} color={colors.textMuted} />
                                <TextInput
                                    style={{
                                        flex: 1,
                                        marginLeft: 10,
                                        fontSize: 16,
                                        color: colors.textPrimary,
                                        ...(Platform.OS === 'android' && {
                                            textAlignVertical: 'center',
                                        })
                                    }}
                                    placeholder="Search friends..."
                                    placeholderTextColor={colors.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            {/* Friends List */}
                            <View
                                style={{
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    overflow: 'hidden',
                                    ...(Platform.OS === 'android' && { elevation: 1 })
                                }}
                            >
                                {filteredFriends.length === 0 ? (
                                    <View
                                        style={{
                                            padding: 30,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                color: colors.textMuted,
                                                textAlign: 'center',
                                            }}
                                        >
                                            {searchQuery ? 'No friends match your search' : 'No friends available'}
                                        </Text>
                                    </View>
                                ) : (
                                    filteredFriends.map((friend, index) => {
                                        const isSelected = selectedFriends.some(f => f.user_id === friend.user_id);
                                        return (
                                            <TouchableOpacity
                                                key={friend.user_id}
                                                onPress={() => toggleFriendSelection(friend)}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: 14,
                                                    paddingHorizontal: 16,
                                                    borderBottomWidth: index < filteredFriends.length - 1 ? 1 : 0,
                                                    borderBottomColor: colors.border,
                                                    backgroundColor: isSelected ? colors.primaryBg : 'transparent',
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Image
                                                    source={{
                                                        uri: friend.avatar ||
                                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.user_name || 'User')}`
                                                    }}
                                                    style={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 22,
                                                    }}
                                                />
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text
                                                        style={{
                                                            fontSize: 16,
                                                            fontWeight: '500',
                                                            color: colors.textPrimary,
                                                            marginBottom: 2,
                                                        }}
                                                    >
                                                        {friend.user_name}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            fontSize: 12,
                                                            color: friend.isOnline || isRecentlyActive(friend.lastActive)
                                                                ? colors.success
                                                                : colors.textMuted,
                                                        }}
                                                    >
                                                        {friend.isOnline || isRecentlyActive(friend.lastActive) ? 'Online' : 'Offline'}
                                                    </Text>
                                                </View>
                                                {isSelected ? (
                                                    <CheckCircle size={22} color={colors.primary} />
                                                ) : (
                                                    <UserPlus size={20} color={colors.textMuted} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Bottom Buttons */}
                <View
                    style={{
                        flexDirection: 'row',
                        padding: 20,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        backgroundColor: colors.card,
                        ...(Platform.OS === 'android' && { elevation: 8 })
                    }}
                >
                    <TouchableOpacity
                        onPress={handleClose}
                        style={{
                            flex: 1,
                            marginRight: 10,
                            paddingVertical: 14,
                            borderRadius: 12,
                            alignItems: 'center',
                            backgroundColor: colors.input,
                        }}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: colors.textSecondary,
                            }}
                        >
                            Cancel
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleCreateGroup}
                        disabled={loading}
                        style={{
                            flex: 1,
                            marginLeft: 10,
                            paddingVertical: 14,
                            borderRadius: 12,
                            alignItems: 'center',
                            backgroundColor: loading ? colors.primaryLight : colors.primary,
                            opacity: loading ? 0.7 : 1,
                        }}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Users size={18} color="white" />
                                <Text
                                    style={{
                                        marginLeft: 8,
                                        color: 'white',
                                        fontSize: 16,
                                        fontWeight: '600',
                                    }}
                                >
                                    Create Group
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// Helper function to check if a user was recently active
function isRecentlyActive(lastActive) {
    if (!lastActive) return false;
    const lastActiveTime = new Date(lastActive).getTime();
    const now = new Date().getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    return now - lastActiveTime < fifteenMinutes;
}

export default CreateGroupModal;