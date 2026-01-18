// cron.js
const cron = require('node-cron');
const streakController = require('./controllers/streakController');
const { ReminderService } = require('./services/reminderService');
const notificationService = require('./controllers/pushNotificationController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Initialize the reminder service
const reminderService = new ReminderService();

/**
 * Enhanced logging function with colorized console output
 * @param {string} jobName - Name of the cron job
 * @param {string} status - Status of the job (started/completed/failed/warning)
 * @param {Object} details - Additional details to log
 */
function logJobStatus(jobName, status, details = {}) {
    const timestamp = new Date().toISOString();
    const logObject = {
        timestamp,
        job: jobName,
        status,
        ...details
    };

    // Colorized console output
    let statusColor;
    switch (status) {
        case 'started':
            statusColor = '\x1b[34m'; // Blue
            break;
        case 'completed':
            statusColor = '\x1b[32m'; // Green
            break;
        case 'failed':
            statusColor = '\x1b[31m'; // Red
            break;
        case 'warning':
            statusColor = '\x1b[33m'; // Yellow
            break;
        default:
            statusColor = '\x1b[0m'; // Reset
    }

    console.log(`${statusColor}[${timestamp}][${jobName}][${status}]\x1b[0m`, JSON.stringify(details, null, 2));
}

/**
 * Create notification with appropriate type and send push notification
 * @param {Object} data - Notification data
 */
async function createNotification(data) {
    try {
        // First, create the notification in database
        const notification = await prisma.notification.create({
            data: {
                user_id: data.user_id,
                title: data.title,
                content: data.content,
                type: data.type,
                related_id: data.related_id || null,
                action_url: data.action_url || null,
                is_read: false
            }
        });

        // Then, send push notification to user's devices
        await notificationService.sendToUser(
            data.user_id,
            data.title,
            data.content,
            {
                type: data.type,
                relatedId: data.related_id,
                actionUrl: data.action_url,
                notificationId: notification.id
            }
        );

        return notification;
    } catch (error) {
        console.error(`Error creating notification: ${error.message}`);
    }
}

/**
 * Create a streak warning notification
 * @param {number} userId - User ID
 * @param {string} habitName - Habit name
 * @param {number} currentStreak - Current streak
 * @param {number} habitId - Habit ID
 */
async function createStreakWarningNotification(userId, habitName, currentStreak, habitId) {
    try {
        await createNotification({
            user_id: userId,
            title: 'Streak at Risk!',
            content: `Your ${currentStreak}-day streak for "${habitName}" will be reset if you don't complete it today!`,
            type: 'STREAK_MILESTONE',
            related_id: habitId,
            action_url: `/habits/${habitId}`
        });

        // Also create a scheduled reminder with high priority
        const now = new Date();
        const reminderTime = new Date(now);
        reminderTime.setHours(20, 0, 0); // Set reminder for 8:00 PM

        // Only create reminder if it's earlier than 8 PM
        if (now < reminderTime) {
            await prisma.scheduledReminder.create({
                data: {
                    habit_id: habitId,
                    user_id: userId,
                    scheduled_time: reminderTime,
                    reminder_type: 'STREAK_WARNING',
                    message: `⚠️ STREAK ALERT: Your ${currentStreak}-day streak for "${habitName}" will be reset tonight if not completed!`,
                    is_sent: false,
                    is_prepared: true,
                    metadata: {
                        priority: 'high',
                        streakLength: currentStreak,
                        habitName: habitName
                    }
                }
            });
        }
    } catch (error) {
        console.error(`Error creating streak warning notification: ${error.message}`);
    }
}

/**
 * Create a grace period notification
 */
async function createGracePeriodNotification(userId, habitName, streakCount, habitId) {
    await createNotification({
        user_id: userId,
        title: 'Grace Period Used',
        content: `You missed "${habitName}" yesterday. Your streak is safe for now, but you need to complete it today to keep your ${streakCount} day streak!`,
        type: 'SYSTEM_MESSAGE',
        related_id: habitId,
        action_url: `/habits/${habitId}`
    });
}

/**
 * Create a streak reset notification
 */
async function createStreakResetNotification(userId, habitName, streakBroken, habitId) {
    await createNotification({
        user_id: userId,
        title: 'Streak Reset',
        content: `Your ${streakBroken} day streak for "${habitName}" has been reset because you didn't complete it yesterday.`,
        type: 'SYSTEM_MESSAGE',
        related_id: habitId,
        action_url: `/habits/${habitId}`
    });
}

/**
 * Create a weekly summary notification
 */
async function createWeeklySummaryNotification(userId, completedCount, topHabits) {
    // Format top habits text
    let topHabitsText = "";
    if (topHabits && topHabits.length > 0) {
        const topHabitsList = topHabits.slice(0, 3).map(h =>
            `${h.name} (${h.count} times)`
        ).join(", ");
        topHabitsText = `Top habits: ${topHabitsList}`;
    } else {
        topHabitsText = "No habits completed this week.";
    }

    let emoji = '📊';
    let message = `You completed ${completedCount} habits this week! ${topHabitsText}`;

    // Add encouragement based on completion count
    if (completedCount === 0) {
        emoji = '🌱';
        message += " Let's set some goals for next week!";
    } else if (completedCount < 5) {
        emoji = '👍';
        message += " You're making progress!";
    } else if (completedCount < 15) {
        emoji = '🎯';
        message += " Great consistency!";
    } else if (completedCount < 30) {
        emoji = '🔥';
        message += " You're on fire!";
    } else {
        emoji = '🏆';
        message += " Incredible dedication!";
    }

    await createNotification({
        user_id: userId,
        title: `Weekly Summary ${emoji}`,
        content: message,
        type: 'SYSTEM_MESSAGE',
        action_url: '/stats'
    });
}

// Process streaks daily at midnight
cron.schedule('0 0 * * *', async () => {
    const jobName = 'daily-streak-update';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();
        const result = await streakController.processDailyStreakUpdates();
        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            results: result.results,
            message: result.message
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Check for streak milestone notifications - Run after streak updates
cron.schedule('5 0 * * *', async () => {
    const jobName = 'streak-milestone-check';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();

        // Important streak milestones to check for notifications
        const milestones = [7, 14, 21, 30, 60, 90, 100, 180, 365];

        // Get all habits with their current streaks
        const habitsWithStreaks = await prisma.habit.findMany({
            where: {
                is_active: true
            },
            include: {
                streak: true,
                user: {
                    select: {
                        user_id: true,
                        prefersNotifications: true
                    }
                }
            }
        });

        let notificationsSent = 0;

        for (const habit of habitsWithStreaks) {
            if (!habit.streak || habit.streak.length === 0 || !habit.user.prefersNotifications) {
                continue;
            }

            const streak = habit.streak[0];

            // Check if the streak is at a milestone exactly (meaning it just reached this value)
            if (streak.current_streak > 0 && milestones.includes(streak.current_streak)) {
                // Create a special milestone notification
                await createNotification({
                    user_id: habit.user_id,
                    title: `${streak.current_streak}-Day Streak! 🔥`,
                    content: `Amazing! You've maintained your "${habit.name}" habit for ${streak.current_streak} days in a row! Keep going!`,
                    type: 'STREAK_MILESTONE',
                    related_id: habit.habit_id,
                    action_url: `/habits/${habit.habit_id}`
                });

                notificationsSent++;
            }
        }

        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            habitsChecked: habitsWithStreaks.length,
            milestoneNotificationsSent: notificationsSent
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Check habits at risk of losing streak - Run at 9 AM every day
cron.schedule('0 9 * * *', async () => {
    const jobName = 'streak-warning-check';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();

        // Get all active habits with streaks > 0
        const habitsAtRisk = await prisma.habit.findMany({
            where: {
                is_active: true
            },
            include: {
                streak: {
                    where: {
                        current_streak: {
                            gt: 2 // Only warn for streaks greater than 2 days
                        }
                    }
                },
                user: true
            }
        });

        let warningsCreated = 0;

        // Filter to habits that are scheduled for today but not yet completed
        for (const habit of habitsAtRisk) {
            // Skip if no streak or user is on vacation
            if (habit.streak.length === 0 || habit.user.onVacation) {
                continue;
            }

            const streak = habit.streak[0];
            const today = new Date();

            // Check if habit is scheduled for today
            const isScheduledToday = await reminderService.isHabitScheduledForDate(habit, today);
            if (!isScheduledToday) {
                continue;
            }

            // Check if habit is already completed today
            const isCompletedToday = await reminderService.isHabitCompletedForDate(
                habit.habit_id,
                habit.user_id,
                today
            );

            // If not completed and scheduled, send a warning
            if (!isCompletedToday) {
                await createStreakWarningNotification(
                    habit.user_id,
                    habit.name,
                    streak.current_streak,
                    habit.habit_id
                );
                warningsCreated++;
            }
        }

        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            habitsChecked: habitsAtRisk.length,
            warningsCreated: warningsCreated
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Process upcoming reminders every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    const jobName = 'process-reminders';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();

        // Find reminders that are due to be sent
        const now = new Date();
        const dueReminders = await prisma.scheduledReminder.findMany({
            where: {
                scheduled_time: { lte: now },
                is_sent: false,
                is_prepared: true
            },
            include: {
                habit: true,
                user: {
                    select: {
                        user_id: true,
                        prefersNotifications: true,
                        onVacation: true
                    }
                }
            }
        });

        const results = {
            processed: dueReminders.length,
            sent: 0,
            skipped: 0,
            failed: 0
        };

        // Process each reminder
        for (const reminder of dueReminders) {
            try {
                // Skip if user has disabled notifications or is on vacation
                if (!reminder.user.prefersNotifications || reminder.user.onVacation) {
                    await prisma.scheduledReminder.update({
                        where: { scheduled_reminder_id: reminder.scheduled_reminder_id },
                        data: {
                            is_sent: true,
                            actual_send_time: now,
                            send_status: 'SKIPPED',
                            failure_reason: 'User preferences or status'
                        }
                    });
                    results.skipped++;
                    continue;
                }

                // Check if habit is already completed today
                const isCompletedToday = await reminderService.isHabitCompletedForDate(
                    reminder.habit_id,
                    reminder.user_id,
                    now
                );

                if (isCompletedToday) {
                    await prisma.scheduledReminder.update({
                        where: { scheduled_reminder_id: reminder.scheduled_reminder_id },
                        data: {
                            is_sent: true,
                            actual_send_time: now,
                            send_status: 'SKIPPED',
                            failure_reason: 'Already completed'
                        }
                    });
                    results.skipped++;
                    continue;
                }

                // Create notification in database and send push notification
                const title = reminder.habit ? `Reminder: ${reminder.habit.name}` : 'Habit Reminder';
                const notification = await createNotification({
                    user_id: reminder.user_id,
                    title: title,
                    content: reminder.message,
                    type: 'REMINDER',
                    related_id: reminder.habit_id,
                    action_url: `/habits/${reminder.habit_id}`
                });

                // Mark reminder as sent
                await prisma.scheduledReminder.update({
                    where: { scheduled_reminder_id: reminder.scheduled_reminder_id },
                    data: {
                        is_sent: true,
                        actual_send_time: now,
                        notification_id: notification.id,
                        send_status: 'SENT'
                    }
                });

                results.sent++;
            } catch (error) {
                console.error(`Error processing reminder ${reminder.scheduled_reminder_id}:`, error);

                // Mark as failed
                await prisma.scheduledReminder.update({
                    where: { scheduled_reminder_id: reminder.scheduled_reminder_id },
                    data: {
                        send_status: 'FAILED',
                        failure_reason: error.message
                    }
                });

                results.failed++;
            }
        }

        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            processed: results.processed,
            sent: results.sent,
            skipped: results.skipped,
            failed: results.failed
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Generate immediate reminder for missed habits with high streak - every 2 hours from 10 AM to 8 PM
cron.schedule('0 10,12,14,16,18,20 * * *', async () => {
    const jobName = 'streak-preservation-reminder';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();

        // Get all active habits with high streaks (>7 days) that aren't completed today
        const highValueHabits = await prisma.habit.findMany({
            where: {
                is_active: true
            },
            include: {
                streak: {
                    where: {
                        current_streak: {
                            gt: 7 // High value streak
                        }
                    }
                },
                user: {
                    select: {
                        user_id: true,
                        user_name: true,
                        prefersNotifications: true,
                        onVacation: true,
                        timezone: true
                    }
                }
            }
        });

        let remindersCreated = 0;
        const now = new Date();

        for (const habit of highValueHabits) {
            // Skip if no streak or user is on vacation or doesn't want notifications
            if (habit.streak.length === 0 ||
                habit.user.onVacation ||
                !habit.user.prefersNotifications) {
                continue;
            }

            const streak = habit.streak[0];

            // Check if habit is scheduled for today
            const isScheduledToday = await reminderService.isHabitScheduledForDate(habit, now);
            if (!isScheduledToday) {
                continue;
            }

            // Check if habit is already completed today
            const isCompletedToday = await reminderService.isHabitCompletedForDate(
                habit.habit_id,
                habit.user_id,
                now
            );

            // If not completed and in quiet hours, don't send
            const inQuietHours = await reminderService.isInQuietHours(habit.user_id, now);
            // If not completed, scheduled, and not in quiet hours, send an urgent reminder
            if (!isCompletedToday && !inQuietHours) {
                // Check if we already sent a reminder in the last 2 hours
                const recentReminder = await prisma.scheduledReminder.findFirst({
                    where: {
                        habit_id: habit.habit_id,
                        user_id: habit.user_id,
                        reminder_type: 'STREAK_PRESERVATION',
                        scheduled_time: {
                            gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
                        }
                    }
                });

                if (!recentReminder) {
                    await prisma.scheduledReminder.create({
                        data: {
                            habit_id: habit.habit_id,
                            user_id: habit.user_id,
                            scheduled_time: now,
                            reminder_type: 'STREAK_PRESERVATION',
                            message: `🔥 Don't lose your ${streak.current_streak}-day streak for "${habit.name}"! Complete it now!`,
                            is_sent: false,
                            is_prepared: true,
                            metadata: {
                                priority: 'urgent',
                                streakLength: streak.current_streak,
                                habitName: habit.name,
                                habitColor: habit.color,
                                habitIcon: habit.icon
                            }
                        }
                    });

                    // Also create a notification with the REMINDER type instead of SYSTEM_MESSAGE
                    await createNotification({
                        user_id: habit.user_id,
                        title: 'Urgent Habit Reminder',
                        content: `🔥 Don't lose your ${streak.current_streak}-day streak for "${habit.name}"! Complete it now!`,
                        type: 'REMINDER',
                        related_id: habit.habit_id,
                        action_url: `/habits/${habit.habit_id}`
                    });

                    remindersCreated++;
                }
            }
        }

        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            habitsChecked: highValueHabits.length,
            remindersCreated: remindersCreated
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Prepare reminders for next day (once per day at 11 PM)
cron.schedule('0 23 * * *', async () => {
    const jobName = 'prepare-next-day-reminders';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();
        const result = await reminderService.prepareRemindersForNextDay();
        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            preparedCount: result.preparedCount
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Weekly review and analytics (Sunday at 9 AM)
cron.schedule('0 9 * * 0', async () => {
    const jobName = 'weekly-habit-review';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();

        // Get all active users
        const activeUsers = await prisma.user.findMany({
            where: {
                prefersNotifications: true,
                onVacation: false
            }
        });

        let reportsGenerated = 0;

        for (const user of activeUsers) {
            try {
                // Get last week's stats
                const today = new Date();
                const oneWeekAgo = new Date(today);
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

                // Get habit completion stats
                const completedHabits = await prisma.habitLog.groupBy({
                    by: ['habit_id'],
                    where: {
                        user_id: user.user_id,
                        completed: true,
                        completed_at: {
                            gte: oneWeekAgo,
                            lte: today
                        }
                    },
                    _count: {
                        habit_id: true
                    }
                });

                // Get habit names
                const habitIds = completedHabits.map(h => h.habit_id);
                const habits = await prisma.habit.findMany({
                    where: {
                        habit_id: {
                            in: habitIds
                        }
                    },
                    select: {
                        habit_id: true,
                        name: true
                    }
                });

                // Create a weekly summary notification
                const totalCompletions = completedHabits.reduce((sum, h) => sum + h._count.habit_id, 0);

                // Create topHabits array
                const topHabits = habits.map(habit => {
                    const count = completedHabits.find(ch => ch.habit_id === habit.habit_id)?._count.habit_id || 0;
                    return {
                        name: habit.name,
                        count: count
                    };
                }).sort((a, b) => b.count - a.count); // Sort by count desc

                await createWeeklySummaryNotification(user.user_id, totalCompletions, topHabits);
                reportsGenerated++;
            } catch (error) {
                console.error(`Error generating weekly report for user ${user.user_id}: ${error.message}`);
            }
        }

        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            usersProcessed: activeUsers.length,
            reportsGenerated
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Check for daily goals achievement - Run at 10 PM every day
cron.schedule('0 22 * * *', async () => {
    const jobName = 'daily-goal-check';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();

        // Get today's range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find users who completed habits today and met their daily goal
        const users = await prisma.user.findMany({
            where: {
                prefersNotifications: true,
                onVacation: false,
                dailyGoal: { gt: 0 }
            },
            select: {
                user_id: true,
                user_name: true,
                dailyGoal: true
            }
        });

        let notificationsSent = 0;

        for (const user of users) {
            // Count today's completed habits
            const completedCount = await prisma.habitLog.count({
                where: {
                    user_id: user.user_id,
                    completed: true,
                    completed_at: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });

            // If they met or exceeded their goal, send a congratulatory notification
            if (completedCount >= user.dailyGoal) {
                await createNotification({
                    user_id: user.user_id,
                    title: 'Daily Goal Achieved! 🎯',
                    content: `Congratulations! You've completed ${completedCount}/${user.dailyGoal} habits today. Keep up the great work!`,
                    type: 'ACHIEVEMENT_UNLOCKED',
                    action_url: '/stats'
                });
                notificationsSent++;
            }
        }

        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            usersProcessed: users.length,
            notificationsSent: notificationsSent
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

// New user welcome notification - every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    const jobName = 'new-user-welcome';
    logJobStatus(jobName, 'started');

    try {
        const startTime = Date.now();

        // Look for users created in the last 30 minutes who haven't received a welcome notification
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const newUsers = await prisma.user.findMany({
            where: {
                registeredAt: {
                    gte: thirtyMinutesAgo
                },
                notifications: {
                    none: {
                        type: 'SYSTEM_MESSAGE',
                        title: {
                            contains: 'Welcome'
                        }
                    }
                }
            },
            select: {
                user_id: true,
                user_name: true
            }
        });

        let welcomesSent = 0;

        // Send welcome notifications to new users
        for (const user of newUsers) {
            try {
                // Create welcome notification
                await createNotification({
                    user_id: user.user_id,
                    title: 'Welcome to HabitPulse! 👋',
                    content: 'Start tracking your habits and build positive routines. We\'re excited to have you here!',
                    type: 'SYSTEM_MESSAGE',
                    action_url: '/dashboard'
                });
                welcomesSent++;
            } catch (error) {
                console.error(`Error creating welcome notification for user ${user.user_id}: ${error.message}`);
            }
        }

        const duration = Date.now() - startTime;

        logJobStatus(jobName, 'completed', {
            duration: `${duration}ms`,
            welcomeNotificationsSent: welcomesSent
        });
    } catch (error) {
        logJobStatus(jobName, 'failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * Manual testing functions for various notification types
 */
async function testStreakMilestoneNotification(userId, habitName, milestone, habitId) {
    await createNotification({
        user_id: userId,
        title: `${milestone}-Day Streak! 🔥`,
        content: `Amazing! You've maintained your "${habitName}" habit for ${milestone} days in a row!`,
        type: 'STREAK_MILESTONE',
        related_id: habitId,
        action_url: `/habits/${habitId}`
    });
}

async function testFriendRequestNotification(userId, senderName, requestId) {
    await createNotification({
        user_id: userId,
        title: 'New Friend Request',
        content: `${senderName} sent you a friend request`,
        type: 'SOCIAL_INTERACTION',
        related_id: requestId,
        action_url: `/friends/requests/${requestId}`
    });
}

async function testChallengeInviteNotification(userId, challengeName, challengerId, challengeId) {
    await createNotification({
        user_id: userId,
        title: 'Habit Challenge Invite',
        content: `You've been invited to join the "${challengeName}" challenge!`,
        type: 'CHALLENGE_INVITE',
        related_id: challengeId,
        action_url: `/challenges/${challengeId}`
    });
}

async function testQuoteOfTheDayNotification(userId) {
    const motivationalQuotes = [
        "Small steps lead to big changes.",
        "Consistency is the key to success.",
        "Every day is a new opportunity to improve.",
        "Your habits shape your future.",
        "Progress, not perfection."
    ];

    const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

    await createNotification({
        user_id: userId,
        title: 'Daily Motivation 💡',
        content: randomQuote,
        type: 'MOTIVATION_QUOTE',
        action_url: '/inspiration'
    });
}

async function testGoalReminderNotification(userId, habitName, habitId) {
    await createNotification({
        user_id: userId,
        title: 'Stay on Track 🎯',
        content: `Don't forget to work on your "${habitName}" habit today!`,
        type: 'GOAL_REMINDER',
        related_id: habitId,
        action_url: `/habits/${habitId}`
    });
}

async function testProgressUpdateNotification(userId, habitName, progressPercentage, habitId) {
    let progressMessage;
    let emoji;

    if (progressPercentage < 25) {
        progressMessage = "You're just getting started!";
        emoji = "🌱";
    } else if (progressPercentage < 50) {
        progressMessage = "Keep building momentum!";
        emoji = "🚀";
    } else if (progressPercentage < 75) {
        progressMessage = "You're making great progress!";
        emoji = "🔥";
    } else {
        progressMessage = "Almost there! Stay consistent!";
        emoji = "🏆";
    }

    await createNotification({
        user_id: userId,
        title: `${habitName} Progress Update ${emoji}`,
        content: `${progressMessage} You're ${progressPercentage}% towards your goal.`,
        type: 'PROGRESS_UPDATE',
        related_id: habitId,
        action_url: `/habits/${habitId}/progress`
    });
}

// Export these functions for testing purposes
module.exports = {
    testStreakMilestoneNotification,
    testFriendRequestNotification,
    testChallengeInviteNotification,
    testQuoteOfTheDayNotification,
    testGoalReminderNotification,
    testProgressUpdateNotification,
    // Add a new test function for reminders
    testHabitReminder: async (userId, habitId, message) => {
        // Get habit details
        const habit = await prisma.habit.findUnique({
            where: { habit_id: habitId }
        });

        if (!habit) {
            throw new Error(`Habit with ID ${habitId} not found`);
        }

        // Default message if not provided
        const reminderMessage = message || `Time to work on your habit: ${habit.name}!`;

        // Create notification and send push
        await createNotification({
            user_id: userId,
            title: `Reminder: ${habit.name}`,
            content: reminderMessage,
            type: 'REMINDER',
            related_id: habitId,
            action_url: `/habits/${habitId}`
        });

        return { success: true, message: 'Test reminder sent' };
    }
};