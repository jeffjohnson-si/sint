import 'dart:typed_data';

import '../core/api_client.dart';
import '../models/app_notification.dart';
import '../models/app_user.dart';
import '../models/business_details.dart';
import '../models/conversation.dart';
import '../models/post.dart';
import '../models/post_comment.dart';
import '../models/subscription.dart';

class PagedResult<T> {
  const PagedResult({required this.items, required this.page, required this.hasMore, this.total = 0});

  final List<T> items;
  final int page;
  final bool hasMore;
  final int total;
}

class AuthResult {
  const AuthResult({required this.user, required this.accessToken, required this.refreshToken});

  final AppUser user;
  final String accessToken;
  final String refreshToken;
}

class UploadResult {
  const UploadResult({this.images = const [], this.video, this.avatarUrl, this.coverUrl});

  final List<PostMedia> images;
  final PostMedia? video;
  final String? avatarUrl;
  final String? coverUrl;
}

/// Plans plus the caller's billing state, as returned by `/subscription`.
class SubscriptionInfo {
  const SubscriptionInfo({
    required this.plans,
    required this.trialDays,
    required this.billingEnabled,
    this.state,
  });

  final List<SubscriptionPlan> plans;
  final int trialDays;

  /// False when the API has no Stripe key, so the UI can say so.
  final bool billingEnabled;
  final SubscriptionState? state;
}

/// Every SINT endpoint in one place, so widgets never build URLs themselves.
class SintApi {
  SintApi(this._client);

  final ApiClient _client;

  ApiClient get client => _client;

  // ---------------------------------------------------------------- auth

  Future<AuthResult> signUp({
    required String fullName,
    required String email,
    required String password,
    required String accountType,
    required bool acceptedTerms,
    BusinessDetails? business,
  }) async {
    final data = await _client.post('/auth/signup', body: {
      'fullName': fullName,
      'email': email,
      'password': password,
      'accountType': accountType,
      'acceptedTerms': acceptedTerms,
      if (business != null) ...business.toJson(),
    });
    return _authResult(data);
  }

  Future<AuthResult> signIn({required String email, required String password}) async {
    final data = await _client.post('/auth/login', body: {'email': email, 'password': password});
    return _authResult(data);
  }

