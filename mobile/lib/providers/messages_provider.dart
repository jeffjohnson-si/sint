import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/env.dart';
import '../models/conversation.dart';
import '../models/post.dart';
import '../services/sint_api.dart';

/// Conversation list plus the currently open chat thread.
class MessagesProvider extends ChangeNotifier {
  MessagesProvider(this.api);

  final SintApi api;

  final List<Conversation> _conversations = [];
  final List<ChatMessage> _messages = [];
  String? _openConversationId;
  bool _loadingList = false;
  bool _loadingThread = false;
  bool _sending = false;
  String? _error;
  Timer? _poll;

  List<Conversation> get conversations => List.unmodifiable(_conversations);
  List<ChatMessage> get messages => List.unmodifiable(_messages);
  bool get loadingList => _loadingList;
  bool get loadingThread => _loadingThread;
  bool get sending => _sending;
  String? get error => _error;
  int get unreadTotal =>
      _conversations.fold(0, (sum, conversation) => sum + conversation.unreadCount);

  Future<void> loadConversations({String? query}) async {
    _loadingList = true;
    _error = null;
    notifyListeners();

    try {
      final items = await api.conversations(query: query);
      _conversations
        ..clear()
        ..addAll(items);
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loadingList = false;
      notifyListeners();
    }
  }

  /// Badge polling for the messages icon in the home header.
  void startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(Env.pollInterval, (_) => _tick());
    _tick();
  }

  void stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  Future<void> _tick() async {
    try {
      final items = await api.conversations();
      _conversations
        ..clear()
        ..addAll(items);
      if (_openConversationId != null) {
        final thread = await api.messages(_openConversationId!);
        if (thread.length != _messages.length) {
          _messages
            ..clear()
            ..addAll(thread);
          await api.markConversationRead(_openConversationId!);
        }
      }
      notifyListeners();
    } on ApiException {
      // Keep the last known state until the next tick.
    }
  }

  Future<Conversation?> openWithUser(String userId) async {
    try {
      final conversation = await api.openConversation(userId);
      final index = _conversations.indexWhere((item) => item.id == conversation.id);
      if (index == -1) {
        _conversations.insert(0, conversation);
        notifyListeners();
      }
      return conversation;
    } on ApiException catch (error) {
      _error = error.message;
      notifyListeners();
      return null;
    }
  }

  Future<void> openThread(String conversationId) async {
    _openConversationId = conversationId;
    _loadingThread = true;
    _messages.clear();
    notifyListeners();

    try {
      final thread = await api.messages(conversationId);
      _messages.addAll(thread);
      await api.markConversationRead(conversationId);
      final index = _conversations.indexWhere((item) => item.id == conversationId);
      if (index != -1) {
        _conversations[index] = _conversations[index].copyWith(unreadCount: 0);
      }
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loadingThread = false;
      notifyListeners();
    }
  }

  void closeThread() {
    _openConversationId = null;
    _messages.clear();
  }

  Future<bool> send(
    String conversationId,
    String text, {
    List<PostMedia> media = const [],
  }) async {
    if (text.trim().isEmpty && media.isEmpty) return false;
    _sending = true;
    notifyListeners();

    try {
      _messages.add(await api.sendMessage(conversationId, text.trim(), media: media));
      return true;
    } on ApiException catch (error) {
      _error = error.message;
      return false;
    } finally {
      _sending = false;
      notifyListeners();
    }
  }

  void reset() {
    _conversations.clear();
    _messages.clear();
    _openConversationId = null;
    stopPolling();
    notifyListeners();
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }
}
