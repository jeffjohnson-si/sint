import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/feed_provider.dart';
import '../../providers/suggestions_provider.dart';
import '../home/feed_screen.dart' show kCategories;

/// Shown once, right after a shopper signs up. Their picks seed the interest
/// scores that lift matching businesses up the feed and the Suggested strip.
/// Skipping is fine: the feed then shows every business post, newest first.
class InterestsScreen extends StatefulWidget {
  const InterestsScreen({super.key});

  @override
  State<InterestsScreen> createState() => _InterestsScreenState();
}

class _InterestsScreenState extends State<InterestsScreen> {
  static final _categories = kCategories.where((category) => category != 'All').toList();

  final _selected = <String>{};
  bool _busy = false;

  Future<void> _submit(List<String> categories) async {
    setState(() => _busy = true);
    final feed = context.read<FeedProvider>();
    final suggestions = context.read<SuggestionsProvider>();

    await context.read<AuthProvider>().submitInterests(categories);
    if (categories.isNotEmpty) {
      // Pick up the new ranking straight away.
      await Future.wait([feed.refresh(), suggestions.load()]);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final name = context.watch<AuthProvider>().user?.fullName.split(' ').first ?? '';

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    name.isEmpty ? 'What are you into?' : 'Welcome, $name',
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Pick what you are interested in and those businesses will show up '
                    'higher in your feed. You will still see everything else.',
                    style: TextStyle(color: AppColors.grey700, height: 1.45),
                  ),
                  const SizedBox(height: 22),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final category in _categories)
                        FilterChip(
                          label: Text(category),
                          selected: _selected.contains(category),
                          showCheckmark: false,
                          onSelected: _busy
                              ? null
                              : (selected) => setState(() {
                                  if (selected) {
                                    _selected.add(category);
                                  } else {
                                    _selected.remove(category);
                                  }
                                }),
                        ),
                    ],
                  ),
                  const SizedBox(height: 26),
                  ElevatedButton(
                    onPressed: _busy || _selected.isEmpty
                        ? null
                        : () => _submit(_selected.toList()),
                    child: _busy
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.white,
                            ),
                          )
                        : Text(
                            _selected.isEmpty
                                ? 'Choose at least one'
                                : 'Continue with ${_selected.length} selected',
                          ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _busy ? null : () => _submit(const []),
                    child: const Text('Skip for now'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
