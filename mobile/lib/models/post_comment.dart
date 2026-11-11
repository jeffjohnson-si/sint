import 'app_user.dart';
import 'post.dart';

class PostComment {
  const PostComment({
    required this.id,
    required this.postId,
    required this.author,
    required this.text,
    required this.createdAt,
    this.parentId,
    this.media = const [],
    this.likeCount = 0,
    this.replyCount = 0,
    this.isLiked = false,
    this.isOwner = false,
    this.replies = const [],
  });

  factory PostComment.fromJson(Map<String, dynamic> json) => PostComment(
    id: json['id'] as String,
    postId: (json['postId'] as String?) ?? '',
    parentId: json['parentId'] as String?,
    author: AppUser.fromJson(
      (json['author'] as Map<String, dynamic>?) ?? const {'id': '', 'fullName': 'Unknown'},
    ),
    text: (json['text'] as String?) ?? '',
    media: ((json['media'] as List<dynamic>?) ?? const [])
        .map((item) => PostMedia.fromJson(item as Map<String, dynamic>))
        .toList(growable: false),
    likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
    replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
    isLiked: (json['isLiked'] as bool?) ?? false,
    isOwner: (json['isOwner'] as bool?) ?? false,
    createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '')?.toLocal() ?? DateTime.now(),
    replies: ((json['replies'] as List<dynamic>?) ?? const [])
        .map((item) => PostComment.fromJson(item as Map<String, dynamic>))
        .toList(growable: false),
  );

  final String id;
  final String postId;
  final String? parentId;
  final AppUser author;
  final String text;
  final List<PostMedia> media;
  final int likeCount;
  final int replyCount;
  final bool isLiked;
  final bool isOwner;
  final DateTime createdAt;
  final List<PostComment> replies;

  PostComment copyWith({
    bool? isLiked,
    int? likeCount,
    String? text,
    List<PostComment>? replies,
    int? replyCount,
  }) => PostComment(
    id: id,
    postId: postId,
    parentId: parentId,
    author: author,
    text: text ?? this.text,
    media: media,
    likeCount: likeCount ?? this.likeCount,
    replyCount: replyCount ?? this.replyCount,
    isLiked: isLiked ?? this.isLiked,
    isOwner: isOwner,
    createdAt: createdAt,
    replies: replies ?? this.replies,
  );
}
