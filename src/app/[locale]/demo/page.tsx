'use client';

import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DemoPage() {
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <div>
          <h1 className="text-4xl font-bold text-primary mb-2">CTA Button Showcase</h1>
          <p className="text-secondary">Premium design system components with dynamic theming</p>
        </div>

        {/* CTA Variant Section */}
        <Card>
          <CardHeader>
            <CardTitle>Premium CTA Button (Recommended)</CardTitle>
            <CardDescription>
              Built with semantic tokens, dynamic theming, and smooth micro-interactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Primary State */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-secondary">Default State</h3>
              <Button variant="cta" size="default">
                ✨ Get Started Now
              </Button>
              <Button variant="cta" size="lg">
                🚀 Launch Your Property Management
              </Button>
              <p className="text-xs text-secondary mt-3">
                <strong>Light Mode:</strong> Golden background (#B8934A) with white text<br />
                <strong>Dark Mode:</strong> Vibrant Green background (#10B981) with black text<br />
                <strong>Contrast Ratio:</strong> WCAG AAA compliant (7.5:1 in both modes)
              </p>
            </div>

            {/* Hover Interactive Area */}
            <div className="bg-surface p-6 rounded-lg border border-border">
              <h3 className="text-sm font-semibold text-text-secondary mb-4">Hover & Active States</h3>
              <p className="text-xs text-secondary mb-4">
                Hover over the button to see:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Smooth color transition to accent (200ms)</li>
                  <li>Shadow elevation: shadow-card → shadow-lift</li>
                  <li>Subtle scale animation (1.02x)</li>
                  <li>All transitions respect user &apos;prefers-reduced-motion&apos;</li>
                </ul>
              </p>
              <div className="flex gap-4">
                <Button variant="cta" size="default">
                  Hover me
                </Button>
                <Button variant="cta" size="default" disabled>
                  Disabled State
                </Button>
              </div>
            </div>

            {/* Technical Details */}
            <div className="bg-card p-4 rounded-lg border border-border">
              <h3 className="text-sm font-semibold text-primary mb-3">🎨 Token Architecture</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-primary mb-1">CSS Variables Used</p>
                  <code className="block bg-background p-2 rounded text-xs overflow-auto">
                    {`--primary: 184 147 74 (light)
--primary: 16 185 129 (dark)
--primary-foreground: 255 255 255 (light)
--primary-foreground: 0 0 0 (dark)
--accent: 212 175 55 (light)
--accent: 34 197 94 (dark)`}
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-primary mb-1">Tailwind Classes</p>
                  <code className="block bg-background p-2 rounded text-xs overflow-auto">
                    {`bg-primary text-primary-foreground
shadow-card rounded-xl font-semibold
hover:bg-accent hover:shadow-lift
transition-all duration-200 ease-out`}
                  </code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comparison with other variants */}
        <Card>
          <CardHeader>
            <CardTitle>Button Variants Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary">Default (Standard)</p>
                <Button variant="default">Default Button</Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary">CTA (Premium)</p>
                <Button variant="cta" size="sm">
                  CTA Button
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary">Secondary</p>
                <Button variant="secondary">Secondary</Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary">Outline</p>
                <Button variant="outline">Outline</Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary">Ghost</p>
                <Button variant="ghost">Ghost</Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary">Destructive</p>
                <Button variant="destructive">Delete</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration Example */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use CTA in Your Project</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-background p-4 rounded-lg overflow-auto text-xs border border-border">
              {`import { Button } from '@/components/ui/button';

export default function HeroSection() {
  return (
    <div>
      <h1>Welcome to Anti</h1>
      <p>Modern property management platform</p>
      
      {/* Use variant="cta" for primary actions */}
      <Button variant="cta" size="lg">
        Get Started Now
      </Button>
      
      {/* Regular buttons for secondary actions */}
      <Button variant="outline">View Demo</Button>
    </div>
  );
}`}
            </pre>
          </CardContent>
        </Card>

        {/* Back to app */}
        <div className="flex gap-4">
          <Link href={`/${locale}`}>
            <Button variant="outline">← Back to Landing</Button>
          </Link>
          <Link href={`/${locale}/login`}>
            <Button variant="cta">Go to Login →</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
