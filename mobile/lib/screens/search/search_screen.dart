import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../providers/search_provider.dart';
import '../../widgets/common.dart';
import '../home/feed_screen.dart' show kCategories;

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _controller.text = widget.initialQuery ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final search = context.read<SearchProvider>();
      search.loadRecent();
      final initial = widget.initialQuery?.trim() ?? '';
      if (initial.isNotEmpty) search.search(initial, remember: true);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  /// Live results while typing; the query is only remembered on submit.
  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      context.read<SearchProvider>().search(value);
    });
    setState(() {});
  }

  void _submit(String value) {
    _debounce?.cancel();
    context.read<SearchProvider>().search(value, remember: true);
  }

  @override
  Widget build(BuildContext context) {
    final search = context.watch<SearchProvider>();

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 8,
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onChanged: _onChanged,
          onSubmitted: _submit,
          decoration: InputDecoration(
            hintText: 'Search businesses...',
            prefixIcon: const Icon(Icons.search, color: AppColors.grey500),
            suffixIcon: _controller.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear search',
                    icon: const Icon(Icons.close, color: AppColors.grey500),
                    onPressed: () {
                      _controller.clear();
                      context.read<SearchProvider>().clear();
                      setState(() {});
                    },
                  ),
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 8),
            CategoryChips(
              categories: kCategories,
              selected: search.category,
              onSelected: search.setCategory,
            ),
            if (search.error != null) ErrorNotice(message: search.error!),
            Expanded(child: _buildBody(search)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(SearchProvider search) {
    if (!search.hasSearched) {
      if (search.recentSearches.isEmpty) {
        return const EmptyState(
          icon: Icons.travel_explore,
          title: 'Find businesses across the Solomons',
          message: 'Try "food", "travel", "health" or a business name.',
        );
      }

      return ListView(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
            child: Row(
              children: [
                const Expanded(
                  child: Text('Recent searches', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                TextButton(
                  onPressed: search.clearRecent,
                  child: const Text('Clear'),
                ),
              ],
            ),
          ),
          ...search.recentSearches.map(
            (query) => ListTile(
              leading: const Icon(Icons.history, color: AppColors.grey500),
              title: Text(query),
              onTap: () {
                _controller.text = query;
                _submit(query);
              },
            ),
          ),
        ],
      );
    }

    if (search.loading && search.results.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (search.results.isEmpty) {
      return EmptyState(
        icon: Icons.search_off,
        title: 'No businesses found',
        message: 'Nothing matched "${search.query}". Try a broader word like "food" or "travel".',
      );
    }

    return ListView.separated(
      itemCount: search.results.length,
      separatorBuilder: (_, _) => const Divider(indent: 76),
      itemBuilder: (context, index) {
        final business = search.results[index];
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          leading: AppAvatar(user: business, radius: 24),
          title: Text(business.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(
            [
              if (business.category.isNotEmpty) business.category,
              if (business.location.isNotEmpty) business.location,
            ].join(' · '),
            style: const TextStyle(color: AppColors.grey500),
          ),
          trailing: business.isFollowing
              ? OutlinedButton(
                  onPressed: () => search.toggleFollow(business),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(96, 36)),
                  child: const Text('Following'),
                )
              : ElevatedButton(
                  onPressed: () => search.toggleFollow(business),
                  style: ElevatedButton.styleFrom(minimumSize: const Size(96, 36)),
                  child: const Text('Follow'),
                ),
          onTap: () => AppNavigator.openProfile(context, business.id),
        );
      },
    );
  }
}
