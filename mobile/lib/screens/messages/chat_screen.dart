import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/env.dart';
import '../../core/api_client.dart';
import '../../core/formatters.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../models/app_user.dart';
import '../../models/conversation.dart';
import '../../models/post.dart';
import '../../providers/messages_provider.dart';
import '../../services/sint_api.dart';
import '../../widgets/common.dart';
import '../../widgets/media_gallery.dart';
import '../post/image_viewer_screen.dart';

/// A file picked for a message but not uploaded yet.
typedef _PendingFile = ({String filename, Uint8List bytes, String? mimeType});

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.conversationId, required this.otherUser});

  final String conversationId;
  final AppUser otherUser;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _picker = ImagePicker();
  final List<_PendingFile> _pendingImages = [];
  _PendingFile? _pendingVideo;
  late final MessagesProvider _messages;

  @override
  void initState() {
    super.initState();
    _messages = context.read<MessagesProvider>();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _messages.openThread(widget.conversationId);
      _scrollToBottom();
    });
  }

  @override
  void dispose() {
    _messages.closeThread();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    });
  }

  Future<void> _pickImages() async {
    final remaining = Env.maxImagesPerMessage - _pendingImages.length;
    if (remaining <= 0) {
      _showMessage('You can attach up to ${Env.maxImagesPerMessage} images');
      return;
    }

    final files = await _picker.pickMultiImage(limit: remaining);
    if (files.isEmpty) return;

    for (final file in files.take(remaining)) {
      final bytes = await file.readAsBytes();
      if (bytes.lengthInBytes > Env.maxImageBytes) {
        _showMessage('${file.name} is larger than 10MB and was skipped');
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

  Future<void> _pickVideo() async {
    if (_pendingVideo != null) {
      _showMessage('A message can hold one video');
      return;
    }

    final file = await _picker.pickVideo(source: ImageSource.gallery);
    if (file == null) return;

    final bytes = await file.readAsBytes();
    if (bytes.lengthInBytes > Env.maxVideoBytes) {
      _showMessage('Videos must be smaller than 50MB');
      return;
    }

    if (!mounted) return;
    setState(() {
      _pendingVideo = (
        filename: file.name,
        bytes: bytes,
        mimeType: file.mimeType ?? 'video/mp4',
      );
    });
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty && _pendingImages.isEmpty && _pendingVideo == null) return;

    final api = context.read<SintApi>();
    final messages = context.read<MessagesProvider>();

    var media = const <PostMedia>[];
    if (_pendingImages.isNotEmpty || _pendingVideo != null) {
      try {
        final uploaded = await api.upload(images: _pendingImages, video: _pendingVideo);
        media = [
          ...uploaded.images,
          if (uploaded.video != null) uploaded.video!,
        ];
      } on ApiException catch (error) {
        _showMessage(error.message);
        return;
      }
    }

    final sent = await messages.send(widget.conversationId, text, media: media);
    if (!mounted) return;
    if (sent) {
      _controller.clear();
      setState(() {
        _pendingImages.clear();
        _pendingVideo = null;
      });
      _scrollToBottom();
    } else {
      _showMessage(messages.error ?? 'Message could not be sent');
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final messages = context.watch<MessagesProvider>();
    final thread = messages.messages;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            AppAvatar(
              user: widget.otherUser,
              radius: 18,
              onTap: () => AppNavigator.openProfile(context, widget.otherUser.id),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: () => AppNavigator.openProfile(context, widget.otherUser.id),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.otherUser.fullName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    if (widget.otherUser.category.isNotEmpty)
                      Text(
                        widget.otherUser.category,
                        style: const TextStyle(fontSize: 12, color: AppColors.grey500),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: messages.loadingThread && thread.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : thread.isEmpty
                      ? EmptyState(
                          icon: Icons.chat_bubble_outline,
                          title: 'Say hello',
                          message: 'Send the first message to ${widget.otherUser.fullName}.',
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                          itemCount: thread.length,
                          itemBuilder: (context, index) {
                            final message = thread[index];
                            final previous = index == 0 ? null : thread[index - 1];
                            final showDivider = previous == null ||
                                !Formatters.sameDay(previous.createdAt, message.createdAt);

                            return Column(
                              children: [
                                if (showDivider) _DateDivider(date: message.createdAt),
                                _MessageBubble(message: message),
                              ],
                            );
                          },
                        ),
            ),
            _Composer(
              controller: _controller,
              sending: messages.sending,
              pendingImages: _pendingImages,
              pendingVideo: _pendingVideo,
              onPickImages: _pickImages,
              onPickVideo: _pickVideo,
              onRemoveImage: (index) => setState(() => _pendingImages.removeAt(index)),
              onRemoveVideo: () => setState(() => _pendingVideo = null),
              onSend: _send,
            ),
          ],
        ),
      ),
    );
  }
}

