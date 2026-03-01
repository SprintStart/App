import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { checkSchoolDomainMatch, attachTeacherToSchool } from '../lib/schoolDomainEntitlement';
import {
  LogIn, FileText, BarChart3, Users, Upload,
  Brain, CheckCircle, Clock, DollarSign, Lock, Shield, Zap, AlertCircle
} from 'lucide-react';

export function TeacherPage() {
  const navigate = useNavigate();
  const loginRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const signupRef = useRef<HTMLDivElement>(null);

  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [schoolDetected, setSchoolDetected] = useState<{ name: string; domain: string } | null>(null);

  useEffect(() => {
    console.log('[NAV] TeacherPage component loaded at /teacher');
    checkExistingSession();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'cancelled') {
      setSignupError('Payment cancelled. Please try again when ready.');
    }
  }, []);

  async function checkExistingSession() {
    console.log('[Teacher Page] Checking for existing session');
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('[Teacher Page] Existing session found, checking teacher state');
      try {
        const checkResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-teacher-state`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: session.user.email }),
          }
        );

        if (!checkResponse.ok) {
          console.error('[Teacher Page] Failed to check teacher state');
          return;
        }

        const stateData = await checkResponse.json();
        console.log('[Teacher Page] Teacher state:', stateData.state, 'Redirecting to:', stateData.redirectTo);

        if (stateData.redirectTo && stateData.redirectTo !== '/teacher') {
          navigate(stateData.redirectTo);
        }
      } catch (error) {
        console.error('[Teacher Page] Error checking teacher state:', error);
      }
    } else {
      console.log('[Teacher Page] No existing session, showing marketing page');
    }
  }

  function scrollToSection(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSignup() {
    try {
      console.log('[Teacher Signup] Starting signup for:', signupEmail);
      setSignupError(null);
      setSignupSuccess(false);
      setSchoolDetected(null);
      setSignupLoading(true);

      // Validate inputs
      if (!signupEmail || !signupPassword) {
        throw new Error('Please enter both email and password');
      }

      if (signupPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Check for school domain FIRST (before creating account)
      console.log('[Teacher Signup] Checking for school domain match');
      const schoolMatch = await checkSchoolDomainMatch(signupEmail);

      if (schoolMatch.matched) {
        console.log('[Teacher Signup] ✓ School domain detected:', schoolMatch.schoolName);
        setSchoolDetected({
          name: schoolMatch.schoolName!,
          domain: schoolMatch.domain!,
        });
      } else {
        console.log('[Teacher Signup] ✗ No school domain match - will require payment');
      }

      // Check if email already exists
      console.log('[Teacher Signup] Checking if email already exists');
      const checkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-teacher-state`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: signupEmail }),
        }
      );

      if (!checkResponse.ok) {
        throw new Error('Failed to verify email availability');
      }

      const checkData = await checkResponse.json();
      console.log('[Teacher Signup] Email check result:', checkData.state);

      if (checkData.state === 'SIGNED_UP_UNVERIFIED') {
        console.error('[Teacher Signup] Email already registered but unverified');
        setSignupError('UNVERIFIED_EXISTS');
        return;
      }

      if (checkData.state === 'VERIFIED_UNPAID' || checkData.state === 'ACTIVE' || checkData.state === 'EXPIRED') {
        console.error('[Teacher Signup] Email already registered and verified');
        setSignupError('VERIFIED_EXISTS');
        return;
      }

      // Create auth user
      console.log('[Teacher Signup] Creating Supabase auth user');
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            role: 'teacher'
          },
          emailRedirectTo: `${window.location.origin}/teacher/post-verify`,
        },
      });

      if (error) {
        console.error('[Teacher Signup] Signup failed:', error);
        if (error.message.includes('already registered')) {
          setSignupError('VERIFIED_EXISTS');
          return;
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('User creation failed - no user returned');
      }

      console.log('[Teacher Signup] ✓ User created successfully:', data.user.id);
      console.log('[Teacher Signup] Email confirmed?', data.user.email_confirmed_at ? 'Yes' : 'No');

      // If school domain matched, attach teacher to school
      if (schoolMatch.matched && schoolMatch.schoolId) {
        console.log('[Teacher Signup] Attaching teacher to school:', schoolMatch.schoolName);
        const attachResult = await attachTeacherToSchool(
          data.user.id,
          schoolMatch.schoolId,
          schoolMatch.schoolName!
        );

        if (attachResult.success) {
          console.log('[Teacher Signup] ✓ Teacher attached to school successfully');
        } else {
          console.warn('[Teacher Signup] ⚠ Failed to attach teacher to school:', attachResult.error);
          // Don't fail the signup if school attachment fails
        }
      }

      // Show success state
      setSignupSuccess(true);

      // Auto-navigate after a delay
      setTimeout(() => {
        if (schoolMatch.matched) {
          console.log('[Teacher Signup] Redirecting to dashboard (school access)');
          navigate('/teacher/dashboard');
        } else if (!data.user.email_confirmed_at) {
          console.log('[Teacher Signup] Email verification required - staying on page');
          // Don't redirect - user needs to verify email first
        } else {
          console.log('[Teacher Signup] Redirecting to checkout (payment required)');
          navigate('/teacher/checkout');
        }
      }, 3000);

    } catch (err: any) {
      console.error('[Teacher Signup] Error:', err);
      setSignupError(err.message || 'An unexpected error occurred');
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleResendVerification() {
    try {
      setSignupLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: signupEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/teacher/checkout`,
        },
      });

      if (error) throw error;

      setSignupError('VERIFICATION_SENT');
    } catch (err: any) {
      console.error('[Resend Verification] Error:', err);
      setSignupError(err.message || 'Failed to resend verification email');
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleLogin() {
    try {
      console.log('[Teacher Login] Starting login for:', loginEmail);
      setLoginError(null);
      setLoginLoading(true);

      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        console.error('[Teacher Login] Login failed:', error);

        if (error.message.toLowerCase().includes('email not confirmed')) {
          console.log('[Teacher Login] ✗ Email not confirmed');
          setLoginError('EMAIL_NOT_CONFIRMED');
        } else if (error.message.toLowerCase().includes('invalid')) {
          console.log('[Teacher Login] ✗ Invalid credentials');
          setLoginError('Invalid email or password');
        } else {
          setLoginError(error.message || 'Login failed');
        }
        return;
      }

      if (!data.user) {
        console.error('[Teacher Login] No user returned after login');
        setLoginError('Login failed - please try again');
        return;
      }

      console.log('[Teacher Login] ✓ Login successful for user:', data.user.id);
      console.log('[Teacher Login] Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No');

      // Check if email is verified (if email confirmations are enabled)
      if (!data.user.email_confirmed_at) {
        console.log('[Teacher Login] ✗ Email not verified - cannot proceed');
        setLoginError('EMAIL_NOT_CONFIRMED');
        // Sign out the user since they can't access anything yet
        await supabase.auth.signOut();
        return;
      }

      // Check teacher state and entitlements
      console.log('[Teacher Login] Checking teacher state and entitlements');
      const checkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-teacher-state`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: loginEmail }),
        }
      );

      if (!checkResponse.ok) {
        throw new Error('Failed to verify account state');
      }

      const stateData = await checkResponse.json();
      console.log('[Teacher Login] State:', stateData.state);
      console.log('[Teacher Login] Has subscription:', stateData.hasSubscription);
      console.log('[Teacher Login] Redirect to:', stateData.redirectTo);

      // Decision logging for debugging
      if (stateData.hasSubscription) {
        console.log('[Teacher Login] ✓ Entitlement found - proceeding to dashboard');
      } else {
        console.log('[Teacher Login] ✗ No entitlement - proceeding to checkout');
      }

      navigate(stateData.redirectTo);
    } catch (err: any) {
      console.error('[Teacher Login] Error:', err);
      setLoginError(err.message || 'An unexpected error occurred');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!loginEmail) {
      setLoginError('Please enter your email address');
      return;
    }

    try {
      setLoginError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setLoginError('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setLoginError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button onClick={() => navigate('/')} className="flex items-center gap-2">
                <img src="/startsprint_logo.png" alt="StartSprint Logo" className="h-10 w-auto" />
              </button>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => navigate('/')}
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection(pricingRef)}
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Pricing
                </button>
              </nav>
            </div>
            <button
              onClick={() => scrollToSection(loginRef)}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-sm"
            >
              <LogIn className="w-5 h-5" />
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 text-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
            Teach Smarter. Measure Better. Reach Further.
          </h2>
          <p className="text-2xl md:text-3xl mb-12 text-blue-100 max-w-4xl mx-auto">
            Create engaging, VR-ready quizzes in minutes and unlock AI-powered insights that clearly show learning impact — in class and beyond.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => scrollToSection(loginRef)}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-bold text-lg shadow-lg"
            >
              Login
            </button>
            <button
              onClick={() => scrollToSection(signupRef)}
              className="px-8 py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-lg shadow-lg"
            >
              Become a Teacher
            </button>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-4xl font-black text-center mb-16 text-gray-900">
            What Teachers Get
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-white p-8 rounded-xl border-2 border-blue-100 shadow-sm">
              <div className="bg-blue-600 rounded-full p-4 w-fit mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">Unlimited Quiz Creation</h4>
              <p className="text-gray-600 text-lg">
                Create as many quizzes as you need. No limits, no restrictions.
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-white p-8 rounded-xl border-2 border-purple-100 shadow-sm">
              <div className="bg-purple-600 rounded-full p-4 w-fit mb-4">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">AI-Assisted Question Generation</h4>
              <p className="text-gray-600 text-lg">
                Upload documents or use AI to generate questions automatically.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-white p-8 rounded-xl border-2 border-green-100 shadow-sm">
              <div className="bg-green-600 rounded-full p-4 w-fit mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">Live & Self-Paced Student Play</h4>
              <p className="text-gray-600 text-lg">
                Students can play in class or at their own pace at home.
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-white p-8 rounded-xl border-2 border-orange-100 shadow-sm">
              <div className="bg-orange-600 rounded-full p-4 w-fit mb-4">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">Performance Analytics & Insights</h4>
              <p className="text-gray-600 text-lg">
                Track progress, identify gaps, and get AI-powered recommendations.
              </p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-white p-8 rounded-xl border-2 border-teal-100 shadow-sm">
              <div className="bg-teal-600 rounded-full p-4 w-fit mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">Classroom-Ready, Student-Safe Design</h4>
              <p className="text-gray-600 text-lg">
                Built for UK schools with safeguarding at the core.
              </p>
            </div>

            <div className="bg-gradient-to-br from-pink-50 to-white p-8 rounded-xl border-2 border-pink-100 shadow-sm">
              <div className="bg-pink-600 rounded-full p-4 w-fit mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">Priority Access to New Features</h4>
              <p className="text-gray-600 text-lg">
                Be first to try immersive modes and upcoming enhancements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <h3 className="text-4xl font-black text-center mb-16 text-gray-900">
            How It Works
          </h3>
          <div className="space-y-8">
            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border-2 border-gray-100">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-2xl font-bold mb-2 text-gray-900">Sign Up as a Teacher</h4>
                <p className="text-gray-600 text-lg">
                  Create your account in seconds. Simple email and password setup.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border-2 border-gray-100">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-2xl font-bold mb-2 text-gray-900">Pay £99.99 Annually</h4>
                <p className="text-gray-600 text-lg">
                  One simple payment for unlimited access all year long.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border-2 border-gray-100">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-2xl font-bold mb-2 text-gray-900">Create a Quiz</h4>
                <p className="text-gray-600 text-lg">
                  Manual entry, upload documents, or use AI to generate questions automatically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border-2 border-gray-100">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl flex-shrink-0">
                4
              </div>
              <div>
                <h4 className="text-2xl font-bold mb-2 text-gray-900">Publish</h4>
                <p className="text-gray-600 text-lg">
                  Your quiz appears instantly on the student homepage, organized by subject.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border-2 border-gray-100">
              <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl flex-shrink-0">
                5
              </div>
              <div>
                <h4 className="text-2xl font-bold mb-2 text-gray-900">Track Performance with AI Analytics</h4>
                <p className="text-gray-600 text-lg">
                  Get insights on student performance, question difficulty, and areas for improvement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingRef} className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h3 className="text-4xl font-black text-center mb-4 text-gray-900">
            Simple, Transparent Pricing
          </h3>
          <p className="text-center text-gray-600 mb-16 text-lg">
            Choose the plan that works best for you. Cancel anytime.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Monthly Plan */}
            <div className="bg-gradient-to-br from-gray-50 to-white p-10 rounded-2xl border-2 border-gray-200 shadow-lg">
              <div className="text-center mb-8">
                <h4 className="text-2xl font-black text-gray-900 mb-4">Monthly Plan</h4>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-black text-gray-900">£10</span>
                  <span className="text-xl text-gray-600">/month</span>
                </div>
                <p className="text-gray-600 mt-3">Flexible access. Cancel anytime.</p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Unlimited quiz creation</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">AI-assisted question generation</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Live & self-paced student play</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Performance analytics & insights</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Classroom-ready, student-safe design</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Priority access to new features</p>
                </div>
              </div>

              <button
                onClick={() => scrollToSection(signupRef)}
                className="w-full mt-4 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-bold text-lg shadow-md"
              >
                Start Monthly Plan
              </button>
            </div>

            {/* Annual Plan */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-10 rounded-2xl border-4 border-blue-500 shadow-xl relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-green-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg">
                  BEST VALUE - Save over 15%
                </span>
              </div>

              <div className="text-center mb-8">
                <h4 className="text-2xl font-black text-gray-900 mb-4">Annual Plan</h4>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-black text-blue-600">£99.99</span>
                  <span className="text-xl text-gray-600">/year</span>
                </div>
                <p className="text-blue-700 mt-3 font-semibold">
                  Most schools and teachers choose annual for uninterrupted access and better value.
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Unlimited quiz creation</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">AI-assisted question generation</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Live & self-paced student play</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Performance analytics & insights</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Classroom-ready, student-safe design</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Priority access to new features</p>
                </div>
              </div>

              <button
                onClick={() => scrollToSection(signupRef)}
                className="w-full mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-lg shadow-lg"
              >
                Start Annual Plan
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Teacher Login Section */}
      <section ref={loginRef} className="py-20 bg-gray-50">
        <div className="max-w-md mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100">
            <div className="flex justify-center mb-6">
              <div className="bg-blue-600 rounded-full p-4">
                <LogIn className="w-12 h-12 text-white" />
              </div>
            </div>
            <h3 className="text-3xl font-black text-center text-gray-900 mb-2">
              Teacher Login
            </h3>
            <p className="text-center text-gray-600 mb-8">
              Access your dashboard and manage your quizzes
            </p>

            {loginError && (
              <div className="mb-4 p-4 border rounded bg-red-50 border-red-300">
                {loginError === 'EMAIL_NOT_CONFIRMED' ? (
                  <div>
                    <p className="font-semibold text-red-900 mb-3">
                      Email Not Confirmed
                    </p>
                    <p className="text-sm text-red-700 mb-4">
                      Your email address has not been verified yet. Please check your inbox for the confirmation email.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={async () => {
                          try {
                            setLoginLoading(true);
                            await supabase.auth.resend({
                              type: 'signup',
                              email: loginEmail,
                              options: {
                                emailRedirectTo: `${window.location.origin}/auth/callback?next=/teacher/checkout`,
                              },
                            });
                            setLoginError('VERIFICATION_EMAIL_SENT');
                          } catch (err: any) {
                            setLoginError(err.message);
                          } finally {
                            setLoginLoading(false);
                          }
                        }}
                        disabled={loginLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Resend Verification Email
                      </button>
                      <button
                        onClick={() => setLoginError(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : loginError === 'VERIFICATION_EMAIL_SENT' ? (
                  <div>
                    <p className="font-semibold text-green-900 mb-2">
                      Verification Email Sent!
                    </p>
                    <p className="text-sm text-green-700">
                      Please check your inbox and click the confirmation link.
                    </p>
                  </div>
                ) : loginError.includes('reset email sent') ? (
                  <div>
                    <p className="font-semibold text-green-900 mb-2">
                      Password Reset Email Sent!
                    </p>
                    <p className="text-sm text-green-700">
                      {loginError}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-red-700">{loginError}</p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loginLoading ? 'Logging in...' : 'Login'}
              </button>

              <button
                onClick={handleForgotPassword}
                className="w-full text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Forgot password?
              </button>

              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-gray-600 mb-2">New teacher?</p>
                <button
                  onClick={() => scrollToSection(signupRef)}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Create an account
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Teacher Sign-Up Section */}
      <section ref={signupRef} className="py-20 bg-white">
        <div className="max-w-md mx-auto px-6">
          <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl shadow-xl p-8 border-4 border-green-200">
            <div className="flex justify-center mb-6">
              <div className="bg-green-600 rounded-full p-4">
                <DollarSign className="w-12 h-12 text-white" />
              </div>
            </div>
            <h3 className="text-3xl font-black text-center text-gray-900 mb-2">
              Create Teacher Account
            </h3>
            <p className="text-center text-gray-600 mb-8">
              £99.99/year for unlimited access
            </p>

            {/* School Domain Detected Banner */}
            {schoolDetected && (
              <div className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-green-900 mb-1">
                      School Access Detected
                    </p>
                    <p className="text-sm text-green-800 mb-1">
                      <strong>{schoolDetected.name}</strong>
                    </p>
                    <p className="text-sm text-green-700">
                      Premium access enabled via school domain ({schoolDetected.domain}). No payment required.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Signup Success Message */}
            {signupSuccess && (
              <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-blue-900 mb-2">
                      Account Created Successfully!
                    </p>
                    {schoolDetected ? (
                      <p className="text-sm text-blue-800">
                        Redirecting to your dashboard...
                      </p>
                    ) : (
                      <div>
                        <p className="text-sm text-blue-800 mb-2">
                          Please check your email to verify your account before proceeding to payment.
                        </p>
                        <p className="text-xs text-blue-700">
                          Once verified, you can complete the payment to access all features.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {signupError && (
              <div className="mb-4 p-4 border rounded bg-red-50 border-red-300">
                {signupError === 'UNVERIFIED_EXISTS' ? (
                  <div>
                    <p className="font-semibold text-red-900 mb-3">
                      Email Already Registered
                    </p>
                    <p className="text-sm text-red-700 mb-4">
                      This email is already registered but not verified. Please verify your email or use a different address.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleResendVerification}
                        disabled={signupLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Resend Verification Email
                      </button>
                      <button
                        onClick={() => scrollToSection(loginRef)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Go to Login
                      </button>
                      <button
                        onClick={() => {
                          setSignupEmail('');
                          setSignupError(null);
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        Use Different Email
                      </button>
                    </div>
                  </div>
                ) : signupError === 'VERIFIED_EXISTS' ? (
                  <div>
                    <p className="font-semibold text-red-900 mb-3">
                      Account Already Exists
                    </p>
                    <p className="text-sm text-red-700 mb-4">
                      This email already has an account. Please log in instead.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setLoginEmail(signupEmail);
                          scrollToSection(loginRef);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Go to Login
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await supabase.auth.resetPasswordForEmail(signupEmail, {
                              redirectTo: `${window.location.origin}/reset-password`,
                            });
                            setSignupError('PASSWORD_RESET_SENT');
                          } catch (err: any) {
                            setSignupError(err.message);
                          }
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                ) : signupError === 'VERIFICATION_SENT' ? (
                  <div>
                    <p className="font-semibold text-green-900 mb-2">
                      Verification Email Sent!
                    </p>
                    <p className="text-sm text-green-700">
                      Please check your inbox and click the confirmation link.
                    </p>
                  </div>
                ) : signupError === 'PASSWORD_RESET_SENT' ? (
                  <div>
                    <p className="font-semibold text-green-900 mb-2">
                      Password Reset Email Sent!
                    </p>
                    <p className="text-sm text-green-700">
                      Please check your inbox for password reset instructions.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-red-700">{signupError}</p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSignup()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleSignup}
                disabled={signupLoading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {signupLoading ? 'Creating account...' : 'Create Account'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                You'll need to confirm your email before completing payment via Stripe.
              </p>

              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-gray-600 mb-2">Already have an account?</p>
                <button
                  onClick={() => scrollToSection(loginRef)}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Log in here
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-xl mb-4">Company</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigate('/about')}
                    className="text-gray-400 hover:text-white"
                  >
                    About
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/contact')}
                    className="text-gray-400 hover:text-white"
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xl mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigate('/privacy')}
                    className="text-gray-400 hover:text-white"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/terms')}
                    className="text-gray-400 hover:text-white"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/safeguarding')}
                    className="text-gray-400 hover:text-white"
                  >
                    Safeguarding
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/ai-policy')}
                    className="text-gray-400 hover:text-white"
                  >
                    AI Policy
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xl mb-4">Pricing</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => scrollToSection(pricingRef)}
                    className="text-gray-400 hover:text-white"
                  >
                    £10/month
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection(pricingRef)}
                    className="text-gray-400 hover:text-white"
                  >
                    £99.99/year (Best Value)
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xl mb-4">Contact</h4>
              <ul className="space-y-2">
                <li className="text-gray-400">support@startsprint.app</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex justify-between items-center">
            <p className="text-gray-400">
              © 2026 StartSprint. All rights reserved.
            </p>
            <button
              onClick={() => navigate('/admin/login')}
              className="text-gray-600 hover:text-gray-400 text-sm flex items-center gap-1"
            >
              <Shield className="w-4 h-4" />
              Admin Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
