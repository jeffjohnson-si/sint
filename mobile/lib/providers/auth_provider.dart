import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/token_store.dart';
import '../models/app_user.dart';
import '../models/business_details.dart';
import '../services/sint_api.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// Owns the session: token persistence, auto login and the signed in profile.
class AuthProvider extends ChangeNotifier {
  AuthProvider({required this.api, required this.tokens}) {
    api.client.onSessionExpired = () {
      _user = null;
      _promptProfileSetup = false;
      _needsInterests = false;
      _status = AuthStatus.unauthenticated;
      notifyListeners();
    };
  }

  final SintApi api;
  final TokenStore tokens;

  AuthStatus _status = AuthStatus.unknown;
  AppUser? _user;
  bool _busy = false;
  bool _promptProfileSetup = false;
  bool _needsInterests = false;
  String? _error;
  String? _resetToken; // short-lived token from verifyResetCode

  AuthStatus get status => _status;
  AppUser? get user => _user;
  bool get busy => _busy;
  String? get error => _error;
  bool get isSignedIn => _status == AuthStatus.authenticated && _user != null;
  bool get isPublisher => _user?.isPublisher ?? false;

  /// True right after signing up, so the home page can nudge the new account
  /// towards their profile. Cleared once, never shown again on later sign ins.
  bool get promptProfileSetup => _promptProfileSetup && isSignedIn;

  /// New shoppers pick the categories they care about before reaching the feed.
  /// Publishers skip this: their own category was set during signup.
  bool get needsInterests => _needsInterests && isSignedIn && !isPublisher;

  /// Publishers can only post while their trial or paid plan is running.
  bool get canPublish => isPublisher && (_user?.subscription?.canPublish ?? true);

  /// Restores a stored session on cold start. Falls back to signed out.
  Future<void> restore() async {
    await tokens.load();
    if (!tokens.hasSession) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }

    try {
      _user = await api.me();
      _status = AuthStatus.authenticated;
    } on ApiException catch (error) {
      if (error.isUnauthorized) {
        await tokens.clear();
        _status = AuthStatus.unauthenticated;
      } else {
        // Offline or server down: keep the stored session and let the user retry.
        _status = tokens.hasSession ? AuthStatus.unauthenticated : AuthStatus.unauthenticated;
        _error = error.message;
      }
    }
    notifyListeners();
  }

  Future<bool> signIn({required String email, required String password}) =>
      _authenticate(() => api.signIn(email: email, password: password));

  Future<bool> signUp({
    required String fullName,
    required String email,
    required String password,
    required String accountType,
    required bool acceptedTerms,
    BusinessDetails? business,
  }) => _authenticate(
    () => api.signUp(
      fullName: fullName,
      email: email,
      password: password,
      accountType: accountType,
      acceptedTerms: acceptedTerms,
      business: business,
    ),
    isNewAccount: true,
  );

  Future<bool> _authenticate(
    Future<AuthResult> Function() action, {
    bool isNewAccount = false,
  }) async {
    _busy = true;
    _error = null;
    notifyListeners();

    try {
      final result = await action();
      await tokens.save(accessToken: result.accessToken, refreshToken: result.refreshToken);
      _user = result.user;
      _status = AuthStatus.authenticated;
      _promptProfileSetup = isNewAccount;
      _needsInterests = isNewAccount && !(result.user.isPublisher);
      return true;
    } on ApiException catch (error) {
      _error = error.message;
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Hides the "set up your profile" bubble for the rest of the session.
  void dismissProfileSetupPrompt() {
    if (!_promptProfileSetup) return;
    _promptProfileSetup = false;
    notifyListeners();
  }

  /// Submits the 6-digit code and returns true if it was valid.
  /// Stores the short-lived reset token internally for the next step.
  Future<bool> verifyResetCode(String email, String code) async {
    _busy = true;
    _error = null;
    notifyListeners();

    try {
      final resetToken = await api.verifyResetCode(email, code);
      _resetToken = resetToken;
      return true;
    } on ApiException catch (error) {
      _error = error.message;
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Uses the short-lived token from verifyResetCode to set a new password.
  /// After success the caller should redirect to sign-in.
  Future<bool> resetPassword(String password) async {
    final token = _resetToken;
    if (token == null) {
      _error = 'Session expired. Please start over.';
      notifyListeners();
      return false;
    }

    _busy = true;
    _error = null;
    notifyListeners();

    try {
      await api.resetPassword(password, accessToken: token);
      _resetToken = null;
      return true;
    } on ApiException catch (error) {
      _error = error.message;
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Stores the categories chosen during onboarding and moves on to the feed.
  /// An empty list means "skip": the viewer then sees every business post.
  Future<void> submitInterests(List<String> categories) async {
    if (categories.isNotEmpty) {
      try {
        await api.saveInterests(categories);
      } on ApiException catch (error) {
        _error = error.message;
      }
    }
    _needsInterests = false;
    notifyListeners();
  }

  Future<String?> requestPasswordReset(String email) async {
    try {
      return await api.requestPasswordReset(email);
    } on ApiException catch (error) {
      _error = error.message;
      notifyListeners();
      return null;
    }
  }

  Future<void> signOut() async {
    await tokens.clear();
    _user = null;
    _error = null;
    _promptProfileSetup = false;
    _needsInterests = false;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  /// Applies a profile edit that already succeeded on the server.
  void applyUser(AppUser user) {
    _user = user;
    notifyListeners();
  }

  Future<void> refreshUser() async {
    if (!isSignedIn) return;
    try {
      _user = await api.me();
      notifyListeners();
    } on ApiException {
      // Leave the cached profile in place.
    }
  }

  void clearError() {
    if (_error == null) return;
    _error = null;
    notifyListeners();
  }
}
