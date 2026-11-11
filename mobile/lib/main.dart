import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/theme.dart';
import 'core/token_store.dart';
import 'providers/auth_provider.dart';
import 'providers/feed_provider.dart';
import 'providers/messages_provider.dart';
import 'providers/notifications_provider.dart';
import 'providers/search_provider.dart';
import 'providers/subscription_provider.dart';
import 'providers/suggestions_provider.dart';
import 'screens/auth/sign_in_screen.dart';
import 'screens/home/home_shell.dart';
import 'screens/onboarding/interests_screen.dart';
import 'services/sint_api.dart';

void main() {
  final tokens = TokenStore();
  final api = SintApi(ApiClient(tokens: tokens));

  runApp(SintApp(tokens: tokens, api: api));
}

class SintApp extends StatelessWidget {
  const SintApp({super.key, required this.tokens, required this.api});

  final TokenStore tokens;
  final SintApi api;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<SintApi>.value(value: api),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(api: api, tokens: tokens)..restore(),
        ),
        ChangeNotifierProvider(create: (_) => FeedProvider(api)),
        ChangeNotifierProvider(create: (_) => NotificationsProvider(api)),
        ChangeNotifierProvider(create: (_) => MessagesProvider(api)),
        ChangeNotifierProvider(create: (_) => SearchProvider(api)),
        ChangeNotifierProvider(create: (_) => SuggestionsProvider(api)),
        ChangeNotifierProvider(create: (_) => SubscriptionProvider(api)),
      ],
      child: MaterialApp(
        title: 'SINT',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.build(),
        home: const _Root(),
      ),
    );
  }
}

/// Chooses between splash, sign in and the signed in shell, and resets
/// per-user state whenever the session changes.
class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  String? _lastUserId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    final userId = auth.user?.id;
    if (userId != _lastUserId) {
      _lastUserId = userId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        context.read<NotificationsProvider>().reset();
        context.read<MessagesProvider>().reset();
        context.read<SuggestionsProvider>().clear();
        context.read<SubscriptionProvider>().clear();
        if (userId != null) {
          context.read<FeedProvider>().refresh();
          context.read<SuggestionsProvider>().load();
          if (auth.user?.isPublisher ?? false) {
            context.read<SubscriptionProvider>().load();
          }
        }
      });
    }

    return switch (auth.status) {
      AuthStatus.unknown => const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'SINT',
                style: TextStyle(fontSize: 36, fontWeight: FontWeight.w800, letterSpacing: 2),
              ),
              SizedBox(height: 20),
              CircularProgressIndicator(),
            ],
          ),
        ),
      ),
      AuthStatus.unauthenticated => const SignInScreen(),
      AuthStatus.authenticated =>
        auth.needsInterests ? const InterestsScreen() : const HomeShell(),
    };
  }
}
