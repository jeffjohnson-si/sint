import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'app_user.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.text,
    required this.createdAt,
    required this.read,
    this.actor,
    this.postId,
    this.commentId,
    this.conversationId,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
    id: json['id'] as String,
    type: (json['type'] as String?) ?? 'like',
    text: (json['text'] as String?) ?? '',
    actor: json['actor'] == null
        ? null
        : AppUser.fromJson(json['actor'] as Map<String, dynamic>),
    postId: json['postId'] as String?,
    commentId: json['commentId'] as String?,
    conversationId: json['conversationId'] as String?,
    read: (json['read'] as bool?) ?? false,
    createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '')?.toLocal() ?? DateTime.now(),
  );

  final String id;
  final String type;
  final String text;
  final AppUser? actor;
  final String? postId;
  final String? commentId;
  final String? conversationId;
  final bool read;
  final DateTime createdAt;

  Color get color => switch (type) {
    'like' => AppColors.like,
    'comment' => AppColors.comment,
    'follow' => AppColors.follow,
    'message' => AppColors.message,
    _ => AppColors.grey500,
  };

  IconData get icon => switch (type) {
    'like' => Icons.favorite,
    'comment' => Icons.chat_bubble,
    'follow' => Icons.person_add_alt_1,
    'message' => Icons.mail,
    _ => Icons.notifications,
  };
}
