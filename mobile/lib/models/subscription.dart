/// A paid plan on offer, as described by the API.
class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.label,
    required this.priceText,
    this.note = '',
    this.interval = 'month',
    this.verified = false,
    this.benefits = const [],
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) => SubscriptionPlan(
    id: (json['id'] as String?) ?? '',
    label: (json['label'] as String?) ?? '',
    priceText: (json['priceText'] as String?) ?? '',
    note: (json['note'] as String?) ?? '',
    interval: (json['interval'] as String?) ?? 'month',
    verified: (json['verified'] as bool?) ?? false,
    benefits: ((json['benefits'] as List<dynamic>?) ?? const [])
        .map((item) => item as String)
        .toList(growable: false),
  );

  final String id;
  final String label;
  final String priceText;
  final String note;
  final String interval;

  /// True when the plan grants the verified badge.
  final bool verified;

  /// The "what you get" list for this plan.
  final List<String> benefits;
}

/// Where a business stands with billing. Normal user accounts have none.
class SubscriptionState {
  const SubscriptionState({
    required this.status,
    this.plan = '',
    this.trialEndsAt,
    this.currentPeriodEnd,
    this.cancelAtPeriodEnd = false,
    this.canPublish = false,
    this.isBoosted = false,
  });

  factory SubscriptionState.fromJson(Map<String, dynamic> json) => SubscriptionState(
    status: (json['status'] as String?) ?? 'none',
    plan: (json['plan'] as String?) ?? '',
    trialEndsAt: DateTime.tryParse((json['trialEndsAt'] as String?) ?? '')?.toLocal(),
    currentPeriodEnd: DateTime.tryParse((json['currentPeriodEnd'] as String?) ?? '')?.toLocal(),
    cancelAtPeriodEnd: (json['cancelAtPeriodEnd'] as bool?) ?? false,
    canPublish: (json['canPublish'] as bool?) ?? false,
    isBoosted: (json['isBoosted'] as bool?) ?? false,
  );

  /// 'none', 'trialing', 'active', 'past_due' or 'canceled'.
  final String status;
  final String plan;
  final DateTime? trialEndsAt;
  final DateTime? currentPeriodEnd;
  final bool cancelAtPeriodEnd;
  final bool canPublish;
  final bool isBoosted;

  bool get isTrialing => status == 'trialing';
  bool get isActive => status == 'active';
  bool get hasLapsed => status == 'canceled' || status == 'past_due';

  /// Whole days left on the trial or the paid period, floor 0.
  int get daysLeft {
    final end = isTrialing ? trialEndsAt : currentPeriodEnd;
    if (end == null) return 0;
    final left = end.difference(DateTime.now()).inHours / 24;
    return left <= 0 ? 0 : left.ceil();
  }

  String get headline => switch (status) {
    'trialing' => 'Free trial',
    'active' => cancelAtPeriodEnd ? 'Ending soon' : 'Subscribed',
    'past_due' => 'Payment failed',
    'canceled' => 'Subscription ended',
    _ => 'No subscription',
  };

  String get detail => switch (status) {
    'trialing' => '$daysLeft ${daysLeft == 1 ? 'day' : 'days'} left of your free trial.',
    'active' => cancelAtPeriodEnd
        ? 'Your plan stays active for $daysLeft more ${daysLeft == 1 ? 'day' : 'days'}, then stops.'
        : 'Your ${plan == 'yearly' ? 'yearly' : 'monthly'} plan renews in $daysLeft '
              '${daysLeft == 1 ? 'day' : 'days'}. Your business is boosted in the feed and suggestions.',
    'past_due' => 'We could not take the last payment. Update your card to keep posting.',
    'canceled' => 'You can still be found and messaged, but you cannot post until you subscribe.',
    _ => 'Subscribe to publish posts and get pushed to more customers.',
  };
}
