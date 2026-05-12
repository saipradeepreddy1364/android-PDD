import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// Native voice is imported dynamically or guarded to prevent web/Expo Go crashes
let Voice: any;
if (Platform.OS !== 'web') {
  try {
    // In Expo Go, this package will exist in node_modules but its native code won't be available
    // We try to require it and then check if it's actually functional
    const VoiceModule = require('@react-native-voice/voice');
    Voice = VoiceModule.default || VoiceModule;
  } catch (e) {
    console.log('Native Voice module not available - this is expected in Expo Go');
    Voice = null;
  }
}

export const useVoiceInput = (onResult?: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Web Speech API setup
  const [recognition, setRecognition] = useState<any>(null);
  
  // Use a ref for onResult to avoid re-triggering the effect
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const text = finalTranscript || interimTranscript;
          if (text) {
            setRecognizedText(text);
            if (onResultRef.current) onResultRef.current(text);
          }
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setError(event.error);
          setIsListening(false);
        };

        recognitionInstance.onend = () => {
          setIsListening(false);
        };

        setRecognition(recognitionInstance);
      }
    } else if (Voice) {
      Voice.onSpeechStart = () => setIsListening(true);
      Voice.onSpeechEnd = () => setIsListening(false);
      Voice.onSpeechError = (e: any) => {
        setError(JSON.stringify(e.error));
        setIsListening(false);
      };
      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          const text = e.value[0];
          setRecognizedText(text);
          if (onResultRef.current) onResultRef.current(text);
        }
      };

      return () => {
        Voice.destroy().then(Voice.removeAllListeners);
      };
    }
  }, []); // Only run once

  const startListening = useCallback(async () => {
    setError(null);
    if (Platform.OS === 'web') {
      if (recognition) {
        try {
          recognition.start();
          setIsListening(true);
        } catch (e) {
          console.error('Speech recognition start error:', e);
        }
      } else {
        console.warn('Web Speech Recognition not supported');
      }
    } else if (Voice) {
      try {
        await Voice.start('en-US');
      } catch (e) {
        setError(JSON.stringify(e));
      }
    }
  }, [recognition]);

  const stopListening = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    } else if (Voice) {
      try {
        await Voice.stop();
      } catch (e) {
        console.error(e);
      }
    }
  }, [recognition]);

  return {
    isListening,
    listening: isListening,
    recognizedText,
    error,
    startListening,
    stopListening,
    browserSupportsSpeechRecognition: !!recognition || Platform.OS !== 'web'
  };
};
