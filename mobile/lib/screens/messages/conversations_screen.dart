import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../providers/messages_provider.dart';
import '../../widgets/common.dart';

class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key, this.isRoot = false});

  final bool isRoot;

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MessagesProvider>().loadConversations();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      context.read<MessagesProvider>().loadConversations(
        query: value.trim().isEmpty ? null : value.trim(),
      );
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final messages = context.watch<MessagesProvider>();

    final body = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Search conversations',
              prefixIcon: const Icon(Icons.search, color: AppColors.grey500),
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear',
                      icon: const Icon(Icons.close, color: AppColors.grey500),
                      onPressed: () {
                        _searchController.clear();
                        _onSearchChanged('');
                      },
                    ),
            ),
          ),
        ),
        if (messages.error != null)
          ErrorNotice(
            message: messages.error!,
            onRetry: () => messages.loadConversations(),
          ),
        Expanded(
          child: messages.loadingList && messages.conversations.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : messages.conversations.isEmpty
                  ? const EmptyState(
                      icon: Icons.forum_outlined,
                      title: 'No conversations yet',
                      message: 'Open a business profile and tap Message to start chatting.',
                    )
                  : RefreshIndicator(
                      color: AppColors.black,
                      onRefresh: () => messages.loadConversations(),
                      child: ListView.separated(
                        itemCount: messages.conversations.length,
                        separatorBuilder: (_, _) => const Divider(indent: 76),
                        itemBuilder: (context, index) {
                          final conversation = messages.conversations[index];
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            leading: AppAvatar(user: conversation.otherUser, radius: 24),
                            title: Text(
                              conversation.otherUser.fullName,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              conversation.lastMessageText.isEmpty
                                  ? 'No messages yet'
                                  : conversation.lastMessageText,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppColors.grey500),
                            ),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  Formatters.timeAgo(conversation.lastMessageAt ?? conversation.updatedAt),
                                  style: const TextStyle(fontSize: 11, color: AppColors.grey500),
                                ),
                                const SizedBox(height: 6),
                                if (conversation.unreadCount > 0)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.black,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '${conversation.unreadCount}',
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            onTap: () => AppNavigator.openChat(
                              context,
                              conversation.id,
                              conversation.otherUser,
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );

    if (widget.isRoot) {
      return Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Messages',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
            ),
          ),
          Expanded(child: body),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: SafeArea(child: body),
    );
  }
}
