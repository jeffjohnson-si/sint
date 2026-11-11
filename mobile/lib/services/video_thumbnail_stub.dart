import 'dart:typed_data';

/// Fallback: no thumbnail capture on this platform.
Future<Uint8List?> generateVideoThumbnail({String? path, Uint8List? bytes}) async {
  return null;
}
