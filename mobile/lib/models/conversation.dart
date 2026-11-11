import 'app_user.dart';
import 'post.dart';

class Conversation {
  const Conversation({
    required this.id,
    required this.otherUser,
    required this.updatedAt,
    this.lastMessageText = '',
    this.lastMessageAt,
    this.unreadCount = 0,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    final last = json['lastMessage'] as Map<String, dynamic>?;
    return Conversation(
      id: json['id'] as String,
      otherUser: AppUser.fromJson(
        (json['otherUser'] as Map<String, dynamic>?) ?? const {'id': '', 'fullName': 'Unknown'},
      ),
      lastMessageText: (last?['text'] as String?) ?? '',
      lastMessageAt: DateTime.tryParse((last?['at'] as String?) ?? '')?.toLocal(),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      updatedAt:
          DateTime.tryParse((json['updatedAt'] as String?) ?? '')?.toLocal() ?? DateTime.now(),
    );
  }

  final String id;
  final AppUser otherUser;
  final String lastMessageText;
  final DateTime? lastMessageAt;
  final int unreadCount;
  final DateTime updatedAt;

  Conversation copyWith({int? unreadCount}) => Conversation(
    id: id,
    otherUser: otherUser,
    lastMessageText: lastMessageText,
    lastMessageAt: lastMessageAt,
    unreadCount: unreadCount ?? this.unreadCount,
    updatedAt: updatedAt,
  );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.isMine,
    required this.text,
    required this.createdAt,
    this.media = const [],
    this.readAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id'] as String,
    conversationId: (json['conversationId'] as String?) ?? '',
    senderId: (json['senderId'] as String?) ?? '',
    isMine: (json['isMine'] as bool?) ?? false,
    text: (json['text'] as String?) ?? '',
    media: ((json['media'] as List<dynamic>?) ?? const [])
        .map((item) => PostMedia.fromJson(item as Map<String, dynamic>))
        .toList(growable: false),
    readAt: DateTime.tryParse((json['readAt'] as String?) ?? '')?.toLocal(),
    createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '')?.toLocal() ?? DateTime.now(),
  );

  final String id;
  final String conversationId;
  final String senderId;
  final bool isMine;
  final String text;

  /// Images and videos sent with the message.
  final List<PostMedia> media;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isRead => readAt != null;
}
