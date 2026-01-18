import {
    Image,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Pressable,
    ActivityIndicator,
    TextInput,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    Alert,
    FlatList,
    BackHandler
} from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Send, X, Edit, Trash2, ArrowLeft } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Comment from './Comment';
import icons from '../constants/images';
import { API_BASE_URL } from '../services/api';
import { toggleLikeBlog, deleteBlog, editBlog } from '../services/blogService';
import { getComments, addComment } from '../services/commentService';
import { useSelector } from "react-redux";
import { router } from "expo-router";
import BlogPostCreator from './BlogPostCreator';

const Blog = ({
                  blog,
                  isDark,
                  onShare,
                  onBookmark,
                  onMenuPress,
                  onReadMore,
                  authorProfile = icons.maleProfile,
                  onEditBlog,
                  onDeleteBlog,
                  onBlogUpdated
              }) => {
    const insets = useSafeAreaInsets();

    // State management
    const [showComments, setShowComments] = useState(false);
    const [isLiked, setIsLiked] = useState(blog.isLiked || false);
    const [isSaved, setIsSaved] = useState(blog.isSaved || false);
    const [likesCount, setLikesCount] = useState(blog.likesCount || 0);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [loadingComments, setLoadingComments] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [scrollEnabled, setScrollEnabled] = useState(true);

    const commentInputRef = useRef(null);

    // Get current user from Redux
    const userDetails = useSelector((state) => state.user);
    const currentUser = userDetails || {};

    // Check if current user is the blog owner
    const isOwner = currentUser?.user_id === blog.user?.user_id;

    // Theme colors
    const colors = {
        background: isDark ? '#111827' : '#FFFFFF',
        card: isDark ? '#1F2937' : '#FFFFFF',
        border: isDark ? '#374151' : '#E5E7EB',
        text: isDark ? '#FFFFFF' : '#1F2937',
        textSecondary: isDark ? '#D1D5DB' : '#4B5563',
        textMuted: isDark ? '#9CA3AF' : '#6B7280',
        input: isDark ? '#1F2937' : '#F3F4F6',
        overlay: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
        success: '#7C3AED',
        danger: '#EF4444',
    };

    // Handle Android back button for modals
    useEffect(() => {
        if (!showOptions && !showComments) return;

        const backAction = () => {
            if (showComments) {
                setShowComments(false);
                setScrollEnabled(true);
                return true;
            }
            if (showOptions) {
                setShowOptions(false);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [showOptions, showComments]);

    // Helper function to get full image URL
    const getFullImageUrl = (imagePath) => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http')) return imagePath;
        return `${API_BASE_URL}${imagePath}`;
    };

    // Format date for display
    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffInSeconds = Math.floor((now - date) / 1000);

            if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
            if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;

            return date.toLocaleDateString();
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Recently';
        }
    };

    // Function to load comments
    const loadComments = async () => {
        try {
            setLoadingComments(true);
            const response = await getComments(blog.blog_id);

            if (response && response.success && response.data) {
                setComments(response.data);
            } else {
                setComments([]);
            }
            setLoadingComments(false);
        } catch (error) {
            console.error('Error loading comments:', error);
            setLoadingComments(false);
        }
    };

    // Refresh comments
    const refreshComments = async () => {
        setRefreshing(true);
        await loadComments();
        setRefreshing(false);
    };

    // Handle like
    const handleLike = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Optimistic UI update
        const previousIsLiked = isLiked;
        const previousLikesCount = likesCount;

        setIsLiked(!isLiked);
        setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

        try {
            const response = await toggleLikeBlog(blog.blog_id);

            if (response && response.success) {
                if (response.data && response.data.liked !== undefined) {
                    setIsLiked(response.data.liked);
                }
                if (response.data && response.data.likesCount !== undefined) {
                    setLikesCount(response.data.likesCount);
                }
            } else {
                // Revert on error
                setIsLiked(previousIsLiked);
                setLikesCount(previousLikesCount);
            }
        } catch (error) {
            // Revert on error
            setIsLiked(previousIsLiked);
            setLikesCount(previousLikesCount);
            console.error('Error toggling like:', error);
        }
    };

    // Handle bookmark
    const handleBookmark = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsSaved(!isSaved);
        if (onBookmark) onBookmark(blog.blog_id, isSaved);
    };

    // Handle comment modal
    const handleCommentPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowComments(true);
        setScrollEnabled(false);
        loadComments();
    };

    const closeCommentsModal = () => {
        setShowComments(false);
        setScrollEnabled(true);
        setReplyingTo(null);
        setNewComment('');
    };

    // Handle share
    const handleShare = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onShare) onShare(blog.blog_id);
    };

    // Handle menu options
    const handleMenuPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowOptions(true);
    };

    // Prepare blog data for editor
    const prepareCurrentBlogForEditor = () => {
        return {
            title: blog.title || '',
            content: blog.content || '',
            images: blog.image ? [blog.image] : [],
            category_id: blog.category?.category_id,
            is_public: blog.is_public !== false
        };
    };

    // Handle edit blog
    const handleEditBlog = () => {
        setShowOptions(false);
        if (onEditBlog) {
            onEditBlog(blog);
        } else {
            setEditModalVisible(true);
        }
    };

    // Handle blog update
    const handleUpdateBlog = async (updatedData) => {
        if (!blog || !blog.blog_id) {
            Alert.alert("Error", "Blog ID is missing. Please try again.");
            return;
        }

        try {
            setEditLoading(true);

            const postData = {
                ...updatedData,
                image: updatedData.images && updatedData.images.length > 0 ? updatedData.images[0] : null
            };

            const response = await editBlog(blog.blog_id, postData);

            if (response && response.success) {
                const updatedBlog = {
                    ...blog,
                    title: postData.title,
                    content: postData.content,
                    image: postData.image,
                    category_id: postData.category_id,
                    is_public: postData.is_public
                };

                if (onBlogUpdated) {
                    onBlogUpdated(updatedBlog);
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setEditModalVisible(false);
                Alert.alert("Success", "Your blog has been updated successfully.");
            } else {
                Alert.alert("Error", response?.message || "Failed to update blog.");
            }
        } catch (err) {
            console.error('Error updating blog:', err);
            Alert.alert("Error", "Failed to update blog. Please try again.");
        } finally {
            setEditLoading(false);
        }
    };

    // Handle delete blog
    const handleDeleteBlog = () => {
        setShowOptions(false);

        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsDeleting(true);
                            const response = await deleteBlog(blog.blog_id);

                            if (response && response.success) {
                                if (onDeleteBlog) {
                                    onDeleteBlog(blog.blog_id);
                                }
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } else {
                                Alert.alert("Error", "Failed to delete post. Please try again later.");
                            }
                        } catch (error) {
                            console.error('Error deleting blog:', error);
                            Alert.alert("Error", "Failed to delete post. Please try again later.");
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    // Handle reply
    const handleReply = (comment) => {
        setReplyingTo(comment);
        setNewComment(`@${comment.user.user_name || comment.user.name} `);
        setTimeout(() => {
            commentInputRef.current?.focus();
        }, 100);
    };

    // Submit comment
    const handleSubmitComment = async () => {
        if (!newComment.trim()) return;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            const commentData = {
                content: newComment,
                parent_id: replyingTo ? (replyingTo.comment_id || replyingTo.id) : undefined
            };

            const response = await addComment(blog.blog_id, commentData);

            if (response && response.success && response.data) {
                if (replyingTo) {
                    const updatedComments = comments.map(comment => {
                        if ((comment.comment_id || comment.id) === (replyingTo.comment_id || replyingTo.id)) {
                            return {
                                ...comment,
                                replies: comment.replies ? [...comment.replies, response.data] : [response.data]
                            };
                        }
                        return comment;
                    });
                    setComments(updatedComments);
                } else {
                    setComments([response.data, ...comments]);
                }

                setNewComment('');
                setReplyingTo(null);
                Keyboard.dismiss();
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    // Handle comment like
    const handleCommentLike = (commentId, isLiked) => {
        console.log('Like comment:', commentId, isLiked);
    };

    // Format content preview
    const formatContentPreview = (content, maxLength = 150) => {
        if (!content) return '';
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength - 3) + '...';
    };

    // Handle profile navigation
    const navigateToProfile = (userId, userName) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setTimeout(() => {
            if (currentUser?.user_id === userId) {
                router.push('/profile');
            } else {
                router.push({
                    pathname: `/(profile)/${userId}`,
                    params: { name: userName || '' }
                });
            }
        }, 10);
    };

    return (
        <>
            {/* Main Blog Card */}
            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500 }}
                style={{
                    marginBottom: 16,
                    borderRadius: 24,
                    backgroundColor: colors.card,
                    overflow: 'hidden',
                    ...(Platform.OS === 'android' && {
                        elevation: 4,
                    }),
                    ...(Platform.OS === 'ios' && {
                        shadowColor: '#000',
                        shadowOpacity: isDark ? 0.3 : 0.1,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 2 },
                    })
                }}
            >
                {/* Author Info */}
                <View style={{
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Image
                            source={blog.user?.avatar ? { uri: blog.user.avatar } : authorProfile}
                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border }}
                        />
                        <View>
                            <TouchableOpacity onPress={() => navigateToProfile(blog.user.user_id, blog.user.user_name)}>
                                <Text style={{
                                    fontWeight: 'bold',
                                    color: colors.text,
                                    fontSize: 14,
                                }}>
                                    {blog.user?.user_name || "Anonymous"}
                                </Text>
                            </TouchableOpacity>
                            <Text style={{
                                fontSize: 12,
                                color: colors.textMuted,
                            }}>
                                {formatDate(blog.createdAt || new Date())}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={handleMenuPress}
                    >
                        <MoreHorizontal size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Category Tag */}
                {blog.category && (
                    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                        <View
                            style={{
                                alignSelf: 'flex-start',
                                borderRadius: 20,
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                backgroundColor: blog.category.color || '#6366F1',
                            }}
                        >
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '500' }}>
                                {blog.category.icon ? `${blog.category.icon} ` : ''}{blog.category.category_name || 'General'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Blog Title */}
                {blog.title && (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: 'bold',
                            color: colors.text,
                        }}>
                            {blog.title}
                        </Text>
                    </View>
                )}

                {/* Blog Content */}
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                    <Text style={{
                        fontSize: 16,
                        lineHeight: 24,
                        color: colors.textSecondary,
                    }}>
                        {formatContentPreview(blog.content)}
                    </Text>
                </View>

                {/* Blog Image */}
                {blog.image && !imageError && (
                    <View style={{ width: '100%', height: 256 }}>
                        <Image
                            source={{ uri: getFullImageUrl(blog.image) }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                            onError={() => setImageError(true)}
                        />
                    </View>
                )}

                {/* Action Buttons */}
                <View style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Like Button */}
                        <TouchableOpacity
                            onPress={handleLike}
                            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}
                        >
                            <Heart
                                size={22}
                                color={isLiked ? colors.success : colors.textMuted}
                                fill={isLiked ? colors.success : 'none'}
                            />
                            <Text style={{
                                marginLeft: 6,
                                color: isLiked ? colors.success : colors.textMuted,
                            }}>
                                {likesCount > 999 ? `${(likesCount / 1000).toFixed(1)}k` : likesCount}
                            </Text>
                        </TouchableOpacity>

                        {/* Comment Button */}
                        <TouchableOpacity
                            onPress={handleCommentPress}
                            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}
                        >
                            <MessageCircle size={22} color={colors.textMuted} />
                            <Text style={{ marginLeft: 6, color: colors.textMuted }}>
                                {blog.commentsCount || 0}
                            </Text>
                        </TouchableOpacity>

                        {/* Bookmark Button */}
                        <TouchableOpacity onPress={handleBookmark}>
                            <Bookmark
                                size={22}
                                color={isSaved ? '#3B82F6' : colors.textMuted}
                                fill={isSaved ? '#3B82F6' : 'none'}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Share Button */}
                    <TouchableOpacity onPress={handleShare}>
                        <Share2 size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Read More Button */}
                {blog.content && blog.content.length > 150 && (
                    <TouchableOpacity
                        onPress={onReadMore}
                        style={{
                            marginHorizontal: 16,
                            marginBottom: 16,
                            paddingVertical: 8,
                            borderRadius: 12,
                            backgroundColor: colors.input,
                        }}
                    >
                        <Text style={{
                            textAlign: 'center',
                            fontWeight: '500',
                            color: colors.success,
                        }}>
                            Read more
                        </Text>
                    </TouchableOpacity>
                )}
            </MotiView>

            {/* Options Menu Overlay */}
            {showOptions && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 99999,
                        backgroundColor: colors.overlay,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                    }}
                >
                    <Pressable
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                        }}
                        onPress={() => setShowOptions(false)}
                    />

                    <MotiView
                        from={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 18 }}
                        style={{
                            backgroundColor: colors.background,
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 320,
                            overflow: 'hidden',
                            ...(Platform.OS === 'android' && { elevation: 10 }),
                            ...(Platform.OS === 'ios' && {
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.3,
                                shadowRadius: 20,
                            })
                        }}
                    >
                        {/* Header */}
                        <View style={{
                            padding: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: colors.text
                            }}>
                                Post Options
                            </Text>
                        </View>

                        {/* Options */}
                        <View style={{ padding: 4 }}>
                            {isOwner && (
                                <>
                                    <TouchableOpacity
                                        onPress={handleEditBlog}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingHorizontal: 16,
                                            paddingVertical: 12,
                                            marginHorizontal: 8,
                                            borderRadius: 8,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{
                                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                            padding: 8,
                                            borderRadius: 20,
                                            marginRight: 12,
                                        }}>
                                            <Edit size={18} color={isDark ? "#60A5FA" : "#3B82F6"} />
                                        </View>
                                        <View>
                                            <Text style={{
                                                fontSize: 15,
                                                fontWeight: '600',
                                                color: colors.text
                                            }}>
                                                Edit Post
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                color: colors.textMuted
                                            }}>
                                                Make changes to your post
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={handleDeleteBlog}
                                        disabled={isDeleting}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingHorizontal: 16,
                                            paddingVertical: 12,
                                            marginHorizontal: 8,
                                            borderRadius: 8,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{
                                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                            padding: 8,
                                            borderRadius: 20,
                                            marginRight: 12,
                                        }}>
                                            {isDeleting ? (
                                                <ActivityIndicator size="small" color={colors.danger} />
                                            ) : (
                                                <Trash2 size={18} color={colors.danger} />
                                            )}
                                        </View>
                                        <View>
                                            <Text style={{
                                                fontSize: 15,
                                                fontWeight: '600',
                                                color: colors.danger
                                            }}>
                                                {isDeleting ? 'Deleting...' : 'Delete Post'}
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                color: colors.textMuted
                                            }}>
                                                Remove this post permanently
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}

                            <TouchableOpacity
                                onPress={() => {
                                    setShowOptions(false);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    marginHorizontal: 8,
                                    borderRadius: 8,
                                    marginBottom: 8,
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: colors.text }}>
                                    Report post
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Cancel Button */}
                        <TouchableOpacity
                            style={{
                                width: '100%',
                                paddingVertical: 14,
                                backgroundColor: colors.input,
                                alignItems: 'center',
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => setShowOptions(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={{
                                fontWeight: '600',
                                color: colors.textSecondary
                            }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </MotiView>
                </View>
            )}

            {/* Comments Modal */}
            {showComments && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 99998,
                        backgroundColor: colors.overlay,
                    }}
                >
                    <StatusBar
                        backgroundColor="transparent"
                        barStyle={isDark ? "light-content" : "dark-content"}
                        translucent={true}
                    />

                    <Pressable
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                        }}
                        onPress={closeCommentsModal}
                    />

                    <View
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            top: Platform.OS === 'android' ? 30 : '5%',
                            backgroundColor: colors.background,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                        }}
                    >
                        {/* Header */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity
                                    onPress={closeCommentsModal}
                                    style={{ padding: 8, borderRadius: 20 }}
                                >
                                    <ArrowLeft size={22} color={colors.text} />
                                </TouchableOpacity>
                                <Text style={{
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    marginLeft: 10,
                                    color: colors.text,
                                }}>
                                    Comments
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={closeCommentsModal}
                                style={{ padding: 8, borderRadius: 20 }}
                            >
                                <X size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Comments List */}
                        <View style={{ flex: 1 }}>
                            <FlatList
                                data={loadingComments ? [] : comments.length > 0 ? comments : [null]}
                                keyExtractor={(item) => item ? (item.comment_id || item.id).toString() : 'empty'}
                                contentContainerStyle={{
                                    paddingHorizontal: 16,
                                    paddingTop: 12,
                                    paddingBottom: 40,
                                    flexGrow: 1,
                                }}
                                ListEmptyComponent={() => (
                                    <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                                        {loadingComments ? (
                                            <>
                                                <ActivityIndicator size="large" color={colors.success} />
                                                <Text style={{ marginTop: 12, fontSize: 16, color: colors.textMuted }}>
                                                    Loading comments...
                                                </Text>
                                            </>
                                        ) : (
                                            <Text style={{ textAlign: 'center', fontSize: 16, color: colors.textMuted }}>
                                                No comments yet. Be the first to comment!
                                            </Text>
                                        )}
                                    </View>
                                )}
                                renderItem={({ item }) => {
                                    if (!item) return null;
                                    return (
                                        <Comment
                                            key={item.comment_id || item.id}
                                            comment={item}
                                            isDark={isDark}
                                            onReply={handleReply}
                                            onLike={handleCommentLike}
                                            formatDate={formatDate}
                                            refreshComments={refreshComments}
                                            blogId={blog.blog_id}
                                            closeCommentsModal={closeCommentsModal}
                                        />
                                    );
                                }}
                                showsVerticalScrollIndicator={true}
                                keyboardShouldPersistTaps="handled"
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={refreshComments}
                                        colors={[colors.success]}
                                        tintColor={colors.success}
                                        progressBackgroundColor={colors.input}
                                    />
                                }
                            />

                            {/* Reply Indicator */}
                            {replyingTo && (
                                <View style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderTopWidth: 1,
                                    borderTopColor: colors.border,
                                    backgroundColor: colors.input,
                                }}>
                                    <Text style={{ color: colors.textSecondary }}>
                                        Replying to{' '}
                                        <Text style={{ fontWeight: 'bold' }}>
                                            {replyingTo.user?.user_name || replyingTo.user?.name || 'Anonymous'}
                                        </Text>
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setReplyingTo(null);
                                            setNewComment('');
                                        }}
                                        style={{
                                            padding: 4,
                                            borderRadius: 12,
                                            backgroundColor: colors.border,
                                        }}
                                    >
                                        <X size={16} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Input field */}
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
                            >
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    backgroundColor: colors.background,
                                    borderTopWidth: 1,
                                    borderTopColor: colors.border,
                                }}>
                                    <TextInput
                                        ref={commentInputRef}
                                        value={newComment}
                                        onChangeText={setNewComment}
                                        placeholder="Add a comment..."
                                        placeholderTextColor={colors.textMuted}
                                        style={{
                                            flex: 1,
                                            marginRight: 10,
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            backgroundColor: colors.input,
                                            color: colors.text,
                                            fontSize: 14,
                                            height: 40,
                                        }}
                                    />
                                    <TouchableOpacity
                                        onPress={handleSubmitComment}
                                        disabled={!newComment.trim()}
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            backgroundColor: colors.success,
                                            opacity: newComment.trim() ? 1 : 0.5,
                                        }}
                                    >
                                        <Send size={18} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </View>
                </View>
            )}

            {/* Edit Blog Modal */}
            {editModalVisible && (
                <BlogPostCreator
                    visible={editModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    onPost={handleUpdateBlog}
                    loading={editLoading}
                    initialData={prepareCurrentBlogForEditor()}
                    isEditMode={true}
                    isDark={isDark}
                />
            )}
        </>
    );
};

export default Blog;