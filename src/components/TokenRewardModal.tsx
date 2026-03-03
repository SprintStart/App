import { useState, useEffect } from 'react';
import { Gift, Sparkles, Zap, Star, X } from 'lucide-react';
import { storeToken, removeToken, storeTokenUnlock, canIssueTokenToday, incrementDailyTokenCount } from '../lib/tokenStorage';

interface TokenRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId?: string;
  runId?: string;
}

interface TokenData {
  token: string;
  signature: string;
  expiresAt: string;
  rewardType: string;
}

const REWARD_INFO = {
  challenge_mode: {
    icon: Zap,
    title: 'Challenge Mode Unlocked',
    description: 'Test your skills with harder questions',
    color: 'text-orange-500'
  },
  bonus_quiz: {
    icon: Star,
    title: 'Bonus Quiz Unlocked',
    description: 'Play 5 extra questions right now',
    color: 'text-yellow-500'
  },
  premium_skin: {
    icon: Sparkles,
    title: '24-Hour Premium Skin',
    description: 'Enjoy a special theme for 24 hours',
    color: 'text-purple-500'
  },
  power_up: {
    icon: Gift,
    title: 'Power-Up Unlocked',
    description: 'Get a special boost for your next quiz',
    color: 'text-blue-500'
  }
};

function generateDeviceNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function TokenRewardModal({ isOpen, onClose, quizId, runId }: TokenRewardModalProps) {
  const [step, setStep] = useState<'loading' | 'reward' | 'used' | 'error'>('loading');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && step === 'loading') {
      issueToken();
    }
  }, [isOpen]);

  const issueToken = async () => {
    if (!canIssueTokenToday()) {
      setError('Daily token limit reached. Come back tomorrow!');
      setStep('error');
      return;
    }

    try {
      const deviceNonce = generateDeviceNonce();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/issue-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quizId,
            runId,
            deviceNonce
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to issue token');
      }

      const data = await response.json();
      const tokenWithNonce = { ...data, deviceNonce };
      setTokenData(tokenWithNonce as any);
      storeToken({ ...tokenWithNonce, issuedAt: Date.now() });
      incrementDailyTokenCount();
      setStep('reward');
    } catch (err) {
      console.error('Token issue error:', err);
      setError('Failed to generate token. Please try again.');
      setStep('error');
    }
  };

  const handleUseToken = async () => {
    if (!tokenData) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: tokenData.token,
            signature: tokenData.signature,
            expiresAt: tokenData.expiresAt,
            rewardType: tokenData.rewardType,
            deviceNonce: (tokenData as any).deviceNonce
          })
        }
      );

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Token validation failed');
      }

      storeTokenUnlock({
        token: tokenData.token,
        usedAt: Date.now(),
        rewardType: tokenData.rewardType
      });

      removeToken(tokenData.token);
      setStep('used');
    } catch (err) {
      console.error('Token validation error:', err);
      setError('Failed to use token. It may have expired.');
      setStep('error');
    }
  };

  const handleSaveForLater = () => {
    onClose();
  };

  if (!isOpen) return null;

  const rewardInfo = tokenData ? REWARD_INFO[tokenData.rewardType as keyof typeof REWARD_INFO] : null;
  const RewardIcon = rewardInfo?.icon || Gift;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'loading' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating your reward...</p>
          </div>
        )}

        {step === 'reward' && tokenData && rewardInfo && (
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                <RewardIcon className={`w-10 h-10 text-white`} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">You Unlocked a Token!</h2>
              <div className={`text-lg font-semibold ${rewardInfo.color} mb-2`}>
                {rewardInfo.title}
              </div>
              <p className="text-gray-600 mb-4">{rewardInfo.description}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-500 mb-1">Your Token</div>
              <div className="text-2xl font-mono font-bold text-gray-900">{tokenData.token}</div>
              <div className="text-xs text-gray-500 mt-2">
                Expires in 24 hours
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleUseToken}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Use Token Now
              </button>
              <button
                onClick={handleSaveForLater}
                className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Save for Later
              </button>
            </div>
          </div>
        )}

        {step === 'used' && rewardInfo && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <Sparkles className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reward Activated!</h2>
            <p className="text-gray-600 mb-6">{rewardInfo.description}</p>
            <button
              onClick={onClose}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
              <X className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
