import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api_client.dart';
import '../models/app_user.dart';
import '../services/sint_api.dart';

/// Business search with locally stored recent queries.
class SearchProvider extends ChangeNotifier {
  SearchProvider(this.api);

  static const _recentKey = 'sint.recentSearches';
  static const _maxRecent = 8;

  final SintApi api;

  final List<AppUser> _results = [];
  final List<String> _recent = [];
  String _query = '';
  String _category = 'All';
  bool _loading = false;
  String? _error;

  List<AppUser> get results => List.unmodifiable(_results);
  List<String> get recentSearches => List.unmodifiable(_recent);
  String get query => _query;
  String get category => _category;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasSearched => _query.trim().isNotEmpty;

  Future<void> loadRecent() async {
    final prefs = await SharedPreferences.getInstance();
    _recent
      ..clear()
      ..addAll(prefs.getStringList(_recentKey) ?? const []);
    notifyListeners();
  }

  Future<void> search(String query, {bool remember = false}) async {
    _query = query;
    if (query.trim().isEmpty) {
      _results.clear();
      _loading = false;
      notifyListeners();
      return;
    }

    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await api.searchBusinesses(query.trim(), category: _category);
      _results
        ..clear()
        ..addAll(result.items);
      if (remember) await _remember(query.trim());
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> setCategory(String category) async {
    if (_category == category) return;
    _category = category;
    if (_query.trim().isNotEmpty) await search(_query);
    notifyListeners();
  }

  Future<void> toggleFollow(AppUser business) async {
    final index = _results.indexWhere((item) => item.id == business.id);
    if (index == -1) return;

    _results[index] = business.copyWith(
      isFollowing: !business.isFollowing,
      followerCount: business.followerCount + (business.isFollowing ? -1 : 1),
    );
    notifyListeners();

    try {
      final updated = await api.setFollowing(business.id, !business.isFollowing);
      _results[index] = updated;
    } on ApiException catch (error) {
      _results[index] = business;
      _error = error.message;
    }
    notifyListeners();
  }

  Future<void> _remember(String query) async {
    _recent
      ..removeWhere((item) => item.toLowerCase() == query.toLowerCase())
      ..insert(0, query);
    if (_recent.length > _maxRecent) _recent.removeRange(_maxRecent, _recent.length);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_recentKey, _recent);
    notifyListeners();
  }

  Future<void> clearRecent() async {
    _recent.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_recentKey);
    notifyListeners();
  }

  void clear() {
    _query = '';
    _results.clear();
    notifyListeners();
  }
}
