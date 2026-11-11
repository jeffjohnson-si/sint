import 'app_user.dart';

class PostMedia {
  const PostMedia({required this.type, required this.url, this.thumbnailUrl = ''});

  factory PostMedia.fromJson(Map<String, dynamic> json) => PostMedia(
    type: (json['type'] as String?) ?? 'image',
    url: (json['url'] as String?) ?? '',
    thumbnailUrl: (json['thumbnailUrl'] as String?) ?? '',
  );

  final String type;
  final String url;
  final String thumbnailUrl;

  bool get isVideo => type == 'video';

  Map<String, dynamic> toJson() => {
    'type': type,
    'url': url,
    if (thumbnailUrl.isNotEmpty) 'thumbnailUrl': thumbnailUrl,
  };
}

class Post {
  const Post({
    required this.id,
    required this.author,
    required this.content,
    required this.createdAt,
    this.category = '',
    this.location = '',
    this.media = const [],
    this.likeCount = 0,
    this.commentCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.isOwner = false,
  });

  factory Post.fromJson(Map<String, dynamic> json) => Post(
    id: json['id'] as String,
    author: AppUser.fromJson((json['author'] as Map<String, dynamic>?) ?? const {'id': '', 'fullName': 'Unknown'}),
    content: (json['content'] as String?) ?? '',
    category: (json['category'] as String?) ?? '',
    location: (json['location'] as String?) ?? '',
    media: ((json['media'] as List<dynamic>?) ?? const [])
        .map((item) => PostMedia.fromJson(item as Map<String, dynamic>))
        .toList(growable: false),
    likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
    commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
    isLiked: (json['isLiked'] as bool?) ?? false,
    isSaved: (json['isSaved'] as bool?) ?? false,
    isOwner: (json['isOwner'] as bool?) ?? false,
    createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '')?.toLocal() ?? DateTime.now(),
  );

  final String id;
  final AppUser author;
  final String content;
  final String category;
  final String location;
  final List<PostMedia> media;
  final int likeCount;
  final int commentCount;
  final bool isLiked;
  final bool isSaved;
  final bool isOwner;
  final DateTime createdAt;

  List<PostMedia> get images => media.where((item) => !item.isVideo).toList(growable: false);
  PostMedia? get video => media.where((item) => item.isVideo).firstOrNull;

  Post copyWith({
    AppUser? author,
    bool? isLiked,
    bool? isSaved,
    int? likeCount,
    int? commentCount,
  }) => Post(
    id: id,
    author: author ?? this.author,
    content: content,
    category: category,
    location: location,
    media: media,
    likeCount: likeCount ?? this.likeCount,
    commentCount: commentCount ?? this.commentCount,
    isLiked: isLiked ?? this.isLiked,
    isSaved: isSaved ?? this.isSaved,
    isOwner: isOwner,
    createdAt: createdAt,
  );
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
