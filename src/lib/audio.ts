class AudioManager {
  private audioContext: AudioContext | null = null;
  private enabled = false;
  private userDisabled = false;
  private synth: SpeechSynthesis | null = null;
  private voicesLoaded = false;
  private initAttempted = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;

      window.speechSynthesis.onvoiceschanged = () => {
        this.voicesLoaded = true;
      };
    }
  }

  toggle() {
    this.userDisabled = !this.userDisabled;
    return !this.userDisabled;
  }

  isEnabled() {
    return this.enabled && !this.userDisabled;
  }

  async initialize() {
    if (this.initAttempted && this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.enabled = true;
      return true;
    }

    this.initAttempted = true;

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.enabled = true;
      return true;
    } catch (error) {
      console.warn('Audio initialization failed:', error);
      this.enabled = false;
      return false;
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.4) {
    if (!this.audioContext) {
      this.initialize().then(() => {
        if (this.audioContext) {
          this.playToneInternal(frequency, duration, type, volume);
        }
      });
      return;
    }

    this.playToneInternal(frequency, duration, type, volume);
  }

  private playToneInternal(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.4) {
    if (!this.isEnabled() || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + duration
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }

  private speak(text: string, rate: number = 1.0, pitch: number = 1.0) {
    if (!this.synth || !this.isEnabled()) {
      return;
    }

    try {
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1.0;

      const voices = this.synth.getVoices();
      const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      this.synth.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis failed:', error);
    }
  }

  playCorrect() {
    this.speak('Excellent!', 1.1, 1.3);
    this.playTone(523.25, 0.2, 'sine', 0.5);
    setTimeout(() => this.playTone(659.25, 0.3, 'sine', 0.5), 100);
  }

  playWrong() {
    this.speak('Try again.', 1.0, 0.9);
    this.playTone(220, 0.2, 'sawtooth', 0.5);
    setTimeout(() => this.playTone(185, 0.3, 'sawtooth', 0.5), 120);
  }

  playGameOver() {
    this.speak('Game over!', 0.9, 0.7);
    this.playTone(330, 0.25, 'square', 0.6);
    setTimeout(() => this.playTone(277, 0.25, 'square', 0.6), 180);
    setTimeout(() => this.playTone(220, 0.5, 'square', 0.6), 360);
  }

  playComplete() {
    this.speak('Congratulations!', 1.2, 1.4);
    this.playTone(523.25, 0.2, 'sine', 0.6);
    setTimeout(() => this.playTone(659.25, 0.2, 'sine', 0.6), 120);
    setTimeout(() => this.playTone(783.99, 0.4, 'sine', 0.6), 240);
  }
}

export const audioManager = new AudioManager();