  Future<AppUser> me() async {
    final data = await _client.get('/auth/me');
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<String> requestPasswordReset(String email) async {
    final data = await _client.post('/auth/forgot-password', body: {'email': email});
    return (data['message'] as String?) ?? 'If that account exists, a reset code has been sent';
  }

  /// Sends the 6-digit code and returns an access token if valid.
  Future<String> verifyResetCode(String email, String code) async {
    final data = await _client.post(
      '/auth/verify-code',
      body: {'email': email, 'code': code},
    );
    return data['accessToken'] as String;
  }

  /// Resets the password using the short-lived access token from verifyResetCode.
  Future<void> resetPassword(String password, {required String accessToken}) async {
    await _client.post(
      '/auth/reset-password',
      body: {'password': password},
      accessToken: accessToken,
    );
  }

  AuthResult _authResult(Map<String, dynamic> data) => AuthResult(
    user: AppUser.fromJson(data['user'] as Map<String, dynamic>),
    accessToken: data['accessToken'] as String,
    refreshToken: data['refreshToken'] as String,
  );

  /// Seeds the categories the viewer said they care about. Returns their
  /// interests, strongest first.
  Future<List<String>> saveInterests(List<String> categories) async {
    final data = await _client.post('/users/me/interests', body: {'categories': categories});
    return ((data['interests'] as List<dynamic>?) ?? const [])
        .map((item) => item as String)
        .toList(growable: false);
  }


  // --------------------------------------------------------------- posts

  Future<PagedResult<Post>> feed({
    String tab = 'for-you',
    String? category,
    String? query,
    String? authorId,
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _client.get('/posts', query: {
      'tab': tab,
      'category': category == 'All' ? null : category,
      'q': query,
      'author': authorId,
      'page': page,
      'limit': limit,
    });
    return _pagedPosts(data);
  }

  Future<PagedResult<Post>> userPosts(String userId, {int page = 1}) async {
    final data = await _client.get('/users/$userId/posts', query: {'page': page});
    return _pagedPosts(data);
  }

  Future<PagedResult<Post>> savedPosts({int page = 1}) async {
    final data = await _client.get('/users/me/saved', query: {'page': page});
    return _pagedPosts(data);
  }

  Future<PagedResult<Post>> likedPosts({int page = 1}) async {
    final data = await _client.get('/users/me/liked', query: {'page': page});
    return _pagedPosts(data);
  }

  Future<Post> post(String id) async {
    final data = await _client.get('/posts/$id');
    return Post.fromJson(data['post'] as Map<String, dynamic>);
  }

  Future<Post> createPost({
    required String content,
    required List<PostMedia> media,
    String? category,
    String? location,
  }) async {
    final data = await _client.post('/posts', body: {
      'content': content,
      'media': media.map((item) => item.toJson()).toList(),
      'category': ?category,
      'location': ?location,
    });
    return Post.fromJson(data['post'] as Map<String, dynamic>);
  }

  Future<Post> updatePost(
    String id, {
    String? content,
    List<PostMedia>? media,
    String? category,
    String? location,
  }) async {
    final data = await _client.patch('/posts/$id', body: {
      'content': ?content,
      if (media != null) 'media': media.map((item) => item.toJson()).toList(),
      'category': ?category,
      'location': ?location,
    });
    return Post.fromJson(data['post'] as Map<String, dynamic>);
  }

  Future<void> deletePost(String id) => _client.delete('/posts/$id');

  Future<Post> setLiked(String postId, bool liked) async {
    final data = liked
        ? await _client.post('/posts/$postId/like')
        : await _client.delete('/posts/$postId/like');
    return Post.fromJson(data['post'] as Map<String, dynamic>);
  }

  Future<Post> setSaved(String postId, bool saved) async {
    final data = saved
        ? await _client.post('/posts/$postId/save')
        : await _client.delete('/posts/$postId/save');
    return Post.fromJson(data['post'] as Map<String, dynamic>);
  }

  PagedResult<Post> _pagedPosts(Map<String, dynamic> data) => PagedResult<Post>(
    items: ((data['items'] as List<dynamic>?) ?? const [])
        .map((item) => Post.fromJson(item as Map<String, dynamic>))
        .toList(),
    page: (data['page'] as num?)?.toInt() ?? 1,
    hasMore: (data['hasMore'] as bool?) ?? false,
    total: (data['total'] as num?)?.toInt() ?? 0,
  );

  // ------------------------------------------------------------ comments

  Future<PagedResult<PostComment>> comments(String postId, {int page = 1}) async {
    final data = await _client.get('/posts/$postId/comments', query: {'page': page});
    return PagedResult<PostComment>(
      items: ((data['items'] as List<dynamic>?) ?? const [])
          .map((item) => PostComment.fromJson(item as Map<String, dynamic>))
          .toList(),
      page: (data['page'] as num?)?.toInt() ?? 1,
      hasMore: (data['hasMore'] as bool?) ?? false,
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }

  Future<PostComment> addComment(
    String postId,
    String text, {
    String? parentId,
    List<PostMedia> media = const [],
  }) async {
    final data = await _client.post('/posts/$postId/comments', body: {
      'text': text,
      'parentId': ?parentId,
      if (media.isNotEmpty) 'media': media.map((item) => item.toJson()).toList(),
    });
    return PostComment.fromJson(data['comment'] as Map<String, dynamic>);
  }

  Future<PostComment> setCommentLiked(String commentId, bool liked) async {
    final data = liked
        ? await _client.post('/comments/$commentId/like')
        : await _client.delete('/comments/$commentId/like');
    return PostComment.fromJson(data['comment'] as Map<String, dynamic>);
  }

  Future<void> deleteComment(String commentId) => _client.delete('/comments/$commentId');

  // ------------------------------------------------------------ profiles

  Future<AppUser> profile(String userId) async {
    final data = await _client.get('/users/$userId');
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<AppUser> updateProfile(Map<String, dynamic> changes) async {
    final data = await _client.patch('/users/me', body: changes);
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<AppUser> setFollowing(String userId, bool follow) async {
    final data = follow
        ? await _client.post('/users/$userId/follow')
        : await _client.delete('/users/$userId/follow');
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<List<AppUser>> followers(String userId) => _userList('/users/$userId/followers');

  Future<List<AppUser>> following(String userId) => _userList('/users/$userId/following');

  Future<List<AppUser>> _userList(String path) async {
    final data = await _client.get(path);
    return ((data['items'] as List<dynamic>?) ?? const [])
        .map((item) => AppUser.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }


  // -------------------------------------------------------------- search

  Future<PagedResult<AppUser>> searchBusinesses(String query, {String? category, int page = 1}) async {
    final data = await _client.get('/search', query: {
      'q': query,
      'category': category == 'All' ? null : category,
      'page': page,
    });
    return PagedResult<AppUser>(
      items: ((data['items'] as List<dynamic>?) ?? const [])
          .map((item) => AppUser.fromJson(item as Map<String, dynamic>))
          .toList(),
      page: (data['page'] as num?)?.toInt() ?? 1,
      hasMore: (data['hasMore'] as bool?) ?? false,
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }

  Future<List<String>> categories() async {
    final data = await _client.get('/search/categories');
    return ((data['items'] as List<dynamic>?) ?? const []).cast<String>();
  }

  // --------------------------------------------------------- suggestions

  /// Businesses picked for the viewer from the categories they interact with.
  Future<List<AppUser>> suggestions({int limit = 10}) async {
    final data = await _client.get('/suggestions', query: {'limit': limit});
    return ((data['items'] as List<dynamic>?) ?? const [])
        .map((item) => AppUser.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }


  // ------------------------------------------------------- conversations

  Future<List<Conversation>> conversations({String? query}) async {
    final data = await _client.get('/conversations', query: {'q': query});
    return ((data['items'] as List<dynamic>?) ?? const [])
        .map((item) => Conversation.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Conversation> openConversation(String userId) async {
    final data = await _client.post('/conversations', body: {'userId': userId});
    return Conversation.fromJson(data['conversation'] as Map<String, dynamic>);
  }

  Future<List<ChatMessage>> messages(String conversationId) async {
    final data = await _client.get('/conversations/$conversationId/messages');
    return ((data['items'] as List<dynamic>?) ?? const [])
        .map((item) => ChatMessage.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ChatMessage> sendMessage(
    String conversationId,
    String text, {
    List<PostMedia> media = const [],
  }) async {
    final data = await _client.post('/conversations/$conversationId/messages', body: {
      'text': text,
      if (media.isNotEmpty) 'media': media.map((item) => item.toJson()).toList(),
    });
    return ChatMessage.fromJson(data['message'] as Map<String, dynamic>);
  }

  Future<void> markConversationRead(String conversationId) =>
      _client.post('/conversations/$conversationId/read');

  // ------------------------------------------------------- subscription

  /// Plans on offer plus the signed in business's current billing state.
  Future<SubscriptionInfo> subscription() async {
    final data = await _client.get('/subscription');
    return SubscriptionInfo(
      plans: ((data['plans'] as List<dynamic>?) ?? const [])
          .map((item) => SubscriptionPlan.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
      trialDays: (data['trialDays'] as num?)?.toInt() ?? 0,
      billingEnabled: (data['billingEnabled'] as bool?) ?? false,
      state: data['subscription'] == null
          ? null
          : SubscriptionState.fromJson(data['subscription'] as Map<String, dynamic>),
    );
  }

  /// Returns the Stripe Checkout URL the customer has to open.
  Future<String> subscriptionCheckoutUrl(String plan) async {
    final data = await _client.post('/subscription/checkout', body: {'plan': plan});
    return (data['url'] as String?) ?? '';
  }

  Future<SubscriptionState?> cancelSubscription() async {
    final data = await _client.post('/subscription/cancel');
    return data['subscription'] == null
        ? null
        : SubscriptionState.fromJson(data['subscription'] as Map<String, dynamic>);
  }

  /// Pulls the latest state from Stripe, for right after checkout.
  Future<SubscriptionState?> refreshSubscription() async {
    final data = await _client.post('/subscription/refresh');
    return data['subscription'] == null
        ? null
        : SubscriptionState.fromJson(data['subscription'] as Map<String, dynamic>);
  }


  // ------------------------------------------------------- notifications

  Future<PagedResult<AppNotification>> notifications({int page = 1}) async {
    final data = await _client.get('/notifications', query: {'page': page});
    return PagedResult<AppNotification>(
      items: ((data['items'] as List<dynamic>?) ?? const [])
          .map((item) => AppNotification.fromJson(item as Map<String, dynamic>))
          .toList(),
      page: (data['page'] as num?)?.toInt() ?? 1,
      hasMore: (data['hasMore'] as bool?) ?? false,
      total: (data['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<int> unreadNotificationCount() async {
    final data = await _client.get('/notifications/unread-count');
    return (data['unreadCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> markAllNotificationsRead() => _client.post('/notifications/read-all');

  Future<void> markNotificationRead(String id) => _client.post('/notifications/$id/read');

  // ------------------------------------------------------------- uploads

  Future<UploadResult> upload({
    List<({String filename, Uint8List bytes, String? mimeType})> images = const [],
    ({String filename, Uint8List bytes, String? mimeType})? video,
    ({String filename, Uint8List bytes, String? mimeType})? avatar,
    ({String filename, Uint8List bytes, String? mimeType})? cover,
  }) async {
    final files = <UploadFileData>[
      for (final image in images)
        UploadFileData(
          field: 'images',
          filename: image.filename,
          bytes: image.bytes,
          mimeType: image.mimeType,
        ),
      if (video != null)
        UploadFileData(
          field: 'video',
          filename: video.filename,
          bytes: video.bytes,
          mimeType: video.mimeType,
        ),
      if (avatar != null)
        UploadFileData(
          field: 'avatar',
          filename: avatar.filename,
          bytes: avatar.bytes,
          mimeType: avatar.mimeType,
        ),
      if (cover != null)
        UploadFileData(
          field: 'cover',
          filename: cover.filename,
          bytes: cover.bytes,
          mimeType: cover.mimeType,
        ),
    ];

    final data = await _client.uploadFiles(files);
    return UploadResult(
      images: ((data['images'] as List<dynamic>?) ?? const [])
          .map((item) => PostMedia.fromJson(item as Map<String, dynamic>))
          .toList(),
      video: data['video'] == null
          ? null
          : PostMedia.fromJson(data['video'] as Map<String, dynamic>),
      avatarUrl: data['avatar'] as String?,
      coverUrl: data['cover'] as String?,
    );
  }
}
