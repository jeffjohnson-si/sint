// ignore_for_file: avoid_web_libraries_in_flutter
// The web-targeted conditional import means this file is only ever compiled
// for Flutter Web, where dart:html is safe to use.
import 'dart:async';
import 'dart:convert';
import 'dart:html' as html; // ignore: deprecated_member_use
import 'dart:typed_data';

/// Captures a frame from the video bytes using a hidden HTML5 <video> element
/// and a canvas. Runs in the browser only.
Future<Uint8List?> generateVideoThumbnail({String? path, Uint8List? bytes}) async {
  if (bytes == null || bytes.isEmpty) return null;

  final objectUrl = html.Url.createObjectUrlFromBlob(html.Blob([bytes]));
  final video = html.VideoElement()
    ..muted = true
    ..preload = 'metadata';

  try {
    // Set the source first, then wait — the metadata event only fires once
    // the element has a source to load. Listening first avoids the race
    // where the event fires before we start awaiting.
    final loaded = video.onLoadedMetadata.first
        .timeout(const Duration(seconds: 10), onTimeout: () => throw TimeoutException('metadata'));
    video.src = objectUrl;
    await loaded;

    // Grab a frame ~10% in so the thumbnail is rarely a black title card.
    final seekTo = video.duration.isFinite && video.duration > 1
        ? video.duration * 0.1
        : 0.0;
    final seeked = video.onSeeked.first
        .timeout(const Duration(seconds: 10), onTimeout: () => throw TimeoutException('seek'));
    video.currentTime = seekTo;
    await seeked;

    if (video.videoWidth == 0 || video.videoHeight == 0) return null;

    final canvas = html.CanvasElement(
      width: video.videoWidth,
      height: video.videoHeight,
    );
    canvas.context2D.drawImage(video, 0, 0);
    final dataUrl = canvas.toDataUrl('image/jpeg', 0.8);
    final comma = dataUrl.indexOf(',');
    final base64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
    return base64Decode(base64);
  } catch (_) {
    return null;
  } finally {
    video.src = '';
    html.Url.revokeObjectUrl(objectUrl);
  }
}
