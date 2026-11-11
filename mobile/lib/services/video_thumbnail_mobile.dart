import 'dart:typed_data';

import 'package:video_thumbnail/video_thumbnail.dart';

/// Captures a frame from the video file on Android/iOS via the
/// video_thumbnail package. Runs on the platform's media decoder.
Future<Uint8List?> generateVideoThumbnail({String? path, Uint8List? bytes}) async {
  if (path == null || path.isEmpty) return null;
  try {
    return await VideoThumbnail.thumbnailData(
      video: path,
      imageFormat: ImageFormat.JPEG,
      maxWidth: 640,
      quality: 80,
    );
  } catch (_) {
    return null;
  }
}
