import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';
import '../../models/subscription.dart';
import '../../providers/auth_provider.dart';
import '../../providers/subscription_provider.dart';
import '../../widgets/common.dart';

/// Business plans: trial countdown, monthly or yearly checkout, and cancel.
class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key, this.message});

  /// Shown at the top when the user was sent here by a paywall.
  final String? message;

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  String _selected = 'monthly';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SubscriptionProvider>().load();
    });
  }

  Future<void> _subscribe() async {
    final subscriptions = context.read<SubscriptionProvider>();
    final url = await subscriptions.checkoutUrl(_selected);
    if (!mounted) return;

    if (url == null) {
      _showMessage(subscriptions.error ?? 'Could not start checkout');
      return;
    }

    final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!mounted) return;
    if (!opened) {
      _showMessage('Could not open the payment page');
      return;
    }
    _showMessage('Finish the payment in the PayPal page, then come back and pull to refresh.');
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel subscription?'),
        content: const Text(
          'Your plan stays active until the end of the period you already paid for. '
          'After that you cannot post and your business loses its boost.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Keep it')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel plan'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final subscriptions = context.read<SubscriptionProvider>();
    final done = await subscriptions.cancel();
    if (!mounted) return;
    _showMessage(done ? 'Your plan will not renew' : subscriptions.error ?? 'Could not cancel');
    if (done) await context.read<AuthProvider>().refreshUser();
  }

  Future<void> _refresh() async {
    final subscriptions = context.read<SubscriptionProvider>();
    await subscriptions.refreshFromStripe();
    await subscriptions.load();
    if (mounted) await context.read<AuthProvider>().refreshUser();
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final subscriptions = context.watch<SubscriptionProvider>();
    final user = context.watch<AuthProvider>().user;
    final state = subscriptions.state ?? user?.subscription;
    final matches = subscriptions.plans.where((plan) => plan.id == _selected);
    final selectedPlan = matches.isEmpty ? null : matches.first;

    if (user != null && !user.isPublisher) {
      return const Scaffold(
        body: EmptyState(
          icon: Icons.workspace_premium_outlined,
          title: 'No subscription needed',
          message: 'Only business, company and self-employed accounts pay to publish.',
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Subscription')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (widget.message != null) ...[
                _Notice(text: widget.message!),
                const SizedBox(height: 16),
              ],
              if (state != null) _StatusCard(state: state, verified: user?.isVerified ?? false),
              const SizedBox(height: 20),
              const Text('Choose a plan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              if (subscriptions.loading && subscriptions.plans.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else
                for (final plan in subscriptions.plans) ...[
                  _PlanCard(
                    plan: plan,
                    selected: _selected == plan.id,
                    current: state?.isActive == true && state?.plan == plan.id,
                    onTap: () => setState(() => _selected = plan.id),
                  ),
                  const SizedBox(height: 10),
                ],
              if (selectedPlan != null) ...[
                const SizedBox(height: 10),
                Text(
                  'What you get with ${selectedPlan.label.toLowerCase()}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                for (final benefit in selectedPlan.benefits) _Benefit(text: benefit),
              ],
              if (!subscriptions.billingEnabled)
                const Padding(
                  padding: EdgeInsets.only(top: 6, bottom: 10),
                  child: Text(
                    'Card payments are not switched on for this server yet. '
                    'Add PAYPAL_CLIENT_ID and PAYPAL_SECRET to the API .env to take real payments.',
                    style: TextStyle(fontSize: 12, color: AppColors.grey500),
                  ),
                ),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: subscriptions.busy ? null : _subscribe,
                child: subscriptions.busy
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                      )
                    : Text(state?.isActive == true ? 'Change plan' : 'Subscribe'),
              ),
              if (state?.isActive == true && state?.cancelAtPeriodEnd == false) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: subscriptions.busy ? null : _cancel,
                  child: const Text('Cancel subscription'),
                ),
              ],
              const SizedBox(height: 16),
              const Text(
                'Payments are handled by PayPal. Your existing posts stay visible even if a '
                'subscription lapses, but you cannot publish new ones until you renew.',
                style: TextStyle(fontSize: 12, color: AppColors.grey500, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.black,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_outline, color: AppColors.white, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: const TextStyle(color: AppColors.white, height: 1.35)),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.state, required this.verified});

  final SubscriptionState state;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.grey200),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                state.headline,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              if (verified) ...[
                const VerifiedBadge(size: 18),
                const SizedBox(width: 8),
              ],
              if (state.isBoosted)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.black,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'Boosted',
                    style: TextStyle(color: AppColors.white, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(state.detail, style: const TextStyle(color: AppColors.grey700, height: 1.4)),
        ],
      ),
    );
  }
}

class _Benefit extends StatelessWidget {
  const _Benefit({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check, size: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(height: 1.35))),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.current,
    required this.onTap,
  });

  final SubscriptionPlan plan;
  final bool selected;
  final bool current;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: selected ? AppColors.black : AppColors.grey200, width: selected ? 2 : 1),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        plan.priceText,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                      ),
                      if (current) ...[
                        const SizedBox(width: 8),
                        const Text(
                          'current',
                          style: TextStyle(fontSize: 11, color: AppColors.grey500),
                        ),
                      ],
                    ],
                  ),
                  if (plan.note.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      plan.note,
                      style: const TextStyle(fontSize: 12, color: AppColors.grey500),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
