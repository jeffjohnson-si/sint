import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/formatters.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../models/post.dart';
import '../../models/post_comment.dart';
import '../../providers/auth_provider.dart';
import '../../providers/feed_provider.dart';
import '../../services/sint_api.dart';
import '../../widgets/common.dart';
import '../../widgets/post_card.dart';
import 'image_viewer_screen.dart';

/// An image the user picked for a comment but has not uploaded yet.
typedef _PendingImage = ({String filename, Uint8List bytes, String? mimeType});

class PostDetailScreen extends StatefulWidget {
  const PostDetailScreen({
    super.key,
    required this.postId,
    this.initialPost,
    this.focusComments = false,
  });

  final String postId;
  final Post? initialPost;
  final bool focusComments;

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final _commentController = TextEditingController();
  final _commentFocus = FocusNode();
  final _picker = ImagePicker();
  final List<_PendingImage> _pendingImages = [];

  Post? _post;
  List<PostComment> _comments = const [];
  PostComment? _replyingTo;
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _post = widget.initialPost;
    _load();
    if (widget.focusComments) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _commentFocus.requestFocus());
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    _commentFocus.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<SintApi>();
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final post = await api.post(widget.postId);
      final comments = await api.comments(widget.postId);
      if (!mounted) return;
      setState(() {
        _post = post;
        _comments = comments.items;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Lets the commenter attach up to [Env.maxImagesPerComment] images.
  Future<void> _pickCommentImages() async {
    final remaining = Env.maxImagesPerComment - _pendingImages.length;
    if (remaining <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('A comment can hold up to ${Env.maxImagesPerComment} images'),
        ),
      );
      return;
    }

    final picked = await _picker.pickMultiImage(limit: remaining);
    if (picked.isEmpty || !mounted) return;

    for (final file in picked.take(remaining)) {
      final bytes = await file.readAsBytes();
      if (bytes.lengthInBytes > Env.maxImageBytes) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${file.name} is larger than 10MB and was skipped')),
        );
        continue;
      }
      _pendingImages.add((
        filename: file.name,
        bytes: bytes,
        mimeType: file.mimeType ?? 'image/jpeg',
      ));
    }

    if (mounted) setState(() {});
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty && _pendingImages.isEmpty) return;

    setState(() => _sending = true);
    final api = context.read<SintApi>();

    try {
      var media = const <PostMedia>[];
      if (_pendingImages.isNotEmpty) {
        final uploaded = await api.upload(images: _pendingImages);
        media = uploaded.images;
      }

      await api.addComment(widget.postId, text, parentId: _replyingTo?.id, media: media);
      _commentController.clear();
      _pendingImages.clear();
      _replyingTo = null;
      await _load();
      final post = _post;
      if (post != null && mounted) context.read<FeedProvider>().replacePost(post);
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _toggleCommentLike(PostComment comment) async {
    try {
      await context.read<SintApi>().setCommentLiked(comment.id, !comment.isLiked);
      await _load();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _deleteComment(PostComment comment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this comment?'),
        content: const Text('Are you sure? Replies will be removed too.'),
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

    try {
      await context.read<SintApi>().deleteComment(comment.id);
      await _load();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _togglePostLike() async {
    final post = _post;
    if (post == null) return;
    try {
      final updated = await context.read<SintApi>().setLiked(post.id, !post.isLiked);
      if (!mounted) return;
      setState(() => _post = updated);
      context.read<FeedProvider>().replacePost(updated);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _togglePostSave() async {
    final post = _post;
    if (post == null) return;
    try {
      final updated = await context.read<SintApi>().setSaved(post.id, !post.isSaved);
      if (!mounted) return;
      setState(() => _post = updated);
      context.read<FeedProvider>().replacePost(updated);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _deletePost() async {
    final post = _post;
    if (post == null) return;

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

    try {
      await context.read<SintApi>().deletePost(post.id);
      if (!mounted) return;
      context.read<FeedProvider>().removePost(post.id);
      await context.read<AuthProvider>().refreshUser();
      if (!mounted) return;
      Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _editPost(Post post) async {
    final feed = context.read<FeedProvider>();
    final updated = await AppNavigator.openCreatePost(context, editing: post);
    if (updated == null || !mounted) return;
    setState(() => _post = updated);
    feed.replacePost(updated);
  }

  @override
  Widget build(BuildContext context) {
    final post = _post;

    return Scaffold(
      appBar: AppBar(title: const Text('Post')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _loading && post == null
                  ? const Center(child: CircularProgressIndicator())
                  : post == null
                      ? EmptyState(
                          icon: Icons.error_outline,
                          title: 'Post unavailable',
                          message: _error ?? 'That post no longer exists.',
                        )
                      : RefreshIndicator(
                          color: AppColors.black,
                          onRefresh: _load,
                          child: ListView(
                            children: [
                              PostCard(
                                post: post,
                                onTap: () {},
                                onLike: _togglePostLike,
                                onSave: _togglePostSave,
                                onShare: () => ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Share link: sint://post/${post.id}')),
                                ),
                                onEdit: post.isOwner ? () => _editPost(post) : null,
                                onDelete: post.isOwner ? _deletePost : null,
                              ),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                                child: Text(
                                  'Comments (${post.commentCount})',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                ),
                              ),
                              if (_comments.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.fromLTRB(16, 8, 16, 24),
                                  child: Text(
                                    'No comments yet. Be the first to reply.',
                                    style: TextStyle(color: AppColors.grey500),
                                  ),
                                ),
                              ..._comments.map(
                                (comment) => _CommentTile(
                                  comment: comment,
                                  onLike: _toggleCommentLike,
                                  onDelete: _deleteComment,
                                  onReply: (target) {
                                    setState(() => _replyingTo = target);
                                    _commentFocus.requestFocus();
                                  },
                                ),
                              ),
                              const SizedBox(height: 24),
                            ],
                          ),
                        ),
            ),
            if (post != null) _CommentComposer(
              controller: _commentController,
              focusNode: _commentFocus,
              replyingTo: _replyingTo,
              sending: _sending,
              pendingImages: _pendingImages,
              onPickImages: _pickCommentImages,
              onRemoveImage: (index) => setState(() => _pendingImages.removeAt(index)),
              onCancelReply: () => setState(() => _replyingTo = null),
              onSubmit: _submitComment,
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({
    required this.comment,
    required this.onLike,
    required this.onDelete,
    required this.onReply,
    this.isReply = false,
  });

  final PostComment comment;
  final ValueChanged<PostComment> onLike;
  final ValueChanged<PostComment> onDelete;
  final ValueChanged<PostComment> onReply;
  final bool isReply;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(isReply ? 56 : 16, 10, 16, 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppAvatar(
                user: comment.author,
                radius: isReply ? 14 : 18,
                onTap: () => AppNavigator.openProfile(context, comment.author.id),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: GestureDetector(
                            onTap: () => AppNavigator.openProfile(context, comment.author.id),
                            child: Text(
                              comment.author.fullName,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          Formatters.timeAgo(comment.createdAt),
                          style: const TextStyle(fontSize: 11, color: AppColors.grey500),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    if (comment.text.isNotEmpty)
                      Text(comment.text, style: const TextStyle(height: 1.4)),
                    if (comment.media.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _CommentImages(media: comment.media),
                    ],
                    Row(
                      children: [
                        TextButton.icon(
                          onPressed: () => onLike(comment),
                          icon: Icon(
                            comment.isLiked ? Icons.favorite : Icons.favorite_border,
                            size: 15,
                            color: comment.isLiked ? AppColors.like : AppColors.grey500,
                          ),
                          label: Text(
                            comment.likeCount == 0 ? 'Like' : '${comment.likeCount}',
                            style: const TextStyle(fontSize: 12, color: AppColors.grey700),
                          ),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            minimumSize: const Size(40, 32),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                        ),
                        if (!isReply)
                          TextButton(
                            onPressed: () => onReply(comment),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 6),
                              minimumSize: const Size(40, 32),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: const Text(
                              'Reply',
                              style: TextStyle(fontSize: 12, color: AppColors.grey700),
                            ),
                          ),
                        if (comment.isOwner)
                          TextButton(
                            onPressed: () => onDelete(comment),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 6),
                              minimumSize: const Size(40, 32),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: const Text(
                              'Delete',
                              style: TextStyle(fontSize: 12, color: AppColors.like),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        ...comment.replies.map(
          (reply) => _CommentTile(
            comment: reply,
            onLike: onLike,
            onDelete: onDelete,
            onReply: onReply,
            isReply: true,
          ),
        ),
      ],
    );
  }
}

/// Comment attachments: small thumbnails that open the full screen viewer.
class _CommentImages extends StatelessWidget {
  const _CommentImages({required this.media});

  final List<PostMedia> media;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: media
          .map(
            (image) => GestureDetector(
              onTap: () => ImageViewerScreen.open(context, media, image),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: CachedNetworkImage(
                  imageUrl: image.url,
                  height: 96,
                  width: 96,
                  fit: BoxFit.cover,
                  placeholder: (context, _) => Container(
                    height: 96,
                    width: 96,
                    color: AppColors.grey100,
                  ),
                  errorWidget: (context, _, _) => Container(
                    height: 96,
                    width: 96,
                    color: AppColors.grey100,
                    child: const Icon(Icons.broken_image_outlined, color: AppColors.grey500),
                  ),
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _CommentComposer extends StatelessWidget {
  const _CommentComposer({
    required this.controller,
    required this.focusNode,
    required this.replyingTo,
    required this.sending,
    required this.pendingImages,
    required this.onPickImages,
    required this.onRemoveImage,
    required this.onCancelReply,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final PostComment? replyingTo;
  final bool sending;
  final List<_PendingImage> pendingImages;
  final VoidCallback onPickImages;
  final ValueChanged<int> onRemoveImage;
  final VoidCallback onCancelReply;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<AuthProvider>().isSignedIn;
    if (!signedIn) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('Sign in to join the conversation', style: TextStyle(color: AppColors.grey500)),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.grey200)),
      ),
      child: Column(
        children: [
          if (replyingTo != null)
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Replying to ${replyingTo!.author.fullName}',
                    style: const TextStyle(fontSize: 12, color: AppColors.grey500),
                  ),
                ),
                IconButton(
                  tooltip: 'Cancel reply',
                  icon: const Icon(Icons.close, size: 16),
                  onPressed: onCancelReply,
                ),
              ],
            ),
          if (pendingImages.isNotEmpty)
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 8,
                  children: [
                    for (var index = 0; index < pendingImages.length; index++)
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.memory(
                              pendingImages[index].bytes,
                              height: 64,
                              width: 64,
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: -6,
                            right: -6,
                            child: InkWell(
                              onTap: () => onRemoveImage(index),
                              child: Container(
                                padding: const EdgeInsets.all(3),
                                decoration: const BoxDecoration(
                                  color: AppColors.black,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.close,
                                  size: 13,
                                  color: AppColors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          Row(
            children: [
              IconButton(
                tooltip: 'Add images',
                onPressed: sending ? null : onPickImages,
                icon: const Icon(Icons.image_outlined, color: AppColors.grey700),
              ),
              Expanded(
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSubmit(),
                  decoration: const InputDecoration(hintText: 'Write a comment...'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: sending ? null : onSubmit,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.black,
                  foregroundColor: AppColors.white,
                  minimumSize: const Size(48, 48),
                ),
                icon: sending
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                      )
                    : const Icon(Icons.send, size: 20),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
