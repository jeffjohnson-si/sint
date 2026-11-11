import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/theme.dart';
import '../../models/app_user.dart';
import '../../providers/auth_provider.dart';
import '../../services/sint_api.dart';
import '../../widgets/common.dart';
import '../home/feed_screen.dart' show kCategories;

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  late final TextEditingController _nameController;
  late final TextEditingController _bioController;
  late final TextEditingController _locationController;
  late final TextEditingController _phoneController;
  late final TextEditingController _addressController;
  late final TextEditingController _contactEmailController;
  final List<_LinkRow> _links = [];

  String _category = 'All';
  ({String filename, Uint8List bytes, String? mimeType})? _newAvatar;
  ({String filename, Uint8List bytes, String? mimeType})? _newCover;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _bioController = TextEditingController(text: user?.bio ?? '');
    _locationController = TextEditingController(text: user?.location ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
    _addressController = TextEditingController(text: user?.address ?? '');
    _contactEmailController = TextEditingController(text: user?.contactEmail ?? '');
    for (final link in user?.links ?? const <ProfileLink>[]) {
      _links.add(_LinkRow(label: link.label, url: link.url));
    }
    final category = user?.category ?? '';
    _category = category.isEmpty ? 'All' : category;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    _locationController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _contactEmailController.dispose();
    for (final link in _links) {
      link.dispose();
    }
    super.dispose();
  }

  Future<void> _pickImage({required bool isAvatar}) async {
    final file = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1600);
    if (file == null) return;

    final bytes = await file.readAsBytes();
    if (bytes.lengthInBytes > Env.maxImageBytes) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Images must be smaller than 10MB')),
      );
      return;
    }

    final picked = (filename: file.name, bytes: bytes, mimeType: file.mimeType ?? 'image/jpeg');
    setState(() {
      if (isAvatar) {
        _newAvatar = picked;
      } else {
        _newCover = picked;
      }
    });
  }

  void _addLink() {
    setState(() => _links.add(_LinkRow()));
  }

  void _removeLink(int index) {
    final removed = _links.removeAt(index);
    removed.dispose();
    setState(() {});
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    final api = context.read<SintApi>();
    final auth = context.read<AuthProvider>();

    try {
      String? avatarUrl;
      String? coverUrl;
      if (_newAvatar != null || _newCover != null) {
        final uploaded = await api.upload(avatar: _newAvatar, cover: _newCover);
        avatarUrl = uploaded.avatarUrl;
        coverUrl = uploaded.coverUrl;
      }

      final updated = await api.updateProfile({
        'fullName': _nameController.text.trim(),
        'bio': _bioController.text.trim(),
        'category': _category == 'All' ? '' : _category,
        'location': _locationController.text.trim(),
        'phone': _phoneController.text.trim(),
        'address': _addressController.text.trim(),
        'contactEmail': _contactEmailController.text.trim(),
        'links': [
          for (final link in _links)
            if (link.urlController.text.trim().isNotEmpty)
              {
                'label': link.labelController.text.trim(),
                'url': link.urlController.text.trim(),
              },
        ],
        'avatarUrl': ?avatarUrl,
        'coverUrl': ?coverUrl,
      });

      if (!mounted) return;
      auth.applyUser(updated);
      Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const Scaffold(
        body: EmptyState(icon: Icons.lock_outline, title: 'Sign in to edit your profile'),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit profile'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null) ...[
                Text(_error!, style: const TextStyle(color: AppColors.like)),
                const SizedBox(height: 12),
              ],
              Row(
                children: [
                  _ImagePickerTile(
                    label: 'Avatar',
                    bytes: _newAvatar?.bytes,
                    existingUrl: user.avatarUrl,
                    onTap: () => _pickImage(isAvatar: true),
                    isCircle: true,
                  ),
                  const SizedBox(width: 16),
                  if (user.isPublisher)
                    Expanded(
                      child: _ImagePickerTile(
                        label: 'Cover image',
                        bytes: _newCover?.bytes,
                        existingUrl: user.coverUrl,
                        onTap: () => _pickImage(isAvatar: false),
                        isCircle: false,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: user.isPublisher ? 'Business name' : 'Full name',
                ),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? 'Name cannot be empty' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _bioController,
                minLines: 3,
                maxLines: 6,
                maxLength: 1000,
                decoration: const InputDecoration(labelText: 'About', alignLabelWithHint: true),
              ),
              if (user.isPublisher) ...[
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: kCategories.contains(_category) ? _category : 'All',
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: kCategories
                      .map((category) => DropdownMenuItem(value: category, child: Text(category)))
                      .toList(),
                  onChanged: (value) => setState(() => _category = value ?? 'All'),
                ),
              ],
              const SizedBox(height: 14),
              TextFormField(
                controller: _locationController,
                decoration: const InputDecoration(labelText: 'Location'),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _contactEmailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Contact email'),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone number',
                  helperText: 'Optional. Leave it blank to keep it off your profile.',
                ),
              ),
              if (user.isPublisher) ...[
                const SizedBox(height: 14),
                TextFormField(
                  controller: _addressController,
                  decoration: const InputDecoration(labelText: 'Physical address'),
                ),
              ],
              const SizedBox(height: 24),
              Row(
                children: [
                  const Expanded(
                    child: Text('Links', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  Text(
                    '${_links.length}/${Env.maxProfileLinks}',
                    style: const TextStyle(fontSize: 12, color: AppColors.grey500),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Optional. Add your website, social pages or anything else you want people to open.',
                style: TextStyle(fontSize: 12, color: AppColors.grey500),
              ),
              for (var index = 0; index < _links.length; index++) ...[
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _links[index].labelController,
                        maxLength: 40,
                        decoration: const InputDecoration(
                          labelText: 'Name',
                          hintText: 'Facebook',
                          counterText: '',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 3,
                      child: TextFormField(
                        controller: _links[index].urlController,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                          labelText: 'URL',
                          hintText: 'https://facebook.com/yourpage',
                        ),
                        validator: _urlValidator,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Remove link',
                      onPressed: _saving ? null : () => _removeLink(index),
                      icon: const Icon(Icons.close, size: 20, color: AppColors.grey700),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: _saving || _links.length >= Env.maxProfileLinks ? null : _addLink,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add link'),
                ),
              ),
              const SizedBox(height: 28),
              ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                      )
                    : const Text('Save changes'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _saving ? null : () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String? _urlValidator(String? value) {
    final url = (value ?? '').trim();
    if (url.isEmpty) return null;
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || !(uri.isScheme('http') || uri.isScheme('https'))) {
      return 'Enter a full URL starting with https://';
    }
    return null;
  }
}

/// One editable profile link: a name and the URL it opens.
class _LinkRow {
  _LinkRow({String label = '', String url = ''})
      : labelController = TextEditingController(text: label),
        urlController = TextEditingController(text: url);

  final TextEditingController labelController;
  final TextEditingController urlController;

  void dispose() {
    labelController.dispose();
    urlController.dispose();
  }
}

class _ImagePickerTile extends StatelessWidget {
  const _ImagePickerTile({
    required this.label,
    required this.bytes,
    required this.existingUrl,
    required this.onTap,
    required this.isCircle,
  });

  final String label;
  final Uint8List? bytes;
  final String existingUrl;
  final VoidCallback onTap;
  final bool isCircle;

  @override
  Widget build(BuildContext context) {
    final size = isCircle ? 80.0 : 80.0;

    Widget content;
    if (bytes != null) {
      content = Image.memory(bytes!, fit: BoxFit.cover);
    } else if (existingUrl.isNotEmpty) {
      content = Image.network(
        existingUrl,
        fit: BoxFit.cover,
        errorBuilder: (context, _, _) => const ColoredBox(color: AppColors.grey100),
      );
    } else {
      content = const ColoredBox(
        color: AppColors.grey100,
        child: Center(child: Icon(Icons.add_a_photo_outlined, color: AppColors.grey500)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.grey500)),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(isCircle ? size / 2 : 10),
            child: SizedBox(
              height: size,
              width: isCircle ? size : double.infinity,
              child: content,
            ),
          ),
        ),
      ],
    );
  }
}
