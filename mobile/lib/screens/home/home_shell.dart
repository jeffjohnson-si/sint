import 'dart:math' show pi;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/feed_provider.dart';
import '../../providers/messages_provider.dart';
import '../../providers/notifications_provider.dart';
import '../../providers/suggestions_provider.dart';
import '../../widgets/common.dart';
import '../messages/conversations_screen.dart';
import '../profile/profile_screen.dart';
import 'feed_screen.dart';

enum _Destination { home, create, profile, messages }

/// Bottom navigation host: Home, Create Post (publishers only), Profile, Messages.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  /// Bumped when Home is double tapped, so the feed jumps back to the top.
  final _scrollFeedToTop = ValueNotifier<int>(0);
  static const _doubleTapWindow = Duration(milliseconds: 600);

  int _index = 0;
  DateTime? _lastHomeTapAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationsProvider>().startPolling();
      context.read<MessagesProvider>().startPolling();
    });
  }

  @override
  void dispose() {
    _scrollFeedToTop.dispose();
    super.dispose();
  }

  Future<void> _onTap(List<_Destination> destinations, int index) async {
    final destination = destinations[index];

    // Create Post is an action rather than a tab: it pushes and comes back.
    if (destination == _Destination.create) {
      // A lapsed plan keeps the tab but sends the business to the paywall.
      if (!context.read<AuthProvider>().canPublish) {
        await AppNavigator.openSubscription(
          context,
          message: 'Your subscription has ended, so you cannot publish new posts. '
              'Renew it to post again and get your business boosted.',
        );
        if (mounted) await context.read<AuthProvider>().refreshUser();
        return;
      }

      final created = await AppNavigator.openCreatePost(context);
      if (created == null || !mounted) return;
      context.read<FeedProvider>().prependPost(created);
      await context.read<AuthProvider>().refreshUser();
      if (mounted) setState(() => _index = destinations.indexOf(_Destination.home));
      return;
    }

    if (destination == _Destination.home) {
      if (_index != index) {
        _lastHomeTapAt = null;
        setState(() => _index = index);
        return;
      }

      // Double tapping Home pulls in new posts and scrolls back to the top.
      final now = DateTime.now();
      final previous = _lastHomeTapAt;
      _lastHomeTapAt = now;
      if (previous == null || now.difference(previous) > _doubleTapWindow) return;

      _lastHomeTapAt = null;
      _scrollFeedToTop.value++;
      final feed = context.read<FeedProvider>();
      final suggestions = context.read<SuggestionsProvider>();
      await Future.wait([feed.resetToForYou(), suggestions.load()]);
      return;
    }

    _lastHomeTapAt = null;
    setState(() => _index = index);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final unreadMessages = context.watch<MessagesProvider>().unreadTotal;
    final userId = auth.user?.id ?? '';

    final destinations = <_Destination>[
      _Destination.home,
      if (auth.isPublisher) _Destination.create,
      _Destination.profile,
      _Destination.messages,
    ];

    final pages = destinations.map((destination) {
      return switch (destination) {
        _Destination.home => FeedScreen(scrollToTop: _scrollFeedToTop),
        // Never shown: selecting Create pushes a route instead.
        _Destination.create => const SizedBox.shrink(),
        _Destination.profile => ProfileScreen(userId: userId, isRoot: true),
        _Destination.messages => const ConversationsScreen(isRoot: true),
      };
    }).toList();

    final items = destinations.map((destination) {
      return switch (destination) {
        _Destination.home => const BottomNavigationBarItem(
          icon: Icon(Icons.home_outlined),
          activeIcon: Icon(Icons.home),
          label: 'Home',
        ),
        _Destination.create => const BottomNavigationBarItem(
          icon: Icon(Icons.add_box_outlined),
          activeIcon: Icon(Icons.add_box),
          label: 'Post',
        ),
        _Destination.profile => const BottomNavigationBarItem(
          icon: Icon(Icons.person_outline),
          activeIcon: Icon(Icons.person),
          label: 'Profile',
        ),
        _Destination.messages => BottomNavigationBarItem(
          icon: UnreadBadge(count: unreadMessages, child: const Icon(Icons.forum_outlined)),
          activeIcon: UnreadBadge(count: unreadMessages, child: const Icon(Icons.forum)),
          label: 'Messages',
        ),
      };
    }).toList();

    final safeIndex = _index.clamp(0, pages.length - 1);
    final profileTab = destinations.indexOf(_Destination.profile);

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            IndexedStack(index: safeIndex, children: pages),
            if (auth.promptProfileSetup)
              Positioned(
                left: 12,
                right: 12,
                bottom: 10,
                child: _ProfileSetupBubble(
                  isPublisher: auth.isPublisher,
                  // Points at the Profile tab, wherever it sits in the bar.
                  caretAlignment: (profileTab + 0.5) / destinations.length * 2 - 1,
                  onSetUp: () async {
                    context.read<AuthProvider>().dismissProfileSetupPrompt();
                    await AppNavigator.openEditProfile(context);
                    if (mounted) setState(() => _index = profileTab);
                  },
                  onDismiss: () => context.read<AuthProvider>().dismissProfileSetupPrompt(),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.grey200)),
        ),
        child: BottomNavigationBar(
          currentIndex: safeIndex,
          onTap: (index) => _onTap(destinations, index),
          items: items,
        ),
      ),
    );
  }
}

/// One time nudge shown on the home page right after signing up, pointing at
/// the Profile tab where the account is finished off.
class _ProfileSetupBubble extends StatelessWidget {
  const _ProfileSetupBubble({
    required this.isPublisher,
    required this.caretAlignment,
    required this.onSetUp,
    required this.onDismiss,
  });

  final bool isPublisher;

  /// -1 is the far left of the navigation bar, 1 the far right.
  final double caretAlignment;
  final VoidCallback onSetUp;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final message = isPublisher
        ? 'Add a logo, a cover photo and anything you left blank, so customers recognise your business.'
        : 'Add a photo and a few details so businesses know who they are talking to.';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 10),
          decoration: BoxDecoration(
            color: AppColors.black,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.person_outline, color: AppColors.white, size: 18),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Set up your profile',
                      style: TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: onDismiss,
                    tooltip: 'Dismiss',
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close, color: AppColors.white, size: 18),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(left: 28, right: 8),
                child: Text(
                  message,
                  style: const TextStyle(color: AppColors.white, fontSize: 13, height: 1.4),
                ),
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.only(left: 22),
                child: Row(
                  children: [
                    TextButton(
                      onPressed: onSetUp,
                      style: TextButton.styleFrom(
                        backgroundColor: AppColors.white,
                        foregroundColor: AppColors.black,
                      ),
                      child: const Text('Set up now'),
                    ),
                    TextButton(
                      onPressed: onDismiss,
                      style: TextButton.styleFrom(foregroundColor: AppColors.white),
                      child: const Text('Later'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Caret pointing down at the Profile tab.
        Align(
          alignment: Alignment(caretAlignment.clamp(-0.9, 0.9), 0),
          child: Transform.translate(
            offset: const Offset(0, -7),
            child: Transform.rotate(
              angle: pi / 4,
              child: Container(width: 14, height: 14, color: AppColors.black),
            ),
          ),
        ),
      ],
    );
  }
}
