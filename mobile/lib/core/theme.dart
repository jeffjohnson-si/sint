import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// SINT palette: pure white surfaces, pure black text, greys for everything else.
class AppColors {
  const AppColors._();

  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);
  static const Color grey900 = Color(0xFF111111);
  static const Color grey700 = Color(0xFF444444);
  static const Color grey500 = Color(0xFF777777);
  static const Color grey300 = Color(0xFFBBBBBB);
  static const Color grey200 = Color(0xFFE2E2E2);
  static const Color grey100 = Color(0xFFF2F2F2);

  // Notification accents, per spec.
  static const Color like = Color(0xFFE53935);
  static const Color comment = Color(0xFF1E88E5);
  static const Color follow = Color(0xFF2E7D32);
  static const Color message = Color(0xFFEF6C00);
}

class AppTheme {
  const AppTheme._();

  static ThemeData build() {
    final textTheme = GoogleFonts.interTextTheme().apply(
      bodyColor: AppColors.black,
      displayColor: AppColors.black,
    );

    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.white,
      canvasColor: AppColors.white,
      colorScheme: const ColorScheme.light(
        primary: AppColors.black,
        onPrimary: AppColors.white,
        secondary: AppColors.grey700,
        onSecondary: AppColors.white,
        surface: AppColors.white,
        onSurface: AppColors.black,
        error: AppColors.like,
      ),
      textTheme: textTheme,
      dividerTheme: const DividerThemeData(color: AppColors.grey200, thickness: 1, space: 1),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.black,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.white,
        selectedItemColor: AppColors.black,
        unselectedItemColor: AppColors.grey500,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        showUnselectedLabels: true,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.grey100,
        hintStyle: const TextStyle(color: AppColors.grey500),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: _inputBorder(AppColors.grey200),
        enabledBorder: _inputBorder(AppColors.grey200),
        focusedBorder: _inputBorder(AppColors.black),
        errorBorder: _inputBorder(AppColors.like),
        focusedErrorBorder: _inputBorder(AppColors.like),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.black,
          foregroundColor: AppColors.white,
          disabledBackgroundColor: AppColors.grey300,
          disabledForegroundColor: AppColors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.black,
          side: const BorderSide(color: AppColors.black),
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.black),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.grey100,
        selectedColor: AppColors.black,
        labelStyle: const TextStyle(color: AppColors.black, fontWeight: FontWeight.w500),
        secondaryLabelStyle: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w600),
        side: const BorderSide(color: AppColors.grey200),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.black,
        contentTextStyle: TextStyle(color: AppColors.white),
        behavior: SnackBarBehavior.floating,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.black),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.black,
        unselectedLabelColor: AppColors.grey500,
        indicatorColor: AppColors.black,
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: AppColors.grey200,
      ),
    );
  }

  static OutlineInputBorder _inputBorder(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(color: color),
  );
}
