import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle } from 'lucide-react';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showEmailExists, setShowEmailExists] = useState(false);
  const navigate = useNavigate();

  const checkEmailAvailability = async (emailToCheck: string): Promise<boolean> => {
    const normalizedEmail = emailToCheck.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-teacher-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: normalizedEmail }),
        }
      );

      const result = await response.json();

      if (!result.available) {
        setEmailError(result.message || 'This email is already registered');
        setShowEmailExists(true);
        return false;
      }

      setEmailError('');
      setShowEmailExists(false);
      return true;
    } catch (err) {
      console.error('Error checking email:', err);
      setEmailError('Unable to verify email. Please try again.');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmailError('');
    setShowEmailExists(false);

    try {
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check email availability before proceeding
      const isAvailable = await checkEmailAvailability(normalizedEmail);
      if (!isAvailable) {
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirmed`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
          setEmailError('This email is already registered. Please sign in or reset your password.');
          setShowEmailExists(true);
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (data.user) {
        console.log('[Teacher Signup] User created successfully:', data.user.id);
        console.log('[Teacher Signup] Profile will be created by database trigger');

        if (data.session) {
          console.log('[Teacher Signup] User auto-confirmed with session');

          // Check if this is a school domain email
          const emailDomain = normalizedEmail.split('@')[1];
          console.log('[Teacher Signup] Checking school domain:', emailDomain);

          try {
            const { data: schoolCheck } = await supabase
              .from('schools')
              .select('id, name, email_domains, auto_approve_teachers')
              .eq('is_active', true);

            const matchedSchool = schoolCheck?.find((school: any) =>
              school.email_domains &&
              Array.isArray(school.email_domains) &&
              school.email_domains.some((domain: string) => domain.toLowerCase() === emailDomain?.toLowerCase())
            );

            if (matchedSchool) {
              console.log('[Teacher Signup] School domain matched:', matchedSchool.name);
              console.log('[Teacher Signup] Redirecting to post-verify to setup entitlement');
              navigate('/teacher/post-verify', {
                state: {
                  schoolMatched: true,
                  schoolName: matchedSchool.name
                }
              });
              return;
            }
          } catch (err) {
            console.error('[Teacher Signup] Error checking school domain:', err);
          }

          console.log('[Teacher Signup] No school domain match, redirecting to checkout');
          navigate('/teacher/checkout');
        } else {
          console.log('[Teacher Signup] Redirecting to email confirmation screen');
          navigate('/signup-success', {
            state: {
              email: normalizedEmail,
              userId: data.user.id
            }
          });
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {emailError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700 mb-3">{emailError}</p>
                  {showEmailExists && (
                    <div className="flex gap-3">
                      <Link
                        to="/login"
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        Sign in
                      </Link>
                      <Link
                        to="/login"
                        state={{ resetPassword: true }}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Reset password
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full name
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                    setShowEmailExists(false);
                  }}
                  className={`appearance-none relative block w-full pl-10 pr-3 py-2 border ${
                    emailError ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full pl-10 pr-10 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account & continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}