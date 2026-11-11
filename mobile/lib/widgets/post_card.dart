import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../core/navigation.dart';
import '../core/theme.dart';
import '../models/post.dart';
import 'common.dart';
import 'media_gallery.dart';

/// Feed card: author row, content, media, and the like/comment/save/share bar.
class PostCard extends StatelessWidget {
  const PostCard({
    super.key,
    required this.post,
    required this.onLike,
    required this.onSave,
    required this.onShare,
    this.onEdit,
    this.onDelete,
    this.onFollow,
    this.onTap,
    this.showActions = true,
  });

  final Post post;
  final VoidCallback onLike;
  final VoidCallback onSave;
  final VoidCallback onShare;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  /// When set, the card shows a Follow / Following button next to the author.
  final VoidCallback? onFollow;
  final VoidCallback? onTap;
  final bool showActions;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap ?? () => AppNavigator.openPost(context, post),
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.grey200)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _AuthorRow(post: post, onEdit: onEdit, onDelete: onDelete, onFollow: onFollow),
            if (post.content.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(post.content, style: const TextStyle(fontSize: 15, height: 1.45)),
            ],
            if (post.media.isNotEmpty) ...[
              const SizedBox(height: 12),
              MediaGallery(media: post.media),
            ],
            if (post.location.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.place_outlined, size: 14, color: AppColors.grey500),
                  const SizedBox(width: 4),
                  Text(
                    post.location,
                    style: const TextStyle(fontSize: 12, color: AppColors.grey500),
                  ),
                ],
              ),
            ],
            if (showActions) ...[
              const SizedBox(height: 4),
              _ActionBar(post: post, onLike: onLike, onSave: onSave, onShare: onShare),
            ],
          ],
        ),
      ),
    );
  }
}

class _AuthorRow extends StatelessWidget {
  const _AuthorRow({required this.post, this.onEdit, this.onDelete, this.onFollow});

  final Post post;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onFollow;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppAvatar(
          user: post.author,
          onTap: () => AppNavigator.openProfile(context, post.author.id),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: GestureDetector(
                      onTap: () => AppNavigator.openProfile(context, post.author.id),
                      child: Text(
                        post.author.fullName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  if (post.author.isVerified) ...[
                    const SizedBox(width: 5),
                    const VerifiedBadge(size: 15),
                  ],
                  const SizedBox(width: 8),
                  CategoryBadge(label: post.category),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                Formatters.timeAgo(post.createdAt),
                style: const TextStyle(fontSize: 12, color: AppColors.grey500),
              ),
            ],
          ),
        ),
        if (onFollow != null && !post.isOwner) _FollowButton(post: post, onPressed: onFollow!),
        if (post.isOwner && (onEdit != null || onDelete != null))
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_horiz, color: AppColors.grey700),
            onSelected: (value) {
              if (value == 'edit') onEdit?.call();
              if (value == 'delete') onDelete?.call();
            },
            itemBuilder: (context) => [
              if (onEdit != null)
                const PopupMenuItem(value: 'edit', child: Text('Edit post')),
              if (onDelete != null)
                const PopupMenuItem(value: 'delete', child: Text('Delete post')),
            ],
          ),
      ],
    );
  }
}

/// Compact Follow / Following button shown beside a post's author.
class _FollowButton extends StatelessWidget {
  const _FollowButton({required this.post, required this.onPressed});

  final Post post;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final following = post.author.isFollowing;
    final style = following
        ? OutlinedButton.styleFrom(
            minimumSize: const Size(84, 32),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          )
        : ElevatedButton.styleFrom(
            minimumSize: const Size(84, 32),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          );

    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: following
          ? OutlinedButton(onPressed: onPressed, style: style, child: const Text('Following'))
          : ElevatedButton(onPressed: onPressed, style: style, child: const Text('Follow')),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.post,
    required this.onLike,
    required this.onSave,
    required this.onShare,
  });

  final Post post;
  final VoidCallback onLike;
  final VoidCallback onSave;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _ActionButton(
          icon: post.isLiked ? Icons.favorite : Icons.favorite_border,
          color: post.isLiked ? AppColors.like : AppColors.grey700,
          label: Formatters.count(post.likeCount),
          onPressed: onLike,
          tooltip: post.isLiked ? 'Unlike' : 'Like',
        ),
        _ActionButton(
          icon: Icons.chat_bubble_outline,
          label: Formatters.count(post.commentCount),
          onPressed: () => AppNavigator.openPost(context, post, focusComments: true),
          tooltip: 'Comments',
        ),
        _ActionButton(
          icon: post.isSaved ? Icons.bookmark : Icons.bookmark_border,
          label: post.isSaved ? 'Saved' : 'Save',
          onPressed: onSave,
          tooltip: post.isSaved ? 'Remove from saved' : 'Save post',
        ),
        const Spacer(),
        _ActionButton(icon: Icons.share_outlined, onPressed: onShare, tooltip: 'Share'),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.label,
    this.color,
  });

  final IconData icon;
  final String? label;
  final Color? color;
  final VoidCallback onPressed;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: TextButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 20, color: color ?? AppColors.grey700),
        label: label == null
            ? const SizedBox.shrink()
            : Text(
                label!,
                style: TextStyle(
                  fontSize: 13,
                  color: color ?? AppColors.grey700,
                  fontWeight: FontWeight.w500,
                ),
              ),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          minimumSize: const Size(48, 40),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}