class _DateDivider extends StatelessWidget {
  const _DateDivider({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          const Expanded(child: Divider(color: AppColors.grey200)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              Formatters.dateDivider(date),
              style: const TextStyle(fontSize: 11, color: AppColors.grey500),
            ),
          ),
          const Expanded(child: Divider(color: AppColors.grey200)),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isMine = message.isMine;
    final hasText = message.text.isNotEmpty;

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.75),
        child: Column(
          crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (message.media.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: _Attachments(media: message.media),
              ),
            if (hasText)
              Container(
                margin: const EdgeInsets.only(bottom: 4),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isMine ? AppColors.black : AppColors.white,
                  border: Border.all(color: isMine ? AppColors.black : AppColors.grey200),
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(14),
                    topRight: const Radius.circular(14),
                    bottomLeft: Radius.circular(isMine ? 14 : 2),
                    bottomRight: Radius.circular(isMine ? 2 : 14),
                  ),
                ),
                child: Text(
                  message.text,
                  style: TextStyle(
                    color: isMine ? AppColors.white : AppColors.black,
                    height: 1.35,
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    Formatters.clockTime(message.createdAt),
                    style: const TextStyle(fontSize: 10, color: AppColors.grey500),
                  ),
                  if (isMine) ...[
                    const SizedBox(width: 4),
                    Icon(
                      message.isRead ? Icons.done_all : Icons.done,
                      size: 13,
                      color: message.isRead ? AppColors.comment : AppColors.grey300,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Image and video attachments inside a chat bubble. Tap an image to open the
/// full viewer, tap a video to play it in place.
class _Attachments extends StatelessWidget {
  const _Attachments({required this.media});

  final List<PostMedia> media;

  @override
  Widget build(BuildContext context) {
    final album = media.where((item) => !item.isVideo).toList(growable: false);

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final item in media)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: item.isVideo
                ? SizedBox(
                    height: 150,
                    width: 220,
                    child: VideoTile(item: item, height: 150),
                  )
                : GestureDetector(
                    onTap: () => ImageViewerScreen.open(context, album, item),
                    child: CachedNetworkImage(
                      imageUrl: item.url,
                      height: 150,
                      width: 150,
                      fit: BoxFit.cover,
                      placeholder: (context, _) => const SizedBox(
                        height: 150,
                        width: 150,
                        child: ColoredBox(color: AppColors.grey100),
                      ),
                      errorWidget: (context, _, _) => const SizedBox(
                        height: 150,
                        width: 150,
                        child: ColoredBox(
                          color: AppColors.grey100,
                          child: Center(
                            child: Icon(Icons.broken_image_outlined, color: AppColors.grey500),
                          ),
                        ),
                      ),
                    ),
                  ),
          ),
      ],
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.pendingImages,
    required this.pendingVideo,
    required this.onPickImages,
    required this.onPickVideo,
    required this.onRemoveImage,
    required this.onRemoveVideo,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final List<_PendingFile> pendingImages;
  final _PendingFile? pendingVideo;
  final VoidCallback onPickImages;
  final VoidCallback onPickVideo;
  final ValueChanged<int> onRemoveImage;
  final VoidCallback onRemoveVideo;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final video = pendingVideo;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.grey200)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (pendingImages.isNotEmpty || video != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var index = 0; index < pendingImages.length; index++)
                    _PendingTile(
                      onRemove: () => onRemoveImage(index),
                      child: Image.memory(
                        pendingImages[index].bytes,
                        height: 64,
                        width: 64,
                        fit: BoxFit.cover,
                      ),
                    ),
                  if (video != null)
                    _PendingTile(
                      onRemove: onRemoveVideo,
                      child: Container(
                        height: 64,
                        width: 64,
                        color: AppColors.black,
                        child: const Center(
                          child: Icon(Icons.videocam, color: AppColors.white, size: 22),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          Row(
            children: [
              IconButton(
                tooltip: 'Attach images',
                onPressed: sending ? null : onPickImages,
                icon: const Icon(Icons.image_outlined, color: AppColors.grey700),
              ),
              IconButton(
                tooltip: 'Attach a video',
                onPressed: sending ? null : onPickVideo,
                icon: const Icon(Icons.videocam_outlined, color: AppColors.grey700),
              ),
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 5,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  decoration: const InputDecoration(hintText: 'Write a message...'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: sending ? null : onSend,
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

/// A 64x64 composer preview with a black remove button in its corner.
class _PendingTile extends StatelessWidget {
  const _PendingTile({required this.child, required this.onRemove});

  final Widget child;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(borderRadius: BorderRadius.circular(8), child: child),
        Positioned(
          top: -6,
          right: -6,
          child: IconButton(
            tooltip: 'Remove',
            onPressed: onRemove,
            iconSize: 16,
            style: IconButton.styleFrom(
              backgroundColor: AppColors.black,
              foregroundColor: AppColors.white,
              minimumSize: const Size(24, 24),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            icon: const Icon(Icons.close),
          ),
        ),
      ],
    );
  }
}
