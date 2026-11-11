/// The extra profile fields a business, company or freelancer fills in while
/// signing up. They land straight on the profile the app shows to customers.
class BusinessDetails {
  const BusinessDetails({
    required this.category,
    required this.location,
    this.phone = '',
    this.address = '',
    this.contactEmail = '',
    this.bio = '',
  });

  final String category;
  final String location;
  final String phone;
  final String address;
  final String contactEmail;
  final String bio;

  Map<String, dynamic> toJson() => {
    'category': category,
    'location': location,
    'phone': phone,
    'address': address,
    'bio': bio,
    if (contactEmail.isNotEmpty) 'contactEmail': contactEmail,
  };
}
