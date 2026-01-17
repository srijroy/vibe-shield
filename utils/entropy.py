"""
Shannon Entropy Calculator for API Key Validation
Calculates the randomness of strings to distinguish real API keys from placeholders.
"""

import math
from collections import Counter


def calculate_shannon_entropy(text: str) -> float:
    """
    Calculate Shannon entropy of a string.
    
    Higher entropy = more random (likely a real API key)
    Lower entropy = less random (likely a placeholder like "YOUR_API_KEY_HERE")
    
    Args:
        text: The string to analyze
        
    Returns:
        float: Shannon entropy value (typically 0-5+ for ASCII strings)
    """
    if not text:
        return 0.0
    
    # Count character frequencies
    counter = Counter(text)
    length = len(text)
    
    # Calculate entropy
    entropy = 0.0
    for count in counter.values():
        probability = count / length
        entropy -= probability * math.log2(probability)
    
    return entropy


def is_high_entropy(text: str, threshold: float = 3.5) -> bool:
    """
    Determine if a string has high enough entropy to be considered a real secret.
    
    Args:
        text: The string to check
        threshold: Minimum entropy value (default 3.5 is good for API keys)
        
    Returns:
        bool: True if entropy is above threshold
    """
    if len(text) < 8:  # Too short to be a real API key
        return False
    
    entropy = calculate_shannon_entropy(text)
    return entropy >= threshold


def analyze_string(text: str) -> dict:
    """
    Full analysis of a string's entropy characteristics.
    
    Args:
        text: The string to analyze
        
    Returns:
        dict: Analysis results including entropy, length, and verdict
    """
    entropy = calculate_shannon_entropy(text)
    is_likely_secret = is_high_entropy(text)
    
    return {
        "text": text,
        "length": len(text),
        "entropy": round(entropy, 3),
        "is_likely_secret": is_likely_secret,
        "confidence": "high" if entropy > 4.0 else "medium" if entropy > 3.5 else "low"
    }


if __name__ == "__main__":
    # Test with example strings
    test_cases = [
        "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz",  # High entropy (real key)
        "YOUR_API_KEY_HERE",  # Low entropy (placeholder)
        "test123",  # Low entropy (simple placeholder)
        "xkeysib-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",  # High entropy (Brevo key)
    ]
    
    print("Entropy Analysis Test:")
    print("=" * 60)
    for test in test_cases:
        result = analyze_string(test)
        print(f"\nText: {test}")
        print(f"Length: {result['length']}")
        print(f"Entropy: {result['entropy']}")
        print(f"Likely Secret: {result['is_likely_secret']} ({result['confidence']} confidence)")