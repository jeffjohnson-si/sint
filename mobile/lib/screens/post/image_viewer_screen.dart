import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../models/post.dart';

/// Full screen image viewer: pinch or double tap to zoom, swipe to move
/// between the images of a post.
///
/// Uses a black backdrop rather than the app's white surfaces, because photos
/// read better against it and the chrome should disappear.
class ImageViewerScreen extends StatefulWidget {
  const ImageViewerScreen({super.key, required this.images, this.initialIndex = 0});

  final List<PostMedia> images;
  final int initialIndex;

  /// Opens the viewer for [album], starting on [current].
  static Future<void> open(BuildContext context, List<PostMedia> album, PostMedia current) {
    final images = album.where((item) => !item.isVideo).toList(growable: false);
    if (images.isEmpty) return Future.value();

    final index = images.indexWhere((item) => item.url == current.url);
    return Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: AppColors.black,
        pageBuilder: (_, _, _) =>
            ImageViewerScreen(images: images, initialIndex: index < 0 ? 0 : index),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  State<ImageViewerScreen> createState() => _ImageViewerScreenState();
}

class _ImageViewerScreenState extends State<ImageViewerScreen> {
  late final PageController _pageController;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _pageController = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: widget.images.length,
            onPageChanged: (index) => setState(() => _index = index),
            itemBuilder: (context, index) => _ZoomableImage(image: widget.images[index]),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            left: 4,
            right: 4,
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, color: AppColors.white, size: 26),
                ),
                const Spacer(),
                if (widget.images.length > 1)
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Text(
                      '${_index + 1} / ${widget.images.length}',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ZoomableImage extends StatefulWidget {
  const _ZoomableImage({required this.image});

  final PostMedia image;

  @override
  State<_ZoomableImage> createState() => _ZoomableImageState();
}

class _ZoomableImageState extends State<_ZoomableImage> {
  final TransformationController _controller = TransformationController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Double tap zooms in on the tapped point, or back out when already zoomed.
  void _onDoubleTapDown(TapDownDetails details) {
    if (_controller.value != Matrix4.identity()) {
      _controller.value = Matrix4.identity();
      return;
    }

    const scale = 2.5;
    final position = details.localPosition;
    _controller.value = Matrix4.identity()
      ..translateByDouble(-position.dx * (scale - 1), -position.dy * (scale - 1), 0, 1)
      ..scaleByDouble(scale, scale, scale, 1);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onDoubleTapDown: _onDoubleTapDown,
      onDoubleTap: () {},
      child: InteractiveViewer(
        transformationController: _controller,
        minScale: 1,
        maxScale: 5,
        child: Center(
          child: CachedNetworkImage(
            imageUrl: widget.image.url,
            fit: BoxFit.contain,
            placeholder: (context, _) => const Center(
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
            ),
            errorWidget: (context, _, _) => const Center(
              child: Icon(Icons.broken_image_outlined, color: AppColors.grey500, size: 40),
            ),
          ),
        ),
      ),
    );
  }
}
