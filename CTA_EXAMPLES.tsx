'use client';

import { Button } from '@/components/ui/button';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowRight, Zap, Download, Rocket } from 'lucide-react';

/**
 * 🎯 CTA Button Integration Examples
 * 
 * This file demonstrates how to use the premium CTA button variant
 * throughout your Anti SaaS application.
 * 
 * Copy and adapt these patterns for your own components!
 */

// ============================================================================
// EXAMPLE 1: Basic CTA Button
// ============================================================================

export function BasicCTAExample() {
  return (
    <section className="py-20 text-center">
      <h2 className="text-3xl font-bold mb-4">Join thousands of property managers</h2>
      <p className="text-secondary mb-8">Start managing your properties like a pro</p>
      
      {/* Simple, standalone CTA button */}
      <Button variant="cta">
        Get Started Free
      </Button>
    </section>
  );
}

// ============================================================================
// EXAMPLE 2: CTA with Icon and Label
// ============================================================================

export function CTAWithIconExample() {
  const t = useTranslations();
  
  return (
    <div className="space-y-4">
      <Button variant="cta" size="lg" className="gap-3">
        <Rocket className="w-5 h-5" />
        {t('cta.launch')}
        <ArrowRight className="w-5 h-5" />
      </Button>
      
      <Button variant="cta" size="sm">
        <Download className="w-4 h-4" />
        Download App
      </Button>
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: CTA as Link (with asChild pattern)
// ============================================================================

export function CTAAsLinkExample() {
  const locale = useLocale();
  
  return (
    <div className="space-y-4">
      {/* Using asChild to make button a link */}
      <Link href={`/${locale}/pricing`}>
        <Button variant="cta" asChild>
          <span className="cursor-pointer">
            View Our Pricing →
          </span>
        </Button>
      </Link>
      
      {/* External link */}
      <a href="https://docs.anti.app">
        <Button variant="cta" asChild>
          <span className="cursor-pointer">
            Read Documentation
          </span>
        </Button>
      </a>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: CTA in Forms (Submit button)
// ============================================================================

export function CTAFormExample() {
  const t = useTranslations();
  
  return (
    <form className="space-y-4 max-w-md">
      <input
        type="email"
        placeholder={t('form.email')}
        className="w-full px-4 py-2 border border-border rounded-lg bg-background"
      />
      
      <textarea
        placeholder={t('form.message')}
        className="w-full px-4 py-2 border border-border rounded-lg bg-background"
      />
      
      {/* CTA as form submit button */}
      <Button variant="cta" type="submit" size="lg" className="w-full">
        {t('cta.sendMessage')}
      </Button>
    </form>
  );
}

// ============================================================================
// EXAMPLE 5: CTA with Loading State
// ============================================================================

export function CTALoadingStateExample() {
  const [isLoading, setIsLoading] = React.useState(false);
  const t = useTranslations();
  
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Your async operation here
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Button 
      variant="cta" 
      onClick={handleSubmit}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <span className="inline-block animate-spin">⏳</span>
          {t('common.processing')}
        </>
      ) : (
        <>
          <Zap className="w-5 h-5" />
          {t('cta.processNow')}
        </>
      )}
    </Button>
  );
}

// ============================================================================
// EXAMPLE 6: Hero Section with CTA (Multilingual)
// ============================================================================

export function HeroWithCTAExample() {
  const t = useTranslations();
  
  return (
    <section className="py-32 px-4 text-center bg-gradient-to-b from-surface to-background">
      <h1 className="text-5xl font-bold mb-4 text-primary">
        {t('hero.title')}
      </h1>
      
      <p className="text-xl text-secondary mb-8 max-w-2xl mx-auto">
        {t('hero.description')}
      </p>
      
      <div className="flex gap-4 justify-center flex-wrap">
        {/* Primary CTA - premium variant */}
        <Button variant="cta" size="lg">
          {t('cta.getStarted')} →
        </Button>
        
        {/* Secondary CTA - outline variant */}
        <Button variant="outline" size="lg">
          {t('cta.learnMore')}
        </Button>
      </div>
      
      {/* Trust badge */}
      <p className="text-sm text-secondary mt-12">
        {t('hero.trusted')} <span className="text-primary font-semibold">1000+</span> {t('hero.properties')}
      </p>
    </section>
  );
}

// ============================================================================
// EXAMPLE 7: Feature Card with CTA
// ============================================================================

export function FeatureCardWithCTAExample() {
  const t = useTranslations();
  
  const features = [
    {
      icon: '🏠',
      title: t('features.properties'),
      description: t('features.propertiesDesc'),
    },
    {
      icon: '👥',
      title: t('features.tenants'),
      description: t('features.tenantsDesc'),
    },
    {
      icon: '💰',
      title: t('features.payments'),
      description: t('features.paymentsDesc'),
    },
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {features.map((feature) => (
        <div key={feature.title} className="p-6 bg-card rounded-2xl border border-border">
          <div className="text-4xl mb-4">{feature.icon}</div>
          <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
          <p className="text-secondary mb-6">{feature.description}</p>
          
          {/* CTA in feature cards */}
          <Button variant="cta" size="sm" className="w-full">
            {t('cta.learnMore')} →
          </Button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// EXAMPLE 8: Dashboard Action Button
// ============================================================================

export function DashboardActionExample() {
  const t = useTranslations();
  const locale = useLocale();
  
  return (
    <div className="p-6 bg-surface rounded-lg border border-border">
      <h3 className="text-lg font-semibold mb-2">Ready to add your first property?</h3>
      <p className="text-secondary mb-4">{t('dashboard.getStarted')}</p>
      
      {/* CTA linking to new property form */}
      <Link href={`/${locale}/dashboard/properties/new`}>
        <Button variant="cta">
          <ArrowRight className="w-4 h-4" />
          {t('cta.addProperty')}
        </Button>
      </Link>
    </div>
  );
}

// ============================================================================
// EXAMPLE 9: Call-to-Action Banner
// ============================================================================

export function CTABannerExample() {
  const t = useTranslations();
  const [isDismissed, setIsDismissed] = React.useState(false);
  
  if (isDismissed) return null;
  
  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-primary mb-1">
          {t('banner.limitedOffer')}
        </h3>
        <p className="text-sm text-secondary">
          {t('banner.offerDescription')}
        </p>
      </div>
      
      <div className="flex gap-2">
        <Button 
          variant="ghost" 
          onClick={() => setIsDismissed(true)}
        >
          {t('common.dismiss')}
        </Button>
        <Button variant="cta">
          {t('cta.claimOffer')}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 10: Footer CTA
// ============================================================================

export function FooterCTAExample() {
  const t = useTranslations();
  const locale = useLocale();
  
  return (
    <footer className="bg-card border-t border-border py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-surface p-8 rounded-lg border border-border text-center mb-8">
          <h2 className="text-2xl font-bold mb-4">{t('footer.ready')}</h2>
          <p className="text-secondary mb-6 max-w-lg mx-auto">
            {t('footer.description')}
          </p>
          
          {/* Final, dominant CTA */}
          <Button variant="cta" size="lg" asChild>
            <Link href={`/${locale}/register`}>
              {t('cta.startFree')} →
            </Link>
          </Button>
        </div>
        
        {/* Footer links */}
        <div className="grid grid-cols-4 gap-8 text-sm">
          <div>
            <h4 className="font-semibold mb-4">{t('footer.product')}</h4>
            <div className="space-y-2">
              <Button variant="link">{t('footer.features')}</Button>
              <Button variant="link">{t('footer.pricing')}</Button>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t('footer.company')}</h4>
            <div className="space-y-2">
              <Button variant="link">{t('footer.about')}</Button>
              <Button variant="link">{t('footer.blog')}</Button>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t('footer.legal')}</h4>
            <div className="space-y-2">
              <Button variant="link">{t('footer.privacy')}</Button>
              <Button variant="link">{t('footer.terms')}</Button>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t('footer.social')}</h4>
            <div className="space-y-2">
              <Button variant="link">Twitter</Button>
              <Button variant="link">LinkedIn</Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';

// ============================================================================
// INTEGRATION GUIDE
// ============================================================================

/**
 * 📋 How to Use These Examples
 * 
 * 1. COPY the example function you want to use
 * 2. PASTE it into your component
 * 3. UPDATE the translation keys to match your i18n setup
 * 4. ADJUST size/styling to fit your design
 * 5. TEST in both light and dark modes
 * 
 * Key Points:
 * ✅ All examples use variant="cta" for premium styling
 * ✅ All are multilingual-ready with useTranslations()
 * ✅ All follow accessibility best practices
 * ✅ All include icons when appropriate
 * ✅ All work on mobile and desktop
 * 
 * Variant Options:
 * - size="sm"      (small: h-8 px-3)
 * - size="default" (medium: h-9 px-4) ← default
 * - size="lg"      (large: h-10 px-6)  ← recommended for hero CTAs
 * 
 * Icon Integration:
 * - ArrowRight → indicates forward/action
 * - Zap → indicates speed/lightning fast
 * - Rocket → indicates launch/start
 * - Download → indicates getting something
 * - Check → indicates success/completion
 * 
 * Color Behavior (Automatic):
 * - Light Mode: Gold background (#B8934A) + White text
 * - Dark Mode:  Green background (#10B981) + Black text
 * - No additional CSS needed!
 */

export default function CTAExamplesShowcase() {
  return (
    <div className="space-y-20 p-8">
      <section>
        <h2 className="text-2xl font-bold mb-6">Basic CTA</h2>
        <BasicCTAExample />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-6">CTA with Icons</h2>
        <CTAWithIconExample />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-6">CTA in Hero</h2>
        <HeroWithCTAExample />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-6">CTA Banner</h2>
        <CTABannerExample />
      </section>
    </div>
  );
}
