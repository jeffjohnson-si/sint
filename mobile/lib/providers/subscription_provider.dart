import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/subscription.dart';
import '../services/sint_api.dart';

/// Billing state for the signed in business: plans, trial countdown, checkout.
class SubscriptionProvider extends ChangeNotifier {
  SubscriptionProvider(this.api);

  final SintApi api;

  List<SubscriptionPlan> _plans = const [];
  SubscriptionState? _state;
  int _trialDays = 0;
  bool _billingEnabled = false;
  bool _loading = false;
  bool _busy = false;
  String? _error;

  List<SubscriptionPlan> get plans => _plans;
  SubscriptionState? get state => _state;
  int get trialDays => _trialDays;
  bool get billingEnabled => _billingEnabled;
  bool get loading => _loading;
  bool get busy => _busy;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final info = await api.subscription();
      _plans = info.plans;
      _state = info.state;
      _trialDays = info.trialDays;
      _billingEnabled = info.billingEnabled;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Returns the Stripe Checkout URL, or null when it could not be started.
  Future<String?> checkoutUrl(String plan) async {
    _busy = true;
    _error = null;
    notifyListeners();

    try {
      final url = await api.subscriptionCheckoutUrl(plan);
      if (url.isEmpty) _error = 'PayPal did not return a checkout page';
      return url.isEmpty ? null : url;
    } on ApiException catch (error) {
      _error = error.message;
      return null;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> cancel() => _run(api.cancelSubscription);

  /// Called when the app comes back from Stripe, before the webhook may land.
  Future<bool> refreshFromStripe() => _run(api.refreshSubscription);

  Future<bool> _run(Future<SubscriptionState?> Function() action) async {
    _busy = true;
    _error = null;
    notifyListeners();

    try {
      _state = await action();
      return true;
    } on ApiException catch (error) {
      _error = error.message;
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  void clear() {
    _plans = const [];
    _state = null;
    _error = null;
    notifyListeners();
  }
}
