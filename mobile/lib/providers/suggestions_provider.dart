import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/app_user.dart';
import '../services/sint_api.dart';

/// Businesses suggested for the signed in viewer, based on the categories they
/// search, follow, like, save and comment on.
class SuggestionsProvider extends ChangeNotifier {
  SuggestionsProvider(this.api);

  final SintApi api;

  final List<AppUser> _items = [];
  bool _loading = false;
  String? _error;

  List<AppUser> get items => List.unmodifiable(_items);
  bool get loading => _loading;
  String? get error => _error;
  bool get isEmpty => _items.isEmpty;

  Future<void> load() async {
    _loading = true;
    notifyListeners();

    try {
      final items = await api.suggestions();
      _items
        ..clear()
        ..addAll(items);
      _error = null;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Follows a suggestion in place, so the card flips to Following without the
  /// strip jumping around. The next reload drops it.
  Future<void> toggleFollow(AppUser business) async {
    final index = _items.indexWhere((item) => item.id == business.id);
    if (index == -1) return;

    _items[index] = business.copyWith(
      isFollowing: !business.isFollowing,
      followerCount: business.followerCount + (business.isFollowing ? -1 : 1),
    );
    notifyListeners();

    try {
      _items[index] = await api.setFollowing(business.id, !business.isFollowing);
    } on ApiException {
      _items[index] = business;
      rethrow;
    } finally {
      notifyListeners();
    }
  }

  void clear() {
    _items.clear();
    _error = null;
    notifyListeners();
  }
}
