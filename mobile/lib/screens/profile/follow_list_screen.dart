import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/navigation.dart';
import '../../core/theme.dart';
import '../../models/app_user.dart';
import '../../services/sint_api.dart';
import '../../widgets/common.dart';

/// Which side of the follow relationship a [FollowListScreen] shows.
enum FollowListKind { followers, following }

/// Lists the people who follow a profile, or the people it follows.
class FollowListScreen extends StatefulWidget {
  const FollowListScreen({
    super.key,
    required this.userId,
    required this.kind,
    required this.ownerName,
  });

  final String userId;
  final FollowListKind kind;
  final String ownerName;

  @override
  State<FollowListScreen> createState() => _FollowListScreenState();
}

class _FollowListScreenState extends State<FollowListScreen> {
  List<AppUser> _users = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final api = context.read<SintApi>();
    try {
      final users = switch (widget.kind) {
        FollowListKind.followers => await api.followers(widget.userId),
        FollowListKind.following => await api.following(widget.userId),
      };
      if (!mounted) return;
      setState(() {
        _users = users;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  String get _title => switch (widget.kind) {
    FollowListKind.followers => 'Followers',
    FollowListKind.following => 'Following',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(24),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                widget.ownerName,
                style: const TextStyle(color: AppColors.grey500, fontSize: 13),
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_error != null) {
      return ErrorNotice(message: _error!, onRetry: _load);
    }

    if (_users.isEmpty) {
      return EmptyState(
        icon: Icons.people_outline,
        title: widget.kind == FollowListKind.followers ? 'No followers yet' : 'Not following anyone yet',
        message: widget.kind == FollowListKind.followers
            ? 'People who follow this profile will show up here.'
            : 'Profiles this account follows will show up here.',
      );
    }

    return RefreshIndicator(
      color: AppColors.black,
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _users.length,
        separatorBuilder: (_, _) => const Divider(indent: 76),
        itemBuilder: (context, index) {
          final user = _users[index];
          final subtitle = [
            if (user.category.isNotEmpty) user.category,
            user.accountTypeLabel,
          ].join(' · ');

          return ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: AppAvatar(user: user, radius: 24),
            title: Text(user.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(subtitle, style: const TextStyle(color: AppColors.grey500)),
            onTap: () => AppNavigator.openProfile(context, user.id),
          );
        },
      ),
    );
  }
}
