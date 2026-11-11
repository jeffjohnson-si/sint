import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;

import 'env.dart';
import 'token_store.dart';

/// Error surfaced to the UI. [offline] means the request never reached the API.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.offline = false});

  final String message;
  final int? statusCode;
  final bool offline;

  bool get isUnauthorized => statusCode == 401;

  /// 402: a business needs an active subscription to complete this action.
  bool get needsSubscription => statusCode == 402;

  @override
  String toString() => message;
}

class UploadFileData {
  UploadFileData({required this.field, required this.filename, required this.bytes, this.mimeType});

  final String field;
  final String filename;
  final Uint8List bytes;
  final String? mimeType;
}

/// Thin JSON client: attaches the bearer token, retries once after refreshing an
/// expired access token, and normalises every failure into [ApiException].
class ApiClient {
  ApiClient({required this.tokens, http.Client? httpClient})
    : _http = httpClient ?? http.Client();

  final TokenStore tokens;
  final http.Client _http;

  static const Duration _timeout = Duration(seconds: 20);

  /// Called when refreshing fails, so the app can drop back to the sign in screen.
  void Function()? onSessionExpired;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) =>
      _send('GET', path, query: query);

  Future<Map<String, dynamic>> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    String? accessToken,
  }) =>
      _send('POST', path, body: body, query: query, accessToken: accessToken);

  Future<Map<String, dynamic>> patch(String path, {Object? body}) =>
      _send('PATCH', path, body: body);

  Future<Map<String, dynamic>> delete(String path, {Object? body}) =>
      _send('DELETE', path, body: body);

  Uri _uri(String path, Map<String, dynamic>? query) {
    final normalised = query?.entries
        .where((entry) => entry.value != null && '${entry.value}'.isNotEmpty)
        .map((entry) => MapEntry(entry.key, '${entry.value}'));
    return Uri.parse('${Env.apiBaseUrl}${Env.apiPrefix}$path').replace(
      queryParameters: normalised == null || normalised.isEmpty
          ? null
          : Map.fromEntries(normalised),
    );
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool isRetry = false,
    String? accessToken,
  }) async {
    final request = http.Request(method, _uri(path, query));
    request.headers['Accept'] = 'application/json';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    // Prefer a caller-supplied token (e.g. the short-lived reset token), fall back to the session token.
    final token = accessToken ?? tokens.accessToken;
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    http.Response response;
    try {
      response = await http.Response.fromStream(await _http.send(request).timeout(_timeout));
    } on TimeoutException {
      throw ApiException('The server took too long to respond', offline: true);
    } catch (_) {
      throw ApiException('Cannot reach the SINT server. Check your connection.', offline: true);
    }

    if (response.statusCode == 401 && !isRetry && tokens.hasSession) {
      if (await refreshSession()) {
        return _send(method, path, body: body, query: query, isRetry: true);
      }
    }

    return _decode(response);
  }

  /// Uploads images/video/avatar/cover as multipart form data.
  Future<Map<String, dynamic>> uploadFiles(List<UploadFileData> files, {bool isRetry = false}) async {
    final request = http.MultipartRequest('POST', _uri('/uploads', null));
    final token = tokens.accessToken;
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    for (final file in files) {
      request.files.add(
        http.MultipartFile.fromBytes(
          file.field,
          file.bytes,
          filename: file.filename,
          contentType: _parseMime(file.mimeType),
        ),
      );
    }

    http.Response response;
    try {
      response = await http.Response.fromStream(
        await _http.send(request).timeout(const Duration(minutes: 3)),
      );
    } on TimeoutException {
      throw ApiException('Upload timed out', offline: true);
    } catch (_) {
      throw ApiException('Upload failed. Check your connection.', offline: true);
    }

    if (response.statusCode == 401 && !isRetry && tokens.hasSession) {
      if (await refreshSession()) return uploadFiles(files, isRetry: true);
    }

    return _decode(response);
  }

  Future<bool> refreshSession() async {
    final refreshToken = tokens.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final response = await _http
          .post(
            _uri('/auth/refresh', null),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(_timeout);

      if (response.statusCode >= 400) {
        await tokens.clear();
        onSessionExpired?.call();
        return false;
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      await tokens.save(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> payload = const {};
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) payload = decoded;
      } catch (_) {
        payload = const {};
      }
    }

    if (response.statusCode >= 400) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Request failed (${response.statusCode})',
        statusCode: response.statusCode,
      );
    }
    return payload;
  }

  static MediaType? _parseMime(String? mimeType) {
    if (mimeType == null || !mimeType.contains('/')) return null;
    final parts = mimeType.split('/');
    return MediaType(parts.first, parts.last);
  }

  void dispose() => _http.close();
}

