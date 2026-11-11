import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT pair. Uses the platform keystore on mobile and
/// WebCrypto-backed local storage on web.
class TokenStore {
  TokenStore({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            webOptions: WebOptions(dbName: 'sint', publicKey: 'sint_tokens'),
          );

  static const _accessKey = 'sint.accessToken';
  static const _refreshKey = 'sint.refreshToken';

  final FlutterSecureStorage _storage;

  String? _accessToken;
  String? _refreshToken;

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  bool get hasSession => (_refreshToken ?? '').isNotEmpty;

  Future<void> load() async {
    _accessToken = await _read(_accessKey);
    _refreshToken = await _read(_refreshKey);
  }

  Future<void> save({required String accessToken, required String refreshToken}) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    await _write(_accessKey, accessToken);
    await _write(_refreshKey, refreshToken);
  }

  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    await _delete(_accessKey);
    await _delete(_refreshKey);
  }

  // Secure storage can throw on unsupported/locked platforms; a missing token
  // simply means the user has to sign in again, so failures degrade to null.
  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      return null;
    }
  }

  Future<void> _write(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (_) {}
  }

  Future<void> _delete(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (_) {}
  }
}
