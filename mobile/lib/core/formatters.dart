import 'package:intl/intl.dart';

/// Human friendly timestamps used across the feed, comments and chat.
class Formatters {
  const Formatters._();

  static String timeAgo(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    if (diff.inDays < 365) return DateFormat('d MMM').format(time);
    return DateFormat('d MMM yyyy').format(time);
  }

  static String clockTime(DateTime time) => DateFormat('h:mm a').format(time);

  static String dateDivider(DateTime time) {
    final today = DateTime.now();
    final date = DateTime(time.year, time.month, time.day);
    final todayDate = DateTime(today.year, today.month, today.day);
    final difference = todayDate.difference(date).inDays;

    if (difference == 0) return 'Today';
    if (difference == 1) return 'Yesterday';
    if (difference < 7) return DateFormat('EEEE').format(time);
    return DateFormat('d MMM yyyy').format(time);
  }

  static bool sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  static String count(int value) {
    if (value < 1000) return '$value';
    if (value < 1000000) return '${(value / 1000).toStringAsFixed(value % 1000 == 0 ? 0 : 1)}k';
    return '${(value / 1000000).toStringAsFixed(1)}m';
  }
}
