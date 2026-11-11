import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../core/theme.dart';

/// Full screen video player used for:
///  - previewing a local video before it is uploaded
///  - watching an uploaded video full screen from the feed
class VideoPlayerScreen extends StatefulWidget {
  const VideoPlayerScreen({
    super.key,
    this.url,
    this.bytes,
  }) : assert(url != null || bytes != null);

  /// Remote URL for already-uploaded videos.
  final String? url;

  /// Local bytes for videos not yet uploaded.
  final Uint8List? bytes;

  static Future<void> open(
    BuildContext context, {
    String? url,
    Uint8List? bytes,
  }) {
    return Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (context, arg2, arg3) => VideoPlayerScreen(url: url, bytes: bytes),
        transitionsBuilder: (context, animation, arg2, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  late final VideoPlayerController _controller;
  bool _initialising = true;
  bool _hasError = false;
  bool _showControls = true;

  @override
  void initState() {
    super.initState();
    _initController();
  }

  Future<void> _initController() async {
    Uri uri;
    if (widget.url != null) {
      uri = Uri.parse(widget.url!);
    } else {
      // For local bytes: build a data URI (web-compatible) or use a file (mobile).
      // video_player supports data: URIs on web.
      final base64 = widget.bytes!.buffer.asUint8List();
      final dataUrl = 'data:video/mp4;base64,${_base64Encode(base64)}';
      uri = Uri.parse(dataUrl);
    }

    final controller = VideoPlayerController.networkUrl(uri);

    try {
      await controller.initialize();
      await controller.setLooping(true);
      await controller.play();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _initialising = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _hasError = true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _togglePlay() {
    if (_controller.value.isPlaying) {
      _controller.pause();
    } else {
      _controller.play();
    }
    setState(() {});
  }

  void _toggleControls() {
    setState(() => _showControls = !_showControls);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.black,
      body: GestureDetector(
        onTap: _toggleControls,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Video
            if (!_initialising && !_hasError) _buildVideo(),

            // Error state
            if (_hasError)
              const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline, color: AppColors.white, size: 48),
                    SizedBox(height: 16),
                    Text(
                      'This video could not be played',
                      style: TextStyle(color: AppColors.white),
                    ),
                  ],
                ),
              ),

            // Loading indicator
            if (_initialising && !_hasError)
              Center(
                child: widget.bytes != null
                    ? _buildLocalThumbnail()
                    : const CircularProgressIndicator(color: AppColors.white),
              ),

            // Controls overlay
            if (!_initialising && !_hasError && _showControls) ...[
              // Top bar
              Positioned(
                top: MediaQuery.paddingOf(context).top,
                left: 4,
                right: 4,
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.white, size: 28),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),

              // Centre play/pause button
              Center(
                child: GestureDetector(
                  onTap: _togglePlay,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.black45,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
                      color: AppColors.white,
                      size: 48,
                    ),
                  ),
                ),
              ),

              // Bottom progress bar
              Positioned(
                left: 0,
                right: 0,
                bottom: MediaQuery.paddingOf(context).bottom + 16,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildProgress(),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _formatDuration(_controller.value.position),
                            style: const TextStyle(color: AppColors.white, fontSize: 12),
                          ),
                          Text(
                            _formatDuration(_controller.value.duration),
                            style: const TextStyle(color: AppColors.white, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Shows a static thumbnail while the local video is loading.
  Widget _buildLocalThumbnail() {
    if (widget.bytes == null) return const SizedBox.shrink();
    // Attempt to decode the first frame — if it fails, just show an icon.
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: AppColors.grey700,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.videocam, color: AppColors.white, size: 36),
        ),
        const SizedBox(height: 16),
        const CircularProgressIndicator(color: AppColors.white),
      ],
    );
  }

  Widget _buildVideo() {
    if (!_controller.value.isInitialized) return const SizedBox.shrink();

    return FittedBox(
      fit: BoxFit.contain,
      child: SizedBox(
        width: _controller.value.size.width,
        height: _controller.value.size.height,
        child: VideoPlayer(_controller),
      ),
    );
  }

  Widget _buildProgress() {
    final duration = _controller.value.duration;
    final position = _controller.value.position;
    final progress = duration.inMilliseconds > 0
        ? position.inMilliseconds / duration.inMilliseconds
        : 0.0;

    return SliderTheme(
      data: SliderTheme.of(context).copyWith(
        trackHeight: 3,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
        overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
        activeTrackColor: AppColors.white,
        inactiveTrackColor: AppColors.grey700,
        thumbColor: AppColors.white,
        overlayColor: AppColors.white.withValues(alpha: 0.2),
      ),
      child: Slider(
        value: progress.clamp(0.0, 1.0),
        onChanged: (value) {
          final position = Duration(
            milliseconds: (value * duration.inMilliseconds).round(),
          );
          _controller.seekTo(position);
        },
      ),
    );
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  /// Manual base64 encode to avoid dependencies on `dart:convert` import conflicts.
  static String _base64Encode(Uint8List bytes) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    final buffer = StringBuffer();
    for (var i = 0; i < bytes.length; i += 3) {
      final b0 = bytes[i];
      final b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      final b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      buffer.write(chars[(b0 >> 2) & 0x3F]);
      buffer.write(chars[((b0 << 4) | (b1 >> 4)) & 0x3F]);
      buffer.write(i + 1 < bytes.length ? chars[((b1 << 2) | (b2 >> 6)) & 0x3F] : '=');
      buffer.write(i + 2 < bytes.length ? chars[b2 & 0x3F] : '=');
    }
    return buffer.toString();
  }
}
