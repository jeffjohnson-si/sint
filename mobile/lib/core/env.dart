/// Compile time configuration. Override with:
/// `flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:4000`
class Env {
  const Env._();

  static const String _defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );

  /// Root of the API, without a trailing slash.
  static String get apiBaseUrl => _defaultBaseUrl.replaceAll(RegExp(r'/$'), '');

  static const String apiPrefix = '/api';

  /// How often the app re-polls messages and notification counters.
  static const Duration pollInterval = Duration(seconds: 10);

  static const int maxImagesPerPost = 10;
  static const int maxImagesPerComment = 4;
  static const int maxImagesPerMessage = 4;
  static const int maxProfileLinks = 5;
  static const int maxImageBytes = 10 * 1024 * 1024;
  static const int maxVideoBytes = 50 * 1024 * 1024;
}
