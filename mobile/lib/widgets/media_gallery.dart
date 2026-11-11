import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../models/post.dart';
import '../screens/post/image_viewer_screen.dart';
import '../screens/post/video_player_screen.dart';

/// Post media: a single image fills the width, several images become a
/// swipeable carousel, and a video shows a tap-to-play overlay.
/// Tapping an image opens the full screen viewer.
class MediaGallery extends StatelessWidget {
  const MediaGallery({super.key, required this.media, this.height = 260});

  final List<PostMedia> media;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (media.isEmpty) return const SizedBox.shrink();
    if (media.length == 1) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: _MediaItem(item: media.first, height: height, album: media),
      );
    }
    return _MediaCarousel(media: media, height: height);
  }
}

class _MediaCarousel extends StatefulWidget {
  const _MediaCarousel({required this.media, required this.height});

  final List<PostMedia> media;
  final double height;

  @override
  State<_MediaCarousel> createState() => _MediaCarouselState();
}

class _MediaCarouselState extends State<_MediaCarousel> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: widget.height,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.media.length,
              onPageChanged: (index) => setState(() => _index = index),
              itemBuilder: (context, index) => _MediaItem(
                item: widget.media[index],
                height: widget.height,
                album: widget.media,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.media.length, (index) {
            final isActive = index == _index;
            return Container(
              width: isActive ? 18 : 6,
              height: 6,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                color: isActive ? AppColors.black : AppColors.grey300,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _MediaItem extends StatelessWidget {
  const _MediaItem({required this.item, required this.height, required this.album});

  final PostMedia item;
  final double height;
  final List<PostMedia> album;

  @override
  Widget build(BuildContext context) {
    if (item.isVideo) return VideoTile(item: item, height: height);

    return GestureDetector(
      onTap: () => ImageViewerScreen.open(context, album, item),
      child: CachedNetworkImage(
        imageUrl: item.url,
        height: height,
        width: double.infinity,
        fit: BoxFit.cover,
        placeholder: (context, _) => Container(
          height: height,
          color: AppColors.grey100,
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
        errorWidget: (context, _, _) => Container(
          height: height,
          color: AppColors.grey100,
          child: const Center(child: Icon(Icons.broken_image_outlined, color: AppColors.grey500)),
        ),
      ),
    );
  }
}

/// Tappable video tile — opens fullscreen player on tap.
class VideoTile extends StatelessWidget {
  const VideoTile({super.key, required this.item, this.height = 260});

  final PostMedia item;
  final double height;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => VideoPlayerScreen.open(context, url: item.url),
      child: Container(
        height: height,
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (item.thumbnailUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: CachedNetworkImage(
                  imageUrl: item.thumbnailUrl,
                  height: height,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  placeholder: (context, _) => const SizedBox.shrink(),
                  errorWidget: (context, _, arg2) => const SizedBox.shrink(),
                ),
              ),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black45,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.play_arrow, color: AppColors.white, size: 32),
            ),
          ],
        ),
      ),
    );
  }
}
