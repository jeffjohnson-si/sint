import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../models/app_user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/feed_provider.dart';
import '../../providers/messages_provider.dart';
import '../../providers/notifications_provider.dart';
import '../../providers/suggestions_provider.dart';
import '../../services/sint_api.dart';
import '../../widgets/common.dart';
import '../../widgets/post_card.dart';

const kCategories = <String>[
  'All',
  'Food & Drinks',
  'Beauty & Fashion',
  'Health Care',
  'Accommodations',
  'Retail Shops',
  'Travel & Transportation',
  'Bars & Nightlife',
  'Services',
];

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key, this.scrollToTop});

  /// Ticks whenever the shell wants the feed back at the top (Home double tap).
  final ValueListenable<int>? scrollToTop;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    widget.scrollToTop?.addListener(_jumpToTop);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final feed = context.read<FeedProvider>();
      if (feed.posts.isEmpty) feed.refresh();
      final suggestions = context.read<SuggestionsProvider>();
      if (suggestions.isEmpty) suggestions.load();
    });
  }

  @override
  void dispose() {
    widget.scrollToTop?.removeListener(_jumpToTop);
    _debounce?.cancel();
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _jumpToTop() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 400) {
      context.read<FeedProvider>().loadMore();
    }
  }

  /// Live search: waits for a short pause in typing before hitting the API.
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      context.read<FeedProvider>().setQuery(value.trim());
    });
    setState(() {});
  }

  Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final feed = context.watch<FeedProvider>();
    final auth = context.watch<AuthProvider>();
    final suggestions = context.watch<SuggestionsProvider>();
    final unreadNotifications = context.watch<NotificationsProvider>().unreadCount;
    final unreadMessages = context.watch<MessagesProvider>().unreadTotal;

    return Column(
      children: [
        _Header(
          unreadNotifications: unreadNotifications,
          unreadMessages: unreadMessages,
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            textInputAction: TextInputAction.search,
            onSubmitted: (value) => AppNavigator.openSearch(context, initialQuery: value.trim()),
            decoration: InputDecoration(
              hintText: 'Search businesses...',
              prefixIcon: const Icon(Icons.search, color: AppColors.grey500),
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close, color: AppColors.grey500),
                      onPressed: () {
                        _searchController.clear();
                        _onSearchChanged('');
                      },
                    ),
            ),
          ),
        ),
        _FeedTabs(
          tab: feed.tab,
          onChanged: (tab) {
            if (tab == FeedTab.following && !auth.isSignedIn) return;
            feed.setTab(tab);
          },
        ),
        const SizedBox(height: 8),
        CategoryChips(
          categories: kCategories,
          selected: feed.category,
          onSelected: feed.setCategory,
        ),
        const SizedBox(height: 4),
        if (feed.error != null)
          ErrorNotice(message: feed.error!, onRetry: feed.refresh),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.black,
            onRefresh: () async {
              await Future.wait([feed.refresh(), suggestions.load()]);
            },
            child: _buildBody(feed, auth, suggestions),
          ),
        ),
      ],
    );
  }

  Widget _buildBody(FeedProvider feed, AuthProvider auth, SuggestionsProvider suggestions) {
    if (feed.loading && feed.posts.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    // The suggested strip rides along as the first row so it scrolls away.
    final showSuggested = auth.isSignedIn && suggestions.items.isNotEmpty;
    final leading = showSuggested ? 1 : 0;

    if (feed.isEmpty) {
      return ListView(
        children: [
          if (showSuggested) _SuggestedStrip(suggestions: suggestions, onFollow: _followSuggestion),
          const SizedBox(height: 40),
          EmptyState(
            icon: feed.tab == FeedTab.following ? Icons.group_outlined : Icons.feed_outlined,
            title: feed.tab == FeedTab.following
                ? 'No posts from businesses you follow'
                : 'Nothing here yet',
            message: feed.tab == FeedTab.following
                ? 'Follow a few businesses and their posts will show up here.'
                : feed.query.isNotEmpty
                    ? 'No posts match "${feed.query}".'
                    : 'Once businesses start posting, their updates appear here.',
            action: feed.tab == FeedTab.following
                ? OutlinedButton(
                    onPressed: () => feed.setTab(FeedTab.forYou),
                    child: const Text('Browse For You'),
                  )
                : null,
          ),
        ],
      );
    }

    return ListView.builder(
      controller: _scrollController,
      itemCount: leading + feed.posts.length + (feed.hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (showSuggested && index == 0) {
          return _SuggestedStrip(suggestions: suggestions, onFollow: _followSuggestion);
        }

        final postIndex = index - leading;
        if (postIndex >= feed.posts.length) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }

        final post = feed.posts[postIndex];
        return PostCard(
          post: post,
          onLike: () => _guard(() => feed.toggleLike(post)),
          onSave: () => _guard(() => feed.toggleSave(post)),
          onShare: () => _share(post.id, post.author.fullName),
          onFollow: auth.isSignedIn && !post.isOwner
              ? () => _guard(() => feed.toggleFollowAuthor(post))
              : null,
          onEdit: post.isOwner
              ? () async {
                  final updated = await AppNavigator.openCreatePost(context, editing: post);
                  if (updated != null) feed.replacePost(updated);
                }
              : null,
          onDelete: post.isOwner ? () => _confirmDelete(post.id) : null,
        );
      },
    );
  }

  void _followSuggestion(AppUser business) {
    _guard(() => context.read<SuggestionsProvider>().toggleFollow(business));
  }

  void _share(String postId, String author) {
    final link = 'sint://post/$postId';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Share $author\'s post: $link')),
    );
  }

  Future<void> _confirmDelete(String postId) async {
    final feed = context.read<FeedProvider>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this post?'),
        content: const Text('Are you sure? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: AppColors.like)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;
    await _guard(() async {
      await context.read<SintApi>().deletePost(postId);
      feed.removePost(postId);
      if (!mounted) return;
      await context.read<AuthProvider>().refreshUser();
    });
  }
}

