import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/env.dart';
import '../models/app_notification.dart';
import '../services/sint_api.dart';

class NotificationsProvider extends ChangeNotifier {
  NotificationsProvider(this.api);

  final SintApi api;

  final List<AppNotification> _items = [];
  int _unreadCount = 0;
  bool _loading = false;
  String? _error;
  Timer? _poll;

  List<AppNotification> get items => List.unmodifiable(_items);
  int get unreadCount => _unreadCount;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await api.notifications();
      _items
        ..clear()
        ..addAll(result.items);
      _unreadCount = result.total;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Keeps the bell badge current without a websocket.
  void startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(Env.pollInterval, (_) => refreshUnreadCount());
    refreshUnreadCount();
  }

  void stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  Future<void> refreshUnreadCount() async {
    try {
      final count = await api.unreadNotificationCount();
      if (count == _unreadCount) return;
      _unreadCount = count;
      notifyListeners();
    } on ApiException {
      // Ignore: the badge simply stays at its last known value.
    }
  }

  Future<void> markAllRead() async {
    try {
      await api.markAllNotificationsRead();
      _unreadCount = 0;
      await load();
    } on ApiException catch (error) {
      _error = error.message;
      notifyListeners();
    }
  }

  Future<void> markRead(AppNotification notification) async {
    if (notification.read) return;
    try {
      await api.markNotificationRead(notification.id);
      final index = _items.indexWhere((item) => item.id == notification.id);
      if (index != -1) {
        _items[index] = AppNotification(
          id: notification.id,
          type: notification.type,
          text: notification.text,
          createdAt: notification.createdAt,
          read: true,
          actor: notification.actor,
          postId: notification.postId,
          commentId: notification.commentId,
          conversationId: notification.conversationId,
        );
      }
      _unreadCount = _unreadCount > 0 ? _unreadCount - 1 : 0;
      notifyListeners();
    } on ApiException {
      // Non-fatal: navigation still proceeds.
    }
  }

  void reset() {
    _items.clear();
    _unreadCount = 0;
    stopPolling();
    notifyListeners();
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }
}
