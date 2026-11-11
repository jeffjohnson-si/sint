import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../models/app_user.dart';
import '../../models/post.dart';
import '../../providers/auth_provider.dart';
import '../../providers/feed_provider.dart';
import '../../services/sint_api.dart';
import '../../widgets/common.dart';
import '../../widgets/post_card.dart';
import '../post/image_viewer_screen.dart';
import 'follow_list_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.userId, this.isRoot = false});

  final String userId;

  /// True when hosted by the bottom navigation (no back button, no app bar).
  final bool isRoot;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  AppUser? _user;
  List<Post> _posts = const [];
  List<Post> _savedPosts = const [];
  bool _loading = true;
  bool _followBusy = false;
  String? _error;

  bool get _isSelf => context.read<AuthProvider>().user?.id == widget.userId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.userId != widget.userId) _load();
  }

  Future<void> _load() async {
    if (widget.userId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Sign in to view your profile';
      });
      return;
    }

    final api = context.read<SintApi>();
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = await api.profile(widget.userId);
      final posts = user.isPublisher
          ? (await api.userPosts(widget.userId)).items
          : const <Post>[];
      final saved = _isSelf && !user.isPublisher ? (await api.savedPosts()).items : const <Post>[];

      if (!mounted) return;
      setState(() {
        _user = user;
        _posts = posts;
        _savedPosts = saved;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleFollow() async {
    final user = _user;
    if (user == null) return;

    setState(() => _followBusy = true);
    try {
      final updated = await context.read<SintApi>().setFollowing(user.id, !user.isFollowing);
      if (!mounted) return;
      setState(() => _user = updated);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _followBusy = false);
    }
  }

  Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _togglePostLike(Post post) => _guard(() async {
    final updated = await context.read<SintApi>().setLiked(post.id, !post.isLiked);
    _replace(updated);
  });

  Future<void> _togglePostSave(Post post) => _guard(() async {
    final updated = await context.read<SintApi>().setSaved(post.id, !post.isSaved);
    _replace(updated);
  });

  void _replace(Post post) {
    if (!mounted) return;
    setState(() {
      _posts = _posts.map((item) => item.id == post.id ? post : item).toList();
      _savedPosts = _savedPosts.map((item) => item.id == post.id ? post : item).toList();
    });
    context.read<FeedProvider>().replacePost(post);
  }

  Future<void> _deletePost(Post post) async {
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
    if (confirmed != true) return;

    await _guard(() async {
      await context.read<SintApi>().deletePost(post.id);
      if (!mounted) return;
      context.read<FeedProvider>().removePost(post.id);
      await context.read<AuthProvider>().refreshUser();
      await _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    final body = _loading && user == null
        ? const Center(child: CircularProgressIndicator())
        : user == null
            ? EmptyState(
                icon: Icons.person_off_outlined,
                title: 'Profile unavailable',
                message: _error ?? 'That profile no longer exists.',
                action: OutlinedButton(onPressed: _load, child: const Text('Try again')),
              )
            : RefreshIndicator(
                color: AppColors.black,
                onRefresh: _load,
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _ProfileHeader(
                      user: user,
                      isSelf: _isSelf,
                      followBusy: _followBusy,
                      onFollow: _toggleFollow,
                      onMessage: () => AppNavigator.messageUser(context, user),
                      onEdit: () async {
                        await AppNavigator.openEditProfile(context);
                        await _load();
                      },
                      onSignOut: _isSelf
                          ? () => context.read<AuthProvider>().signOut()
                          : null,
                    ),
                    const Divider(),
                    if (user.isPublisher)
                      ..._buildPostList(_posts, 'No posts yet')
                    else ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                        child: Text(
                          _isSelf ? 'Saved posts' : 'Activity',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                      ),
                      ..._buildPostList(
                        _savedPosts,
                        _isSelf ? 'Posts you save will appear here' : 'Nothing to show yet',
                      ),
                    ],
                    const SizedBox(height: 24),
                  ],
                ),
              );

    if (widget.isRoot) return body;

    return Scaffold(
      appBar: AppBar(title: Text(user?.fullName ?? 'Profile')),
      body: SafeArea(child: body),
    );
  }

  List<Widget> _buildPostList(List<Post> posts, String emptyMessage) {
    if (posts.isEmpty) {
      return [
        Padding(
          padding: const EdgeInsets.all(24),
          child: Text(emptyMessage, style: const TextStyle(color: AppColors.grey500)),
        ),
      ];
    }

    return posts
        .map(
          (post) => PostCard(
            post: post,
            onLike: () => _togglePostLike(post),
            onSave: () => _togglePostSave(post),
            onShare: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Share link: sint://post/${post.id}')),
            ),
            onEdit: post.isOwner
                ? () async {
                    final updated = await AppNavigator.openCreatePost(context, editing: post);
                    if (updated != null) _replace(updated);
                  }
                : null,
            onDelete: post.isOwner ? () => _deletePost(post) : null,
          ),
        )
        .toList();
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.user,
    required this.isSelf,
    required this.followBusy,
    required this.onFollow,
    required this.onMessage,
    required this.onEdit,
    this.onSignOut,
  });

  final AppUser user;
  final bool isSelf;
  final bool followBusy;
  final VoidCallback onFollow;
  final VoidCallback onMessage;
  final VoidCallback onEdit;
  final VoidCallback? onSignOut;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (user.coverUrl.isNotEmpty)
          GestureDetector(
            onTap: () => _openPhoto(context, user.coverUrl),
            child: CachedNetworkImage(
              imageUrl: user.coverUrl,
              height: 140,
              width: double.infinity,
              fit: BoxFit.cover,
              errorWidget: (context, _, _) => Container(height: 140, color: AppColors.grey100),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppAvatar(
                user: user,
                radius: 34,
                onTap: user.avatarUrl.isEmpty ? null : () => _openPhoto(context, user.avatarUrl),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            user.fullName,
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                          ),
                        ),
                        if (user.isVerified) ...[
                          const SizedBox(width: 6),
                          const VerifiedBadge(size: 18),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        CategoryBadge(label: user.category),
                        CategoryBadge(label: user.accountTypeLabel),
                      ],
                    ),
                  ],
                ),
              ),
              if (isSelf && onSignOut != null)
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert),
                  onSelected: (value) {
                    if (value == 'edit') onEdit();
                    if (value == 'signout') onSignOut!();
                  },
                  itemBuilder: (context) => const [
                    PopupMenuItem(value: 'edit', child: Text('Edit profile')),
                    PopupMenuItem(value: 'signout', child: Text('Sign out')),
                  ],
                ),
            ],
          ),
        ),
        if (user.bio.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Text(user.bio, style: const TextStyle(height: 1.45)),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Row(
            children: [
              _Stat(label: 'Posts', value: user.postCount),
              _Stat(
                label: 'Followers',
                value: user.followerCount,
                onTap: () => AppNavigator.openFollowList(context, user, FollowListKind.followers),
              ),
              _Stat(
                label: 'Following',
                value: user.followingCount,
                onTap: () => AppNavigator.openFollowList(context, user, FollowListKind.following),
              ),
            ],
          ),
        ),
        if (user.hasContactDetails)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (user.location.isNotEmpty)
                  _ContactRow(icon: Icons.place_outlined, text: user.location),
                if (user.address.isNotEmpty)
                  _ContactRow(icon: Icons.storefront_outlined, text: user.address),
                if (user.phone.isNotEmpty)
                  _ContactRow(icon: Icons.phone_outlined, text: user.phone),
                if (user.contactEmail.isNotEmpty || user.email.isNotEmpty)
                  _ContactRow(
                    icon: Icons.mail_outline,
                    text: user.contactEmail.isNotEmpty ? user.contactEmail : user.email,
                  ),
              ],
            ),
          ),
        if (user.links.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final link in user.links)
                  _LinkChip(label: link.displayLabel, url: link.url),
              ],
            ),
          ),
        if (isSelf && user.isPublisher) const _SubscriptionRow(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          child: isSelf
              ? OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Edit profile'),
                )
              : Row(
                  children: [
                    Expanded(
                      child: user.isFollowing
                          ? OutlinedButton(
                              onPressed: followBusy ? null : onFollow,
                              child: const Text('Following'),
                            )
                          : ElevatedButton(
                              onPressed: followBusy ? null : onFollow,
                              style: ElevatedButton.styleFrom(
                                minimumSize: const Size.fromHeight(48),
                              ),
                              child: const Text('Follow'),
                            ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onMessage,
                        icon: const Icon(Icons.mail_outline, size: 18),
                        label: const Text('Message'),
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  /// Opens a single profile photo (avatar or cover) in the full screen viewer.
  void _openPhoto(BuildContext context, String url) {
    final photo = PostMedia(type: 'image', url: url);
    ImageViewerScreen.open(context, [photo], photo);
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.onTap});

  final String label;
  final int value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.only(right: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$value', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            Text(label, style: const TextStyle(fontSize: 12, color: AppColors.grey500)),
          ],
        ),
      ),
    );
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.grey500),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: AppColors.grey700))),
        ],
      ),
    );
  }
}

/// Billing summary shown on the owner's own business profile.
class _SubscriptionRow extends StatelessWidget {
  const _SubscriptionRow();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AuthProvider>().user?.subscription;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: InkWell(
        onTap: () => AppNavigator.openSubscription(context),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.grey200),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.workspace_premium_outlined, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state?.headline ?? 'Subscription',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      state?.detail ?? 'Manage your business plan.',
                      style: const TextStyle(fontSize: 12, color: AppColors.grey500, height: 1.35),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 20, color: AppColors.grey500),
            ],
          ),
        ),
      ),
    );
  }
}

class _LinkChip extends StatelessWidget {
  const _LinkChip({required this.label, required this.url});

  final String label;
  final String url;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      label: Text(label),
      avatar: const Icon(Icons.link, size: 16),
      onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(url)),
      ),
    );
  }
}
