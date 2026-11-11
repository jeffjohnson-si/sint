import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import 'sign_in_screen.dart';

/// Multi-step password reset:
///   1. Enter email or phone → receive code
///   2. Enter the 6-digit code → receive a temp token
///   3. Enter a new password → done
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  // Steps: 'request' | 'verify' | 'reset'
  String _step = 'request';

  // Step 1 — request
  final _emailController = TextEditingController();
  String? _requestError;

  // Step 2 — verify
  String? _email;
  final _codeController = TextEditingController();
  String? _verifyError;

  // Step 3 — reset
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _resetError;

  bool _busy = false;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  // ── Step 1: send code ──────────────────────────────────────────────────────

  Future<void> _requestCode() async {
    final email = _emailController.text.trim().toLowerCase();
    if (email.isEmpty) {
      setState(() => _requestError = 'Please enter your email address');
      return;
    }
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() => _requestError = 'Please enter a valid email address');
      return;
    }

    setState(() { _busy = true; _requestError = null; });

    final auth = context.read<AuthProvider>();
    final message = await auth.requestPasswordReset(email);

    if (!mounted) return;
    setState(() => _busy = false);

    if (message != null) {
      setState(() {
        _email = email;
        _step = 'verify';
      });
    } else {
      setState(() => _requestError = auth.error ?? 'Something went wrong');
    }
  }

  // ── Step 2: verify code ────────────────────────────────────────────────────

  Future<void> _verifyCode() async {
    final code = _codeController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _verifyError = 'Enter the 6-digit code');
      return;
    }

    setState(() { _busy = true; _verifyError = null; });

    final success = await context.read<AuthProvider>().verifyResetCode(
      _email!,
      code,
    );

    if (!mounted) return;
    setState(() => _busy = false);

    if (success) {
      setState(() => _step = 'reset');
    } else {
      setState(() => _verifyError = context.read<AuthProvider>().error ?? 'Invalid or expired code');
    }
  }

  // ── Step 3: set new password ────────────────────────────────────────────────

  Future<void> _resetPassword() async {
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (password.length < 6) {
      setState(() => _resetError = 'Password must be at least 6 characters');
      return;
    }
    if (password != confirm) {
      setState(() => _resetError = 'Passwords do not match');
      return;
    }

    setState(() { _busy = true; _resetError = null; });

    final success = await context.read<AuthProvider>().resetPassword(password);

    if (!mounted) return;
    setState(() => _busy = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed! Sign in with your new password.')),
      );
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const SignInScreen()),
      );
    } else {
      setState(() => _resetError = context.read<AuthProvider>().error ?? 'Something went wrong');
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset Password')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: switch (_step) {
                'request' => _buildRequest(),
                'verify' => _buildVerify(),
                'reset' => _buildReset(),
                _ => const SizedBox.shrink(),
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRequest() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Enter your email address',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        const Text(
          'We\'ll send you a 6-digit code to verify your identity.',
          style: TextStyle(color: AppColors.grey500, fontSize: 14, height: 1.5),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: 'Email address',
            hintText: 'you@example.com',
            errorText: _requestError,
          ),
          onSubmitted: (_) => _requestCode(),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _busy ? null : _requestCode,
          child: _busy
              ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Send Code'),
        ),
        const SizedBox(height: 16),
        Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back to sign in'),
          ),
        ),
      ],
    );
  }

  Widget _buildVerify() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Enter the code',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          'We sent a 6-digit code to $_email.',
          style: const TextStyle(color: AppColors.grey500, fontSize: 14, height: 1.5),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _codeController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 8),
          decoration: const InputDecoration(
            counterText: '',
            hintText: '000000',
            errorText: null,
          ),
          onChanged: (_) => setState(() => _verifyError = null),
          onSubmitted: (_) => _verifyCode(),
        ),
        if (_verifyError != null) ...[
          const SizedBox(height: 8),
          Text(_verifyError!, style: const TextStyle(color: AppColors.like, fontSize: 13)),
        ],
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _busy ? null : _verifyCode,
          child: _busy
              ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Verify Code'),
        ),
        const SizedBox(height: 16),
        Center(
          child: TextButton(
            onPressed: _busy
                ? null
                : () => setState(() {
                      _step = 'request';
                      _codeController.clear();
                      _verifyError = null;
                    }),
            child: const Text('Didn\'t get a code? Resend'),
          ),
        ),
      ],
    );
  }

  Widget _buildReset() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Create a new password',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        const Text(
          'Choose a password you\'ll remember. At least 6 characters.',
          style: TextStyle(color: AppColors.grey500, fontSize: 14, height: 1.5),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          decoration: InputDecoration(
            labelText: 'New password',
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                color: AppColors.grey500,
              ),
              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _confirmController,
          obscureText: _obscureConfirm,
          decoration: InputDecoration(
            labelText: 'Confirm password',
            suffixIcon: IconButton(
              icon: Icon(
                _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                color: AppColors.grey500,
              ),
              onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
            ),
            errorText: _resetError,
          ),
          onSubmitted: (_) => _resetPassword(),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _busy ? null : _resetPassword,
          child: _busy
              ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Change Password'),
        ),
      ],
    );
  }
}