/// Horizontal "Suggested for you" row: businesses picked from the categories
/// the viewer searches, follows, likes, saves and comments on.
class _SuggestedStrip extends StatelessWidget {
  const _SuggestedStrip({required this.suggestions, required this.onFollow});

  final SuggestionsProvider suggestions;
  final ValueChanged<AppUser> onFollow;

  @override
  Widget build(BuildContext context) {
    final items = suggestions.items;

    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.grey200)),
      ),
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 4, 16, 10),
            child: Text(
              'Suggested for you',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ),
          SizedBox(
            height: 176,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) => _SuggestionCard(
                business: items[index],
                onFollow: () => onFollow(items[index]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SuggestionCard extends StatelessWidget {
  const _SuggestionCard({required this.business, required this.onFollow});

  final AppUser business;
  final VoidCallback onFollow;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      if (business.category.isNotEmpty) business.category,
      if (business.location.isNotEmpty) business.location,
    ].join(' · ');

    return InkWell(
      onTap: () => AppNavigator.openProfile(context, business.id),
      child: Container(
        width: 156,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.grey200),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            AppAvatar(user: business, radius: 26),
            const SizedBox(height: 8),
            Text(
              business.fullName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle.isEmpty ? business.accountTypeLabel : subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: AppColors.grey500),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: business.isFollowing
                  ? OutlinedButton(
                      onPressed: onFollow,
                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(34)),
                      child: const Text('Following', style: TextStyle(fontSize: 13)),
                    )
                  : ElevatedButton(
                      onPressed: onFollow,
                      style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(34)),
                      child: const Text('Follow', style: TextStyle(fontSize: 13)),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.unreadNotifications, required this.unreadMessages});

  final int unreadNotifications;
  final int unreadMessages;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
      child: Row(
        children: [
          const Text(
            'SINT',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 1.5),
          ),
          const Spacer(),
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => AppNavigator.openNotifications(context),
            icon: UnreadBadge(
              count: unreadNotifications,
              child: const Icon(Icons.notifications_none, size: 26),
            ),
          ),
          IconButton(
            tooltip: 'Messages',
            onPressed: () => AppNavigator.openConversations(context),
            icon: UnreadBadge(
              count: unreadMessages,
              child: const Icon(Icons.mail_outline, size: 24),
            ),
          ),
          IconButton(
            tooltip: 'Log out',
            onPressed: () => _signOut(context),
            icon: const Icon(Icons.logout, size: 24),
          ),
        ],
      ),
    );
  }

  Future<void> _signOut(BuildContext context) async {
    final auth = context.read<AuthProvider>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need to sign in again to use SINT.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Log out', style: TextStyle(color: AppColors.like)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    await auth.signOut();
  }
}

class _FeedTabs extends StatelessWidget {
  const _FeedTabs({required this.tab, required this.onChanged});

  final FeedTab tab;
  final ValueChanged<FeedTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.grey200)),
      ),
      child: Row(
        children: [
          _tab(context, 'For You', FeedTab.forYou),
          _tab(context, 'Following', FeedTab.following),
        ],
      ),
    );
  }

  Widget _tab(BuildContext context, String label, FeedTab value) {
    final isSelected = tab == value;
    return Expanded(
      child: InkWell(
        onTap: () => onChanged(value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? AppColors.black : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? AppColors.black : AppColors.grey500,
            ),
          ),
        ),
      ),
    );
  }
}
