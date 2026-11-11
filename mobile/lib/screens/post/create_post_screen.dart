import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../models/post.dart';
import '../../providers/auth_provider.dart';
import '../../services/sint_api.dart';
import '../../services/video_thumbnail.dart';
import '../home/feed_screen.dart' show kCategories;
import 'video_player_screen.dart';

/// A picked-but-not-yet-uploaded file, or an already uploaded media item.
class _Draft {
  _Draft.local({
    required this.filename,
    required this.bytes,
    required this.mimeType,
    required this.isVideo,
    this.thumbnailBytes,
  }) : uploaded = null;
  _Draft.remote(PostMedia media)
    : uploaded = media,
      filename = '',
      bytes = null,
      mimeType = null,
      thumbnailBytes = null,
      isVideo = media.isVideo;

  final PostMedia? uploaded;
  final String filename;
  final Uint8List? bytes;
  final String? mimeType;
  final Uint8List? thumbnailBytes;
  final bool isVideo;

  bool get isLocal => uploaded == null;
}

class CreatePostScreen extends StatefulWidget {
  const CreatePostScreen({super.key, this.editing});

  final Post? editing;

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<CreatePostScreen> {
  final _contentController = TextEditingController();
  final _locationController = TextEditingController();
  final _picker = ImagePicker();
  final List<_Draft> _media = [];

  String _category = 'All';
  bool _submitting = false;
  String? _error;
  bool _errorNeedsSubscription = false;

  bool get _isEditing => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final editing = widget.editing;
    if (editing != null) {
      _contentController.text = editing.content;
      _locationController.text = editing.location;
      _category = editing.category.isEmpty ? 'All' : editing.category;
      _media.addAll(editing.media.map(_Draft.remote));
    } else {
      final category = context.read<AuthProvider>().user?.category ?? '';
      if (category.isNotEmpty) _category = category;
    }
  }

