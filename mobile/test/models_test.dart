import 'package:flutter_test/flutter_test.dart';
import 'package:sint_app/core/formatters.dart';
import 'package:sint_app/models/app_user.dart';
import 'package:sint_app/models/post.dart';

void main() {
  group('AppUser', () {
    test('builds initials from the display name', () {
      const single = AppUser(id: '1', fullName: 'Wantok');
      const full = AppUser(id: '2', fullName: 'Joyce Maeta');
      expect(single.initials, 'W');
      expect(full.initials, 'JM');
    });

    test('parses profile links and falls back to the host as a label', () {
      final user = AppUser.fromJson({
        'id': '3',
        'fullName': 'Coral Sea Resort',
        'accountType': 'company',
        'isPublisher': true,
        'links': [
          {'label': 'Website', 'url': 'https://coral.example'},
          {'label': '', 'url': 'https://www.facebook.com/coral'},
        ],
      });

      expect(user.links, hasLength(2));
      expect(user.links.first.displayLabel, 'Website');
      expect(user.links.last.displayLabel, 'facebook.com');
      expect(user.isPublisher, isTrue);
      expect(user.accountTypeLabel, 'Company');
    });
  });

  group('Post', () {
    test('separates images from the single video', () {
      final post = Post.fromJson({
        'id': 'p1',
        'author': {'id': 'a1', 'fullName': 'Lime Lounge'},
        'content': 'Fresh tuna today',
        'media': [
          {'type': 'image', 'url': 'https://example.com/a.jpg'},
          {'type': 'video', 'url': 'https://example.com/b.mp4'},
        ],
        'createdAt': '2026-08-01T10:00:00.000Z',
      });

      expect(post.images, hasLength(1));
      expect(post.video?.url, 'https://example.com/b.mp4');
    });
  });

  group('Formatters', () {
    test('shows recent timestamps as relative time', () {
      final justNow = DateTime.now().subtract(const Duration(seconds: 5));
      final hours = DateTime.now().subtract(const Duration(hours: 3));
      expect(Formatters.timeAgo(justNow), 'just now');
      expect(Formatters.timeAgo(hours), '3h');
    });

    test('abbreviates large counts', () {
      expect(Formatters.count(999), '999');
      expect(Formatters.count(1500), '1.5k');
    });
  });
}
