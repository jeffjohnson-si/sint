import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/app_user.dart';
import '../models/post.dart';
import '../providers/messages_provider.dart';
import '../screens/messages/chat_screen.dart';
import '../screens/messages/conversations_screen.dart';
import '../screens/notifications/notifications_screen.dart';
import '../screens/post/create_post_screen.dart';
import '../screens/post/post_detail_screen.dart';
import '../screens/profile/edit_profile_screen.dart';
import '../screens/profile/follow_list_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/search/search_screen.dart';
import '../screens/subscription/subscription_screen.dart';

/// Single place that knows how to reach every screen, so widgets stay dumb.
class AppNavigator {
  const AppNavigator._();

  static Future<void> openProfile(BuildContext context, String userId) {
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ProfileScreen(userId: userId)),
    );
  }

  static Future<void> openPost(BuildContext context, Post post, {bool focusComments = false}) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PostDetailScreen(postId: post.id, initialPost: post, focusComments: focusComments),
      ),
    );
  }

  static Future<void> openPostById(BuildContext context, String postId) {
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PostDetailScreen(postId: postId)),
    );
  }

  static Future<Post?> openCreatePost(BuildContext context, {Post? editing}) {
    return Navigator.of(context).push<Post>(
      MaterialPageRoute(builder: (_) => CreatePostScreen(editing: editing)),
    );
  }

  static Future<void> openEditProfile(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const EditProfileScreen()),
    );
  }

  /// Opens the followers or following list of [user].
  static Future<void> openFollowList(
    BuildContext context,
    AppUser user,
    FollowListKind kind,
  ) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FollowListScreen(userId: user.id, kind: kind, ownerName: user.fullName),
      ),
    );
  }


  static Future<void> openConversations(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ConversationsScreen()),
    );
  }

  static Future<void> openNotifications(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
    );
  }

  static Future<void> openSearch(BuildContext context, {String? initialQuery}) {
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => SearchScreen(initialQuery: initialQuery)),
    );
  }

  /// Opens the business plans screen. [message] explains why, when sent by a paywall.
  static Future<void> openSubscription(BuildContext context, {String? message}) {
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => SubscriptionScreen(message: message)),
    );
  }

  static Future<void> openChat(BuildContext context, String conversationId, AppUser otherUser) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatScreen(conversationId: conversationId, otherUser: otherUser),
      ),
    );
  }

  /// Opens (or creates) a direct conversation with [user].
  static Future<void> messageUser(BuildContext context, AppUser user) async {
    final messages = context.read<MessagesProvider>();
    final conversation = await messages.openWithUser(user.id);
    if (!context.mounted) return;

    if (conversation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(messages.error ?? 'Could not open that conversation')),
      );
      return;
    }
    await openChat(context, conversation.id, user);
  }
}
