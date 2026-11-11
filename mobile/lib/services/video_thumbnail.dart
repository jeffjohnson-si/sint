// Platform-specific video thumbnail capture.
//
// Conditional export:
//  - `video_thumbnail_web.dart` (browser): decodes the video bytes in a
//    hidden HTML5 <video>, draws a frame onto a canvas and returns JPEG bytes.
//  - `video_thumbnail_mobile.dart` (Android/iOS): uses the video_thumbnail
//    package on the picked file path.
//  - `video_thumbnail_stub.dart` (anywhere else): returns null.
//
// Every implementation returns null when a frame cannot be captured —
// callers must fall back to a plain placeholder.
export 'video_thumbnail_stub.dart'
    if (dart.library.html) 'video_thumbnail_web.dart'
    if (dart.library.io) 'video_thumbnail_mobile.dart';
