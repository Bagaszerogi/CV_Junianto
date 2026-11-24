import { useEffect, useState } from 'react';
import { Locale } from './data/cvData';
import { Navbar } from './components/Navbar';
import { HeroSection, ThemeMode } from './components/HeroSection';
import { ExperienceSection } from './components/ExperienceSection';
import { ProjectsSection } from './components/ProjectsSection';
import { TechStackSection } from './components/TechStackSection';
import { EducationReferencesSection } from './components/EducationReferencesSection';
import { ContactSection } from './components/ContactSection';

export default function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('cv_theme');
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  // Admin session Bearer token kept strictly in React memory
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('cv_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const handleAuthChange = (token: string | null, email: string | null) => {
    setAuthToken(token);
    setAdminEmail(email);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar locale={locale} onPrint={handlePrint} />
      <main>
        <HeroSection
          locale={locale}
          onLocaleChange={setLocale}
          theme={theme}
          onThemeChange={setTheme}
        />
        <ExperienceSection locale={locale} />
        <ProjectsSection
          locale={locale}
          authToken={authToken}
          adminEmail={adminEmail}
          onAuthChange={handleAuthChange}
        />
        <TechStackSection locale={locale} />
        <EducationReferencesSection locale={locale} />
        <ContactSection locale={locale} onPrint={handlePrint} />
      </main>
    </div>
  );
}
