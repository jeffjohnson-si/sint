import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../models/business_details.dart';
import '../../providers/auth_provider.dart';
import '../home/feed_screen.dart' show kCategories;

const _accountTypes = <({String value, String label, String hint})>[
  (value: 'user', label: 'Normal User', hint: 'Browse, like, comment and message businesses'),
  (value: 'business', label: 'Business', hint: 'Shops, restaurants and services that post updates'),
  (value: 'company', label: 'Company', hint: 'Larger organisations with a public profile'),
  (
    value: 'freelancer',
    label: 'Freelance / Self-employed',
    hint: 'Working for yourself, showcase your services and portfolio',
  ),
];

/// 'All' is a feed filter, not something a business can be.
final _businessCategories = kCategories.where((category) => category != 'All').toList();

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _locationController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _contactEmailController = TextEditingController();
  final _bioController = TextEditingController();

  String _accountType = 'user';
  String? _category;
  bool _acceptedTerms = false;
  bool _obscurePassword = true;

  bool get _isPublisher => _accountType != 'user';

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _locationController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _contactEmailController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (!_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept the Terms & Conditions')),
      );
      return;
    }

    final created = await context.read<AuthProvider>().signUp(
      fullName: _nameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text,
      accountType: _accountType,
      acceptedTerms: _acceptedTerms,
      business: _isPublisher
          ? BusinessDetails(
              category: _category ?? '',
              location: _locationController.text.trim(),
              phone: _phoneController.text.trim(),
              address: _addressController.text.trim(),
              contactEmail: _contactEmailController.text.trim(),
              bio: _bioController.text.trim(),
            )
          : null,
    );

    // On success the root widget swaps to the home shell, so just unwind.
    if (created && mounted) Navigator.of(context).popUntil((route) => route.isFirst);
  }

  /// Extra fields for publishers. Everything here lands on the public profile,
  /// so it is worth collecting up front instead of after the first sign in.
  List<Widget> _businessFields() {
    final label = _accountType == 'freelancer' ? 'your work' : 'your business';

    return [
      const SizedBox(height: 22),
      const Divider(),
      const SizedBox(height: 6),
      const Text(
        'Business details',
        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
      const SizedBox(height: 4),
      const Text(
        'Customers see these on your profile. You can change them any time.',
        style: TextStyle(fontSize: 12, color: AppColors.grey500),
      ),
      const SizedBox(height: 14),
      DropdownButtonFormField<String>(
        initialValue: _category,
        decoration: const InputDecoration(labelText: 'Category'),
        items: _businessCategories
            .map((category) => DropdownMenuItem(value: category, child: Text(category)))
            .toList(),
        onChanged: (value) => setState(() => _category = value),
        validator: (value) => (value ?? '').isEmpty ? 'Please choose a category' : null,
      ),
      const SizedBox(height: 14),
      TextFormField(
        controller: _locationController,
        textCapitalization: TextCapitalization.words,
        decoration: const InputDecoration(
          labelText: 'Location',
          hintText: 'Honiara, Guadalcanal',
        ),
        validator: (value) =>
            (value ?? '').trim().isEmpty ? 'Please enter where you are based' : null,
      ),
      const SizedBox(height: 14),
      TextFormField(
        controller: _addressController,
        textCapitalization: TextCapitalization.words,
        decoration: const InputDecoration(
          labelText: 'Street address (optional)',
          hintText: 'Mendana Avenue',
        ),
      ),
      const SizedBox(height: 14),
      TextFormField(
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        decoration: const InputDecoration(
          labelText: 'Phone (optional)',
          hintText: '+677 21123',
        ),
      ),
      const SizedBox(height: 14),
      TextFormField(
        controller: _contactEmailController,
        keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(
          labelText: 'Contact email (optional)',
          helperText: 'Leave blank to use your sign in email',
        ),
        validator: (value) {
          final email = (value ?? '').trim();
          if (email.isEmpty) return null;
          return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)
              ? null
              : 'Enter a valid email address';
        },
      ),
      const SizedBox(height: 14),
      TextFormField(
        controller: _bioController,
        minLines: 3,
        maxLines: 5,
        maxLength: 1000,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(
          labelText: 'About (optional)',
          hintText: 'Tell customers what $label does',
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final selected = _accountTypes.firstWhere((type) => type.value == _accountType);

    return Scaffold(
      appBar: AppBar(title: const Text('Create your account')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _nameController,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Full name or business name',
                      ),
                      validator: (value) => (value ?? '').trim().length < 2
                          ? 'Please enter at least 2 characters'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email'),
                      validator: (value) {
                        final email = (value ?? '').trim();
                        if (email.isEmpty) return 'Email is required';
                        if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
                          return 'Enter a valid email address';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        helperText: 'At least 6 characters',
                        suffixIcon: IconButton(
                          tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            color: AppColors.grey500,
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                      validator: (value) =>
                          (value ?? '').length < 6 ? 'Password must be at least 6 characters' : null,
                    ),
                    const SizedBox(height: 18),
                    DropdownButtonFormField<String>(
                      initialValue: _accountType,
                      decoration: const InputDecoration(labelText: 'Account type'),
                      items: _accountTypes
                          .map(
                            (type) => DropdownMenuItem(value: type.value, child: Text(type.label)),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => _accountType = value ?? 'user'),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      selected.hint,
                      style: const TextStyle(fontSize: 12, color: AppColors.grey500),
                    ),
                    if (_isPublisher) ..._businessFields(),
                    const SizedBox(height: 12),
                    CheckboxListTile(
                      value: _acceptedTerms,
                      onChanged: (value) => setState(() => _acceptedTerms = value ?? false),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      activeColor: AppColors.black,
                      title: const Text(
                        'I agree to the SINT Terms & Conditions',
                        style: TextStyle(fontSize: 14),
                      ),
                    ),
                    if (auth.error != null) ...[
                      Text(
                        auth.error!,
                        style: const TextStyle(color: AppColors.like, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                    ],
                    ElevatedButton(
                      onPressed: auth.busy ? null : _submit,
                      child: auth.busy
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.white,
                              ),
                            )
                          : const Text('Create Account'),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Already have an account?',
                          style: TextStyle(color: AppColors.grey500),
                        ),
                        TextButton(
                          onPressed: auth.busy
                              ? null
                              : () {
                                  context.read<AuthProvider>().clearError();
                                  Navigator.of(context).pop();
                                },
                          child: const Text('Sign In'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
