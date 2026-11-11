import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../models/app_notification.dart';
import '../../providers/messages_provider.dart';
import '../../providers/notifications_provider.dart';
import '../../widgets/common.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationsProvider>().load();
    });
  }

  /// Sends the user to whatever the notification refers to.
  Future<void> _open(AppNotification notification) async {
    final notifications = context.read<NotificationsProvider>();
    await notifications.markRead(notification);
    if (!mounted) return;

    if (notification.conversationId != null && notification.actor != null) {
      final conversation = await context.read<MessagesProvider>().openWithUser(
        notification.actor!.id,
      );
      if (!mounted || conversation == null) return;
      await AppNavigator.openChat(context, conversation.id, notification.actor!);
      return;
    }

    if (notification.postId != null) {
      await AppNavigator.openPostById(context, notification.postId!);
      return;
    }

    if (notification.actor != null) {
      await AppNavigator.openProfile(context, notification.actor!.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notifications = context.watch<NotificationsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (notifications.unreadCount > 0)
            TextButton(
              onPressed: notifications.markAllRead,
              child: const Text('Mark all as read'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: notifications.loading && notifications.items.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : notifications.items.isEmpty
                ? const EmptyState(
                    icon: Icons.notifications_none,
                    title: 'No notifications yet',
                    message: 'Likes, comments, follows and messages will show up here.',
                  )
                : RefreshIndicator(
                    color: AppColors.black,
                    onRefresh: notifications.load,
                    child: ListView.separated(
                      itemCount: notifications.items.length,
                      separatorBuilder: (_, _) => const Divider(indent: 72),
                      itemBuilder: (context, index) {
                        final notification = notifications.items[index];
                        return ListTile(
                          onTap: () => _open(notification),
                          tileColor: notification.read ? null : AppColors.grey100,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          leading: Container(
                            height: 40,
                            width: 40,
                            decoration: BoxDecoration(
                              color: notification.color.withValues(alpha: 0.12),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(notification.icon, size: 20, color: notification.color),
                          ),
                          title: Text(
                            notification.text.isEmpty
                                ? '${notification.actor?.fullName ?? 'Someone'} interacted with you'
                                : notification.text,
                            style: TextStyle(
                              fontWeight: notification.read ? FontWeight.w400 : FontWeight.w600,
                            ),
                          ),
                          subtitle: Text(
                            Formatters.timeAgo(notification.createdAt),
                            style: const TextStyle(fontSize: 12, color: AppColors.grey500),
                          ),
                          trailing: notification.read
                              ? null
                              : Container(
                                  height: 8,
                                  width: 8,
                                  decoration: const BoxDecoration(
                                    color: AppColors.black,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                        );
                      },
                    ),
                  ),
      ),
    );
  }
}
