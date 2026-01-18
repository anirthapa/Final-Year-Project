import {Alert, Image, Keyboard, Platform, Pressable, Text, TextInput, TouchableOpacity, View, BackHandler} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {ChevronDown, ChevronUp, Edit, Heart, MoreHorizontal, Reply, Send, Trash} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {AnimatePresence, MotiView} from 'moti';
import {addComment, deleteComment, updateComment} from '../services/commentService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {router} from "expo-router";
import {useSelector} from 'react-redux';

const MAX_NESTING_DEPTH = 3;

const Comment = ({
                     comment, isDark, onReply, onLike, formatDate, refreshComments, blogId, closeCommentsModal
                 }) => {
    // Make sure comment is defined before using it
    if (!comment) {
        return null;
    }

    // Get current user from Redux
    const userDetails = useSelector((state) => state.user);
    const currentUser = userDetails || {};

    const insets = useSafeAreaInsets();
    const inputRef = useRef(null);

    // States - with safe defaults to prevent undefined errors
    const [isLiked, setIsLiked] = useState(comment.isLiked || false);
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showReplies, setShowReplies] = useState(true);
    const [isOptionsVisible, setIsOptionsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.content || comment.text || '');
    const [likesCount, setLikesCount] = useState(comment.likes || 0);

    // Calculate depth based on whether this is a reply
    const depth = comment.parent_id ? 1 : 0;

    // Safely extract user data
    const userName = comment.user?.user_name || comment.user?.name || 'Anonymous';
    const userId = comment.user?.user_id || comment.user?.id;
    const userAvatar = comment.user?.avatar || 'https://via.placeholder.com/40';
    const commentText = comment.content || comment.text || '';
    const commentTime = formatDate ? formatDate(comment.createdAt || comment.time) : (comment.time || 'Recently');

    // Check if current user is the comment author (with null checking)
    const isCommentAuthor = currentUser && currentUser.user_id && (userId && currentUser?.user_id === userId);

    // Get replies safely
    const replies = comment.replies || [];

    // Theme colors
    const colors = {
        background: isDark ? '#0F172A' : '#FFFFFF',
        card: isDark ? '#1F2937' : '#F9FAFB',
        border: isDark ? '#374151' : '#E5E7EB',
        input: isDark ? '#1F2937' : '#F9FAFB',
        text: isDark ? '#F9FAFB' : '#1F2937',
        textSecondary: isDark ? '#D1D5DB' : '#4B5563',
        textMuted: isDark ? '#9CA3AF' : '#6B7280',
        overlay: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
        success: '#7C3AED',
        danger: '#EF4444',
    };

    // Handle Android back button for options menu
    useEffect(() => {
        if (!isOptionsVisible) return;

        const backAction = () => {
            setIsOptionsVisible(false);
            return true;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [isOptionsVisible]);

    // Handle profile navigation
    const navigateToProfile = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (closeCommentsModal) {
            closeCommentsModal();
        }

        setTimeout(() => {
            if (currentUser?.user_id == userId) {
                router.push('/profile');
            } else {
                router.push({
                    pathname: `/(profile)/${userId}`,
                    params: {
                        name: userName || ''
                    }
                });
            }
        }, 100);
    };

    // Handle like
    const handleLike = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const newIsLiked = !isLiked;
        setIsLiked(newIsLiked);
        setLikesCount(newIsLiked ? likesCount + 1 : likesCount - 1);

        if (onLike && typeof onLike === 'function') {
            onLike(comment.comment_id || comment.id, newIsLiked);
        }
    };

    // Handle reply button click
    const handleReply = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (onReply && typeof onReply === 'function') {
            onReply(comment);
            return;
        }

        setShowReplyInput(!showReplyInput);

        if (!showReplyInput) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    // Submit a reply
    const submitReply = async () => {
        if (!replyText.trim()) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const commentData = {
                content: replyText,
                parent_id: comment.comment_id || comment.id
            };

            const response = await addComment(blogId, commentData);

            if (response && response.success) {
                setReplyText('');
                setShowReplyInput(false);
                refreshComments();
                Keyboard.dismiss();
            } else {
                Alert.alert('Error', 'Failed to add reply');
            }
        } catch (error) {
            console.error('Error adding reply:', error);
            Alert.alert('Error', 'Failed to add reply');
        }
    };

    // Toggle showing replies
    const toggleReplies = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowReplies(!showReplies);
    };

    // Start editing comment
    const startEditing = () => {
        setIsEditing(true);
        setIsOptionsVisible(false);

        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    // Cancel editing
    const cancelEditing = () => {
        setIsEditing(false);
        setEditText(comment.content || comment.text || '');
        Keyboard.dismiss();
    };

    // Save edited comment
    const saveEditedComment = async () => {
        if (!editText.trim()) return;

        try {
            const response = await updateComment(comment.comment_id || comment.id, {
                content: editText
            });

            if (response && response.success) {
                setIsEditing(false);
                refreshComments();
                Keyboard.dismiss();
            } else {
                Alert.alert('Error', 'Failed to update comment');
            }
        } catch (error) {
            console.error('Error updating comment:', error);
            Alert.alert('Error', 'Failed to update comment');
        }
    };

    // Confirm deletion
    const confirmDeleteComment = () => {
        setIsOptionsVisible(false);
        Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
            {
                text: 'Cancel', style: 'cancel'
            },
            {
                text: 'Delete', style: 'destructive', onPress: handleDeleteComment
            }
        ]);
    };

    // Delete comment
    const handleDeleteComment = async () => {
        try {
            const response = await deleteComment(comment.comment_id || comment.id);

            if (response && response.success) {
                refreshComments();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Alert.alert('Error', 'Failed to delete comment');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            Alert.alert('Error', 'Failed to delete comment');
        }
    };

    return (
        <>
            <View
                style={{
                    marginBottom: 16,
                    marginLeft: depth > 0 ? 28 : 0,
                    paddingLeft: depth > 0 ? 16 : 0,
                    borderLeftWidth: depth > 0 ? 2 : 0,
                    borderLeftColor: colors.border,
                }}
            >
                {/* Main Comment */}
                <MotiView
                    from={{opacity: 0, translateY: 10}}
                    animate={{opacity: 1, translateY: 0}}
                    transition={{type: 'timing', duration: 300}}
                >
                    {/* User Info and Comment */}
                    <View style={{flexDirection: 'row', gap: 12}}>
                        {/* Avatar */}
                        <TouchableOpacity
                            onPress={navigateToProfile}
                            disabled={!userId}
                            activeOpacity={0.8}
                            style={{
                                padding: 2,
                                borderRadius: 20,
                                overflow: 'hidden'
                            }}
                        >
                            <Image
                                source={{uri: userAvatar}}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: colors.card,
                                }}
                            />
                        </TouchableOpacity>

                        {/* Comment Content */}
                        <View style={{flex: 1}}>
                            {isEditing ? (
                                <View style={{marginBottom: 8}}>
                                    <TextInput
                                        ref={inputRef}
                                        value={editText}
                                        onChangeText={setEditText}
                                        style={{
                                            backgroundColor: colors.input,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            borderRadius: 12,
                                            paddingHorizontal: 14,
                                            paddingVertical: 10,
                                            minHeight: 80,
                                            fontSize: 15,
                                            color: colors.text,
                                            textAlignVertical: 'top',
                                            ...(Platform.OS === 'android' && {
                                                elevation: 1,
                                            })
                                        }}
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        maxLength={500}
                                        autoFocus={true}
                                    />
                                    <View style={{
                                        flexDirection: 'row',
                                        justifyContent: 'flex-end',
                                        marginTop: 10,
                                        gap: 8
                                    }}>
                                        <TouchableOpacity
                                            onPress={cancelEditing}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 8,
                                                backgroundColor: colors.card,
                                                ...(Platform.OS === 'android' && {elevation: 2})
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '500',
                                                color: colors.textSecondary
                                            }}>
                                                Cancel
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={saveEditedComment}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 8,
                                                backgroundColor: colors.success,
                                                ...(Platform.OS === 'android' && {elevation: 2})
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '500',
                                                color: '#FFFFFF'
                                            }}>Save</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    {/* Comment Bubble */}
                                    <View
                                        style={{
                                            backgroundColor: colors.card,
                                            borderRadius: 12,
                                            padding: 12,
                                            ...(Platform.OS === 'android' && {
                                                elevation: 1,
                                            }),
                                            ...(Platform.OS === 'ios' && {
                                                shadowColor: '#000',
                                                shadowOpacity: 0.05,
                                                shadowRadius: 2,
                                                shadowOffset: { width: 0, height: 1 },
                                            })
                                        }}
                                    >
                                        {/* Username and Options */}
                                        <View style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 4
                                        }}>
                                            <TouchableOpacity
                                                onPress={navigateToProfile}
                                                disabled={!userId}
                                                activeOpacity={0.7}
                                                style={{paddingVertical: 2}}
                                            >
                                                <Text style={{
                                                    fontWeight: '600',
                                                    fontSize: 14,
                                                    color: colors.text
                                                }}>
                                                    {userName}
                                                </Text>
                                            </TouchableOpacity>

                                            {isCommentAuthor && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        setIsOptionsVisible(!isOptionsVisible);
                                                    }}
                                                    style={{
                                                        padding: 4,
                                                        borderRadius: 6,
                                                        marginRight: -4
                                                    }}
                                                >
                                                    <MoreHorizontal
                                                        size={16}
                                                        color={colors.textMuted}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Comment Text */}
                                        <Text style={{
                                            fontSize: 15,
                                            lineHeight: 20,
                                            color: colors.textSecondary
                                        }}>
                                            {commentText}
                                        </Text>
                                    </View>

                                    {/* Actions Row */}
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginTop: 6,
                                        paddingLeft: 2,
                                        gap: 16
                                    }}>
                                        <Text style={{
                                            fontSize: 12,
                                            color: colors.textMuted
                                        }}>
                                            {commentTime}
                                        </Text>

                                        {/* Like Button */}
                                        <MotiView
                                            animate={{scale: isLiked ? [1, 1.2, 1] : 1}}
                                            transition={{type: 'spring', damping: 10}}
                                        >
                                            <TouchableOpacity
                                                onPress={handleLike}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 6
                                                }}
                                            >
                                                <Heart
                                                    size={14}
                                                    color={isLiked ? colors.success : colors.textMuted}
                                                    fill={isLiked ? colors.success : 'none'}
                                                />
                                                <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: '500',
                                                    color: isLiked ? colors.success : colors.textMuted
                                                }}>
                                                    {likesCount}
                                                </Text>
                                            </TouchableOpacity>
                                        </MotiView>

                                        {/* Reply Button */}
                                        {depth < MAX_NESTING_DEPTH && (
                                            <TouchableOpacity
                                                onPress={handleReply}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 6
                                                }}
                                            >
                                                <Reply
                                                    size={14}
                                                    color={colors.textMuted}
                                                />
                                                <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: '500',
                                                    color: colors.textMuted
                                                }}>
                                                    Reply
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </>
                            )}

                            {/* Reply Input */}
                            <AnimatePresence>
                                {showReplyInput && (
                                    <MotiView
                                        from={{opacity: 0, height: 0}}
                                        animate={{opacity: 1, height: 'auto'}}
                                        exit={{opacity: 0, height: 0}}
                                        style={{marginTop: 8}}
                                    >
                                        <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 6}}>
                                            <TextInput
                                                ref={inputRef}
                                                value={replyText}
                                                onChangeText={setReplyText}
                                                placeholder="Write a reply..."
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: colors.input,
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                    borderRadius: 12,
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 8,
                                                    fontSize: 14,
                                                    color: colors.text,
                                                    textAlignVertical: 'top',
                                                    ...(Platform.OS === 'android' && {
                                                        elevation: 1,
                                                    })
                                                }}
                                                placeholderTextColor={colors.textMuted}
                                                multiline
                                                maxLength={500}
                                                autoFocus={true}
                                            />
                                            <TouchableOpacity
                                                onPress={submitReply}
                                                disabled={!replyText.trim()}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 18,
                                                    backgroundColor: replyText.trim() ? colors.success : colors.card,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    ...(Platform.OS === 'android' && {elevation: 2})
                                                }}
                                            >
                                                <Send
                                                    size={16}
                                                    color={replyText.trim() ? '#FFFFFF' : colors.textMuted}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </MotiView>
                                )}
                            </AnimatePresence>
                        </View>
                    </View>
                </MotiView>

                {/* Nested Replies */}
                {replies.length > 0 && (
                    <View style={{marginTop: 12}}>
                        {/* Show/Hide Replies Button */}
                        <TouchableOpacity
                            onPress={toggleReplies}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 4,
                                marginLeft: 48,
                                paddingLeft: 2
                            }}
                        >
                            {showReplies ? (
                                <ChevronUp size={14} color={colors.success} style={{marginRight: 2}} />
                            ) : (
                                <ChevronDown size={14} color={colors.success} style={{marginRight: 2}} />
                            )}
                            <Text style={{
                                fontSize: 12,
                                fontWeight: '500',
                                color: colors.success
                            }}>
                                {showReplies ? 'Hide replies' : `Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                            </Text>
                        </TouchableOpacity>

                        {/* Nested Replies List */}
                        <AnimatePresence key={`replies-${comment.id || comment.comment_id}`}>
                            {showReplies && (
                                <MotiView
                                    from={{opacity: 0}}
                                    animate={{opacity: 1}}
                                    exit={{opacity: 0}}
                                >
                                    {replies.map((reply) => (
                                        <Comment
                                            key={reply.comment_id || reply.id}
                                            comment={reply}
                                            isDark={isDark}
                                            onReply={onReply}
                                            onLike={onLike}
                                            formatDate={formatDate}
                                            refreshComments={refreshComments}
                                            blogId={blogId}
                                            closeCommentsModal={closeCommentsModal}
                                        />
                                    ))}
                                </MotiView>
                            )}
                        </AnimatePresence>
                    </View>
                )}
            </View>

            {/* Options Menu Overlay - FIXED POSITIONING */}
            {isOptionsVisible && (
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
                    {/* Background Overlay - Close on tap */}
                    <Pressable
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                        }}
                        onPress={() => setIsOptionsVisible(false)}
                    />

                    {/* Options Menu */}
                    <MotiView
                        from={{opacity: 0, scale: 0.9}}
                        animate={{opacity: 1, scale: 1}}
                        exit={{opacity: 0, scale: 0.9}}
                        transition={{type: 'spring', damping: 18}}
                        style={{
                            backgroundColor: colors.background,
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 280,
                            overflow: 'hidden',
                            ...(Platform.OS === 'android' && {
                                elevation: 10,
                            }),
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
                                Comment Options
                            </Text>
                        </View>

                        {/* Options */}
                        <View style={{padding: 4}}>
                            <TouchableOpacity
                                onPress={startEditing}
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
                                        Edit Comment
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: colors.textMuted
                                    }}>
                                        Make changes to your comment
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={confirmDeleteComment}
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
                                <View style={{
                                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                    padding: 8,
                                    borderRadius: 20,
                                    marginRight: 12,
                                }}>
                                    <Trash size={18} color={colors.danger} />
                                </View>
                                <View>
                                    <Text style={{
                                        fontSize: 15,
                                        fontWeight: '600',
                                        color: colors.danger
                                    }}>
                                        Delete Comment
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: colors.textMuted
                                    }}>
                                        Remove this comment permanently
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Cancel Button */}
                        <TouchableOpacity
                            style={{
                                width: '100%',
                                paddingVertical: 14,
                                backgroundColor: colors.card,
                                alignItems: 'center',
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => setIsOptionsVisible(false)}
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
        </>
    );
};

export default Comment;