  @override
  void dispose() {
    _contentController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  int get _imageCount => _media.where((item) => !item.isVideo).length;
  bool get _hasVideo => _media.any((item) => item.isVideo);

  Future<void> _pickImages() async {
    final remaining = Env.maxImagesPerPost - _imageCount;
    if (remaining <= 0) {
      _showMessage('You can attach up to ${Env.maxImagesPerPost} images');
      return;
    }

    final picked = await _picker.pickMultiImage(limit: remaining);
    if (picked.isEmpty) return;

    for (final file in picked.take(remaining)) {
      final bytes = await file.readAsBytes();
      if (bytes.lengthInBytes > Env.maxImageBytes) {
        _showMessage('${file.name} is larger than 10MB and was skipped');
        continue;
      }
      _media.add(
        _Draft.local(
          filename: file.name,
          bytes: bytes,
          mimeType: file.mimeType ?? _guessMime(file.name),
          isVideo: false,
        ),
      );
    }
    setState(() {});
  }

  Future<void> _pickVideo() async {
    if (_hasVideo) {
      _showMessage('A post can hold one video');
      return;
    }

    final file = await _picker.pickVideo(source: ImageSource.gallery);
    if (file == null) return;

    final bytes = await file.readAsBytes();
    if (bytes.lengthInBytes > Env.maxVideoBytes) {
      _showMessage('Videos must be smaller than 50MB');
      return;
    }

    // Grab a frame from the video so the composer and the feed can show a
    // real thumbnail instead of a grey placeholder. Best effort: when capture
    // fails the post still works, the tiles just show the fallback.
    final thumbnailBytes = await generateVideoThumbnail(
      path: kIsWeb ? null : file.path,
      bytes: kIsWeb ? bytes : null,
    );

    setState(() {
      _media.add(
        _Draft.local(
          filename: file.name,
          bytes: bytes,
          mimeType: file.mimeType ?? 'video/mp4',
          isVideo: true,
          thumbnailBytes: thumbnailBytes,
        ),
      );
    });
  }

  Future<void> _submit() async {
    final content = _contentController.text.trim();
    if (content.isEmpty && _media.isEmpty) {
      setState(() => _error = 'Add some text or media before posting');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _errorNeedsSubscription = false;
    });

    final api = context.read<SintApi>();

    try {
      final media = <PostMedia>[..._media.where((item) => !item.isLocal).map((item) => item.uploaded!)];

      final localImages = _media.where((item) => item.isLocal && !item.isVideo).toList();
      final localVideo = _media.where((item) => item.isLocal && item.isVideo).firstOrNull;

      if (localImages.isNotEmpty || localVideo != null) {
        final result = await api.upload(
          images: localImages
              .map((item) => (filename: item.filename, bytes: item.bytes!, mimeType: item.mimeType))
              .toList(),
          video: localVideo == null
              ? null
              : (
                  filename: localVideo.filename,
                  bytes: localVideo.bytes!,
                  mimeType: localVideo.mimeType,
                ),
        );
        media.addAll(result.images);
        if (result.video != null) {
          final video = result.video!;
          final thumb = localVideo?.thumbnailBytes;
          if (thumb != null && thumb.isNotEmpty) {
            // The captured frame rides along as an image; its URL becomes the
            // video's thumbnail so feed tiles show a real preview.
            try {
              final thumbs = await api.upload(
                images: [
                  (filename: 'thumb.jpg', bytes: thumb, mimeType: 'image/jpeg'),
                ],
              );
              if (thumbs.images.isNotEmpty) {
                media.add(
                  PostMedia(type: video.type, url: video.url, thumbnailUrl: thumbs.images.first.url),
                );
              } else {
                media.add(video);
              }
            } on ApiException {
              media.add(video);
            }
          } else {
            media.add(video);
          }
        }
      }

      final category = _category == 'All' ? '' : _category;
      final post = _isEditing
          ? await api.updatePost(
              widget.editing!.id,
              content: content,
              media: media,
              category: category,
              location: _locationController.text.trim(),
            )
          : await api.createPost(
              content: content,
              media: media,
              category: category,
              location: _locationController.text.trim(),
            );

      if (mounted) Navigator.of(context).pop(post);
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
          _errorNeedsSubscription = error.needsSubscription;
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _confirmDiscard() async {
    final hasContent = _contentController.text.trim().isNotEmpty || _media.isNotEmpty;
    if (!hasContent) {
      Navigator.of(context).pop();
      return;
    }

    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard this post?'),
        content: const Text('Your text and attachments will be lost.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep editing')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard', style: TextStyle(color: AppColors.like)),
          ),
        ],
      ),
    );

    if (discard == true && mounted) Navigator.of(context).pop();
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  static String _guessMime(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit post' : 'Create post'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          tooltip: 'Cancel',
          onPressed: _submitting ? null : _confirmDiscard,
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton(
              onPressed: _submitting ? null : _submit,
              style: TextButton.styleFrom(
                backgroundColor: AppColors.black,
                foregroundColor: AppColors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                    )
                  : Text(_isEditing ? 'Save' : 'Post'),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ...[
              Text(_error!, style: const TextStyle(color: AppColors.like)),
              if (_errorNeedsSubscription) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    final auth = context.read<AuthProvider>();
                    await AppNavigator.openSubscription(context);
                    await auth.refreshUser();
                  },
                  icon: const Icon(Icons.workspace_premium_outlined, size: 18),
                  label: const Text('See plans'),
                ),
              ],
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _contentController,
              minLines: 5,
              maxLines: 12,
              maxLength: 5000,
              decoration: const InputDecoration(
                hintText: 'Share an update, offer or announcement...',
              ),
            ),
            const SizedBox(height: 12),
            if (_media.isNotEmpty) _MediaPreviewGrid(
              media: _media,
              onRemove: (index) => setState(() => _media.removeAt(index)),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _submitting ? null : _pickImages,
                    icon: const Icon(Icons.image_outlined, size: 20),
                    label: Text('Images ($_imageCount/${Env.maxImagesPerPost})'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _submitting ? null : _pickVideo,
                    icon: const Icon(Icons.videocam_outlined, size: 20),
                    label: Text(_hasVideo ? 'Video added' : 'Video'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            DropdownButtonFormField<String>(
              initialValue: kCategories.contains(_category) ? _category : 'All',
              decoration: const InputDecoration(labelText: 'Category'),
              items: kCategories
                  .map((category) => DropdownMenuItem(value: category, child: Text(category)))
                  .toList(),
              onChanged: _submitting ? null : (value) => setState(() => _category = value ?? 'All'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _locationController,
              decoration: const InputDecoration(
                labelText: 'Location (optional)',
                hintText: 'Honiara, Guadalcanal',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MediaPreviewGrid extends StatelessWidget {
  const _MediaPreviewGrid({required this.media, required this.onRemove});

  final List<_Draft> media;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemCount: media.length,
      itemBuilder: (context, index) {
        final item = media[index];
        return Stack(
          fit: StackFit.expand,
          children: [
            GestureDetector(
              onTap: item.isVideo
                  ? () => VideoPlayerScreen.open(
                        context,
                        bytes: item.bytes,
                      )
                  : null,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: _thumbnail(item),
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: InkWell(
                onTap: () => onRemove(index),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: AppColors.black, shape: BoxShape.circle),
                  child: const Icon(Icons.close, size: 14, color: AppColors.white),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _thumbnail(_Draft item) {
    if (item.isVideo) {
      Widget? frame;
      if (item.isLocal && item.thumbnailBytes != null) {
        frame = Image.memory(item.thumbnailBytes!, fit: BoxFit.cover);
      } else if (!item.isLocal && item.uploaded!.thumbnailUrl.isNotEmpty) {
        frame = Image.network(
          item.uploaded!.thumbnailUrl,
          fit: BoxFit.cover,
          errorBuilder: (context, _, _) => Container(color: AppColors.grey100),
        );
      }

      return Stack(
        fit: StackFit.expand,
        children: [
          // A real frame from the video when we have one, grey otherwise.
          if (frame != null)
            frame
          else
            Container(color: AppColors.grey100),
          // Darken slightly so the play badge reads on any frame.
          Container(color: Colors.black26),
          const Center(
            child: Icon(Icons.play_circle_outline, color: AppColors.white, size: 36),
          ),
        ],
      );
    }
    if (item.isLocal && item.bytes != null) {
      return Image.memory(item.bytes!, fit: BoxFit.cover);
    }
    return Image.network(
      item.uploaded!.url,
      fit: BoxFit.cover,
      errorBuilder: (context, _, _) => Container(color: AppColors.grey100),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
