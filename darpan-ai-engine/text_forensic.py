# text_forensic.py

import nltk
import textstat
from textblob import TextBlob
import math
import re
from collections import Counter
import json # Added json import for the example usage

# --- Download NLTK data (run once locally or add to Dockerfile if needed) ---
try:
    nltk.data.find('tokenizers/punkt')
except LookupError: # <-- CORRECTED
    print("Downloading NLTK punkt tokenizer...")
    nltk.download('punkt', quiet=True)
try:
    nltk.data.find('corpora/stopwords')
except LookupError: # <-- CORRECTED
    print("Downloading NLTK stopwords...")
    nltk.download('stopwords', quiet=True)
# --------------------------------------------------------------------------

def calculate_lexical_diversity(tokens):
    """Calculates Type-Token Ratio (TTR)."""
    if not tokens:
        return 0.0
    # Ensure denominator is not zero
    if len(tokens) == 0:
        return 0.0
    return len(set(tokens)) / len(tokens)

def calculate_burstiness(tokens):
    """
    Simple heuristic for burstiness: variance in sentence lengths.
    Lower variance might suggest more uniform (potentially AI) text.
    """
    # Use original text's tokenization for sentence structure
    # Join tokens back, then sentence tokenize
    text_from_tokens = " ".join(tokens)
    if not text_from_tokens:
        return 0.0
        
    try:
        sentences = nltk.sent_tokenize(text_from_tokens)
    except Exception as e:
        print(f"Warning: NLTK sentence tokenization failed - {e}")
        return 0.0 # Return default if tokenization fails

    if len(sentences) <= 1:
        return 0.0 # Not enough sentences to calculate variance

    sentence_lengths = [len(nltk.word_tokenize(sent)) for sent in sentences if sent] # Ensure sentence isn't empty
    if not sentence_lengths or len(sentence_lengths) == 0:
      return 0.0

    mean_len = sum(sentence_lengths) / len(sentence_lengths)
    # Avoid division by zero if there's only one sentence length somehow
    variance = sum((l - mean_len) ** 2 for l in sentence_lengths) / len(sentence_lengths) if len(sentence_lengths) > 0 else 0.0
    
    # Normalize variance somewhat arbitrarily for a 0-1 scale guess
    normalized_burstiness = min(math.sqrt(variance) / 10, 1.0) # Cap at 1.0
    return normalized_burstiness

def calculate_repetition_score(tokens, n=3):
    """
    Calculates repetition based on recurring n-grams (default trigrams).
    Higher score means more repetition.
    """
    if len(tokens) < n:
        return 0.0

    ngrams = list(nltk.ngrams(tokens, n))
    if not ngrams:
        return 0.0

    ngram_counts = Counter(ngrams)
    repeated_ngram_count = sum(1 for count in ngram_counts.values() if count > 1)
    unique_ngram_count = len(ngram_counts)

    repetition_ratio = repeated_ngram_count / unique_ngram_count if unique_ngram_count > 0 else 0.0
    return min(repetition_ratio * 2, 1.0) # Amplify score slightly, cap at 1.0

def heuristic_ai_likelihood(burstiness, repetition, diversity):
    """
    Simple heuristic: AI text *might* be less bursty, more repetitive,
    and potentially have lower diversity in simple cases.
    Returns a score 0-1 (higher means more likely AI according to this heuristic).
    THIS IS A VERY BASIC HEURISTIC AND NOT RELIABLE.
    """
    burstiness_weight = -0.4
    repetition_weight = 0.4
    diversity_weight = -0.2

    score = 0.5 # Start neutral
    score += (0.5 - burstiness) * burstiness_weight
    score += repetition * repetition_weight
    score += (0.5 - diversity) * diversity_weight

    return max(0.05, min(0.95, score)) # Clamp score

def analyze_text_forensics(text):
    """
    Performs basic text forensic analysis.
    Returns a dictionary of metrics.
    """
    if not text or not isinstance(text, str) or len(text.strip()) == 0:
        return {
            "ai_likelihood_heuristic": 0.0, "readability_score_flesch": 0.0,
            "sentiment_polarity": 0.0, "subjectivity": 0.0,
            "lexical_diversity_ttr": 0.0, "burstiness_variance": 0.0,
            "repetition_trigram": 0.0, "error": "Input text is empty or invalid."
        }

    try:
        # Tokenize original text for sentence analysis (burstiness)
        original_tokens = nltk.word_tokenize(text)

        # Clean and tokenize for diversity/repetition
        text_clean = re.sub(r'[^\w\s]', '', text.lower())
        tokens_clean = nltk.word_tokenize(text_clean)
        stop_words = set(nltk.corpus.stopwords.words('english'))
        filtered_tokens = [word for word in tokens_clean if word.isalpha() and word not in stop_words]

        # 1. Readability (using original text)
        readability_score = textstat.flesch_reading_ease(text)

        # 2. Sentiment & Subjectivity (using original text)
        blob = TextBlob(text)
        sentiment_polarity = round(blob.sentiment.polarity, 3)
        subjectivity = round(blob.sentiment.subjectivity, 3)

        # 3. Lexical Diversity (using filtered tokens)
        lexical_diversity_ttr = round(calculate_lexical_diversity(filtered_tokens), 3)

        # 4. Burstiness (using original tokens)
        burstiness_variance = round(calculate_burstiness(original_tokens), 3)

        # 5. Repetition (using filtered tokens)
        repetition_trigram = round(calculate_repetition_score(filtered_tokens, n=3), 3)

        # 6. AI Likelihood Heuristic
        ai_likelihood_heuristic = round(heuristic_ai_likelihood(
            burstiness_variance, repetition_trigram, lexical_diversity_ttr
        ), 3)

        return {
            "ai_likelihood_heuristic": ai_likelihood_heuristic,
            "readability_score_flesch": readability_score,
            "sentiment_polarity": sentiment_polarity,
            "subjectivity": subjectivity,
            "lexical_diversity_ttr": lexical_diversity_ttr,
            "burstiness_variance": burstiness_variance,
            "repetition_trigram": repetition_trigram
        }
    except Exception as e:
        print(f"!!! Text Forensic Analysis Error: {e}")
        # Log traceback for debugging if needed:
        # import traceback
        # print(traceback.format_exc())
        return {
             "ai_likelihood_heuristic": 0.0, "readability_score_flesch": 0.0,
            "sentiment_polarity": 0.0, "subjectivity": 0.0,
            "lexical_diversity_ttr": 0.0, "burstiness_variance": 0.0,
            "repetition_trigram": 0.0, "error": f"Analysis failed: {str(e)}"
        }

# --- Example Usage (for testing) ---
if __name__ == '__main__':
    test_text_human = "This is a sample sentence written by a human. It has some variation in sentence length and uses fairly common words. Hopefully, it doesn't look too much like AI output."
    test_text_ai_like = "The system leverages advanced algorithms. The system provides optimal results. The system ensures efficiency. Users appreciate the system."

    print("--- Human Text Analysis ---")
    print(json.dumps(analyze_text_forensics(test_text_human), indent=2))

    print("\n--- AI-Like Text Analysis ---")
    print(json.dumps(analyze_text_forensics(test_text_ai_like), indent=2))

    print("\n--- Empty Text Analysis ---")
    print(json.dumps(analyze_text_forensics(""), indent=2))