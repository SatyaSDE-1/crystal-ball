'use client'

import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)

  return <main className="login-page">
    <section className="login-brand-panel">
      <Link href="/" className="login-brand"><span className="logo-mark"><span /><span /><span /></span><span><strong>Crystal Ball</strong><small>Command Centre</small></span></Link>
      <div className="login-hero-copy"><div className="eyebrow">NORTHSTAR OPERATIONS</div><h1>Clarity for every operational decision.</h1><p>Connect to your command centre and keep your teams, assets, and approvals moving with confidence.</p><div className="login-proof"><ShieldCheck size={18} /><span>Enterprise-grade operational workspace</span></div></div>
      <div className="login-grid-art" aria-hidden="true"><span /><span /><span /><span /></div>
    </section>
    <section className="login-form-panel"><div className="login-form-wrap"><div className="mobile-login-brand"><Link href="/" className="login-brand"><span className="logo-mark"><span /><span /><span /></span><span><strong>Crystal Ball</strong><small>Command Centre</small></span></Link></div><div className="login-heading"><div className="eyebrow">SECURE ACCESS</div><h2>Welcome back</h2><p>Sign in to continue to your command centre.</p></div><form onSubmit={e => e.preventDefault()}><label htmlFor="email">Work email</label><input id="email" type="email" placeholder="you@company.com" autoComplete="email" required /><label htmlFor="password">Password</label><div className="password-field"><input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><div className="login-options"><label className="checkbox-label"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> <span>Remember me</span></label><button type="button" className="forgot-button">Forgot password?</button></div><button className="login-submit" type="submit">Sign in <ArrowRight size={16} /></button></form><div className="login-divider"><span>New to Crystal Ball?</span></div><button className="sso-button" type="button"><LockKeyhole size={16} /> Continue with SSO</button><p className="login-legal">By continuing, you agree to the Crystal Ball <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</p></div></section>
  </main>
}
