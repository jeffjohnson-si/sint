import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/post.dart';
import '../services/sint_api.dart';

enum FeedTab { forYou, following }

/// Drives the home feed: tab, category filter, live search and paging.
class FeedProvider extends ChangeNotifier {
  FeedProvider(this.api);

  final SintApi api;

  FeedTab _tab = FeedTab.forYou;
  String _category = 'All';
  String _query = '';
  final List<Post> _posts = [];
  bool _loading = false;
  bool _loadingMore = false;
  bool _hasMore = false;
  int _page = 1;
  String? _error;

  FeedTab get tab => _tab;
  String get category => _category;
  String get query => _query;
  List<Post> get posts => List.unmodifiable(_posts);
  bool get loading => _loading;
  bool get loadingMore => _loadingMore;
  bool get hasMore => _hasMore;
  String? get error => _error;
  bool get isEmpty => !_loading && _posts.isEmpty;

  Future<void> setTab(FeedTab tab) async {
    if (_tab == tab) return;
    _tab = tab;
    await refresh();
  }

  Future<void> setCategory(String category) async {
    if (_category == category) return;
    _category = category;
    await refresh();
  }

  Future<void> setQuery(String query) async {
    if (_query == query) return;
    _query = query;
    await refresh();
  }

  /// Reloads the first page. Safe to call from pull-to-refresh.
  Future<void> refresh() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await api.feed(
        tab: _tab == FeedTab.following ? 'following' : 'for-you',
        category: _category,
        query: _query.isEmpty ? null : _query,
        page: 1,
      );
      _posts
        ..clear()
        ..addAll(result.items);
      _page = result.page;
      _hasMore = result.hasMore;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> loadMore() async {
    if (_loading || _loadingMore || !_hasMore) return;
    _loadingMore = true;
    notifyListeners();

    try {
      final result = await api.feed(
        tab: _tab == FeedTab.following ? 'following' : 'for-you',
        category: _category,
        query: _query.isEmpty ? null : _query,
        page: _page + 1,
      );
      _posts.addAll(result.items);
      _page = result.page;
      _hasMore = result.hasMore;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loadingMore = false;
      notifyListeners();
    }
  }

  /// Optimistic like toggle; reverts if the request fails.
  Future<void> toggleLike(Post post) async {
    final optimistic = post.copyWith(
      isLiked: !post.isLiked,
      likeCount: post.likeCount + (post.isLiked ? -1 : 1),
    );
    replacePost(optimistic);

    try {
      replacePost(await api.setLiked(post.id, !post.isLiked));
    } on ApiException {
      replacePost(post);
      rethrow;
    }
  }

  Future<void> toggleSave(Post post) async {
    final optimistic = post.copyWith(isSaved: !post.isSaved);
    replacePost(optimistic);

    try {
      replacePost(await api.setSaved(post.id, !post.isSaved));
    } on ApiException {
      replacePost(post);
      rethrow;
    }
  }

  /// Follows or unfollows a post's author straight from the feed. Every card by
  /// that author updates together.
  Future<void> toggleFollowAuthor(Post post) async {
    final authorId = post.author.id;
    final following = !post.author.isFollowing;
    _setAuthorFollowing(authorId, following);

    try {
      await api.setFollowing(authorId, following);
    } on ApiException {
      _setAuthorFollowing(authorId, !following);
      rethrow;
    }
  }

  void _setAuthorFollowing(String authorId, bool isFollowing) {
    var changed = false;
    for (var index = 0; index < _posts.length; index++) {
      final post = _posts[index];
      if (post.author.id != authorId) continue;
      _posts[index] = post.copyWith(author: post.author.copyWith(isFollowing: isFollowing));
      changed = true;
    }
    if (changed) notifyListeners();
  }


  void replacePost(Post post) {
    final index = _posts.indexWhere((item) => item.id == post.id);
    if (index == -1) return;
    _posts[index] = post;
    notifyListeners();
  }

  void prependPost(Post post) {
    _posts.insert(0, post);
    notifyListeners();
  }

  void removePost(String postId) {
    _posts.removeWhere((item) => item.id == postId);
    notifyListeners();
  }

  /// Home button behaviour: back to the default For You feed.
  Future<void> resetToForYou() async {
    _tab = FeedTab.forYou;
    _category = 'All';
    _query = '';
    await refresh();
  }
}
