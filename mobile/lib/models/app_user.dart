import 'subscription.dart';

/// A labelled link on a profile, e.g. "Facebook" or "Menu".
class ProfileLink {
  const ProfileLink({required this.label, required this.url});

  factory ProfileLink.fromJson(Map<String, dynamic> json) => ProfileLink(
    label: (json['label'] as String?) ?? '',
    url: (json['url'] as String?) ?? '',
  );

  final String label;
  final String url;

  /// Falls back to the host so a link is never rendered without a name.
  String get displayLabel {
    if (label.isNotEmpty) return label;
    final host = Uri.tryParse(url)?.host ?? '';
    return host.isEmpty ? url : host.replaceFirst('www.', '');
  }

  Map<String, dynamic> toJson() => {'label': label, 'url': url};
}

/// A user or business. The API returns a compact shape when embedded in posts
/// and comments, and the full shape on profile endpoints, so every profile-only
/// field has a safe default.
class AppUser {
  const AppUser({
    required this.id,
    required this.fullName,
    this.email = '',
    this.accountType = 'user',
    this.isPublisher = false,
    this.isVerified = false,
    this.avatarUrl = '',
    this.coverUrl = '',
    this.bio = '',
    this.category = '',
    this.location = '',
    this.phone = '',
    this.address = '',
    this.contactEmail = '',
    this.links = const [],
    this.subscription,
    this.postCount = 0,
    this.followerCount = 0,
    this.followingCount = 0,
    this.isFollowing = false,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      fullName: (json['fullName'] as String?) ?? 'Unknown',
      email: (json['email'] as String?) ?? '',
      accountType: (json['accountType'] as String?) ?? 'user',
      isPublisher: (json['isPublisher'] as bool?) ?? false,
      isVerified: (json['isVerified'] as bool?) ?? false,
      avatarUrl: (json['avatarUrl'] as String?) ?? '',
      coverUrl: (json['coverUrl'] as String?) ?? '',
      bio: (json['bio'] as String?) ?? '',
      category: (json['category'] as String?) ?? '',
      location: (json['location'] as String?) ?? '',
      phone: (json['phone'] as String?) ?? '',
      address: (json['address'] as String?) ?? '',
      contactEmail: (json['contactEmail'] as String?) ?? '',
      links: ((json['links'] as List<dynamic>?) ?? const [])
          .map((item) => ProfileLink.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
      subscription: json['subscription'] == null
          ? null
          : SubscriptionState.fromJson(json['subscription'] as Map<String, dynamic>),
      postCount: (json['postCount'] as num?)?.toInt() ?? 0,
      followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
      followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
      isFollowing: (json['isFollowing'] as bool?) ?? false,
    );
  }

  final String id;
  final String fullName;
  final String email;
  final String accountType;
  final bool isPublisher;

  /// True for businesses on the yearly plan.
  final bool isVerified;
  final String avatarUrl;
  final String coverUrl;
  final String bio;
  final String category;
  final String location;
  final String phone;
  final String address;
  final String contactEmail;
  final List<ProfileLink> links;

  /// Billing state for publisher accounts; null for normal users.
  final SubscriptionState? subscription;
  final int postCount;
  final int followerCount;
  final int followingCount;
  final bool isFollowing;

  String get accountTypeLabel => switch (accountType) {
    'business' => 'Business',
    'company' => 'Company',
    'freelancer' => 'Freelance / Self-employed',
    _ => 'Member',
  };

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
  }

  bool get hasContactDetails =>
      phone.isNotEmpty || address.isNotEmpty || contactEmail.isNotEmpty || email.isNotEmpty;

  bool get hasSocialLinks => links.isNotEmpty;

  AppUser copyWith({bool? isFollowing, int? followerCount, int? postCount}) => AppUser(
    id: id,
    fullName: fullName,
    email: email,
    accountType: accountType,
    isPublisher: isPublisher,
    isVerified: isVerified,
    avatarUrl: avatarUrl,
    coverUrl: coverUrl,
    bio: bio,
    category: category,
    location: location,
    phone: phone,
    address: address,
    contactEmail: contactEmail,
    links: links,
    subscription: subscription,
    postCount: postCount ?? this.postCount,
    followerCount: followerCount ?? this.followerCount,
    followingCount: followingCount,
    isFollowing: isFollowing ?? this.isFollowing,
  );
}
