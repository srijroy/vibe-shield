#!/usr/bin/env python3
"""
VibeShield Scanner - The Silent Guardian
Detects and validates API keys in code files using regex patterns and Shannon entropy.
"""

import sys
import json
import re
from pathlib import Path
from typing import List, Dict, Any

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent.parent / "utils"))

from entropy import calculate_shannon_entropy, is_high_entropy, analyze_string


class VibeShieldScanner:
    """Main scanner class for detecting API keys in code."""
    
    # Regex patterns for common API key formats
    # Order matters - more specific patterns first
    PATTERNS = [
        # OpenAI keys (various formats)
        (r'sk-proj-[A-Za-z0-9]{40,}', 'openai_project'),
        (r'sk-[A-Za-z0-9]{40,}', 'openai'),
        
        # Brevo (Sendinblue) keys
        (r'xkeysib-[A-Za-z0-9]{60,}', 'brevo'),
        
        # GitHub tokens
        (r'ghp_[A-Za-z0-9]{36,}', 'github_pat'),
        (r'gho_[A-Za-z0-9]{36,}', 'github_oauth'),
        (r'ghs_[A-Za-z0-9]{36,}', 'github_secret'),
        
        # Google API keys
        (r'AIza[0-9A-Za-z\-_]{35}', 'google'),
        
        # AWS keys
        (r'AKIA[0-9A-Z]{16}', 'aws_access_key'),
        
        # Stripe keys
        (r'sk_live_[0-9a-zA-Z]{24,}', 'stripe_live'),
        (r'sk_test_[0-9a-zA-Z]{24,}', 'stripe_test'),
        (r'pk_live_[0-9a-zA-Z]{24,}', 'stripe_pub_live'),
        (r'pk_test_[0-9a-zA-Z]{24,}', 'stripe_pub_test'),
        
        # Generic API key patterns (with capture groups for the value)
        (r'api[_-]?key[\s]*[=:]\s*["\']([A-Za-z0-9_\-]{25,})["\']', 'generic_api_key'),
        (r'apikey[\s]*[=:]\s*["\']([A-Za-z0-9_\-]{25,})["\']', 'generic_apikey'),
        
        # Generic secrets in quotes (broad catch-all, minimum 30 chars for high confidence)
        (r'["\']([A-Za-z0-9_\-]{30,})["\']', 'quoted_string'),
    ]
    
    def __init__(self, entropy_threshold: float = 3.5, min_length: int = 20):
        """
        Initialize the scanner.
        
        Args:
            entropy_threshold: Minimum Shannon entropy for validation
            min_length: Minimum string length to consider
        """
        self.entropy_threshold = entropy_threshold
        self.min_length = min_length
    
    def scan_file(self, file_path: str) -> Dict[str, Any]:
        """
        Scan a file for API keys.
        
        Args:
            file_path: Path to the file to scan
            
        Returns:
            dict: Scan results in JSON-serializable format
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {
                "success": False,
                "error": f"File not found: {file_path}",
                "findings": []
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            return {
                "success": False,
                "error": f"Error reading file: {e}",
                "findings": []
            }
        
        findings = self._detect_secrets(content, str(file_path))
        
        return {
            "success": True,
            "file": str(file_path),
            "language": self._detect_language(file_path),
            "findings": findings,
            "total_findings": len(findings)
        }
    
    def _detect_language(self, file_path: Path) -> str:
        """Detect the programming language from file extension."""
        extension_map = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.dart': 'dart',
            '.java': 'java',
            '.rb': 'ruby',
            '.php': 'php',
        }
        return extension_map.get(file_path.suffix.lower(), 'unknown')
    
    def _detect_secrets(self, content: str, file_path: str) -> List[Dict[str, Any]]:
        """
        Detect potential secrets in file content.
        
        Args:
            content: File content as string
            file_path: Path to the file (for context)
            
        Returns:
            list: List of findings
        """
        findings = []
        seen_positions = set()  # Track matched character positions to avoid overlaps
        
        lines = content.split('\n')
        
        for pattern, key_type in self.PATTERNS:
            for match in re.finditer(pattern, content, re.MULTILINE):
                # Extract the secret (handle capture groups)
                if match.groups():
                    secret = match.group(1)
                    # For capture groups, track the captured group's position
                    secret_start = match.start(1)
                    secret_end = match.end(1)
                else:
                    secret = match.group(0)
                    secret_start = match.start()
                    secret_end = match.end()
                
                # Skip if this position overlaps with an already-found secret
                position_key = (secret_start, secret_end)
                if position_key in seen_positions:
                    continue
                
                # Skip if too short
                if len(secret) < self.min_length:
                    continue
                
                # Skip common placeholders
                if self._is_placeholder(secret):
                    continue
                
                # Validate with entropy
                entropy = calculate_shannon_entropy(secret)
                if entropy < self.entropy_threshold:
                    continue
                
                # Find line number
                line_num = content[:secret_start].count('\n') + 1
                line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                
                # Extract variable name if possible
                var_name = self._extract_variable_name(line_content, secret)
                
                findings.append({
                    "type": key_type,
                    "secret": secret,
                    "line": line_num,
                    "line_content": line_content,
                    "variable_name": var_name,
                    "entropy": round(entropy, 3),
                    "confidence": self._calculate_confidence(entropy, key_type),
                    "start_pos": secret_start,
                    "end_pos": secret_end
                })
                
                seen_positions.add(position_key)
        
        return findings
    
    def _is_placeholder(self, text: str) -> bool:
        """Check if a string is likely a placeholder."""
        # Exact matches or dominant patterns
        exact_placeholders = [
            'YOUR_API_KEY',
            'API_KEY_HERE',
            'REPLACE_ME',
            'CHANGE_THIS',
            'PUT_YOUR_KEY_HERE',
            'INSERT_KEY_HERE',
            'ENTER_API_KEY',
        ]
        
        text_upper = text.upper()
        
        # Check for exact matches or if placeholder is most of the string
        for placeholder in exact_placeholders:
            if placeholder in text_upper and len(placeholder) / len(text) > 0.5:
                return True
        
        # Check for repetitive patterns (like "xxxxxxxxxx" or "1111111111")
        if len(set(text.lower())) < 5:  # Less than 5 unique characters
            return True
        
        # Check for very low entropy patterns
        char_counts = {}
        for char in text:
            char_counts[char] = char_counts.get(char, 0) + 1
        
        # If any single character makes up more than 40% of the string
        max_char_ratio = max(char_counts.values()) / len(text)
        if max_char_ratio > 0.4:
            return True
        
        return False
    
    def _extract_variable_name(self, line: str, secret: str) -> str:
        """
        Try to extract the variable name from the line of code.
        
        Args:
            line: The line of code containing the secret
            secret: The secret string
            
        Returns:
            str: Variable name or empty string
        """
        # Try common patterns: const apiKey = "secret"
        patterns = [
            r'(?:const|let|var)\s+(\w+)\s*=',
            r'(\w+)\s*[:=]\s*["\']',
            r'(\w+)\s*=\s*["\']',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1)
        
        return ""
    
    def _calculate_confidence(self, entropy: float, key_type: str) -> str:
        """
        Calculate confidence level based on entropy and key type.
        
        Args:
            entropy: Shannon entropy value
            key_type: Detected key type
            
        Returns:
            str: Confidence level (high/medium/low)
        """
        # Known key formats get higher confidence
        high_confidence_types = [
            'openai', 'openai_project', 'brevo', 'google',
            'github_pat', 'github_oauth', 'aws_access_key',
            'stripe_live', 'stripe_test'
        ]
        
        if key_type in high_confidence_types and entropy > 4.0:
            return "high"
        elif entropy > 4.5:
            return "high"
        elif entropy > 3.8:
            return "medium"
        else:
            return "low"


def main():
    """Main entry point for the scanner."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: shield.py <file_path>",
            "findings": []
        }), flush=True)
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Optional: custom entropy threshold
    entropy_threshold = 3.5
    if len(sys.argv) > 2:
        try:
            entropy_threshold = float(sys.argv[2])
        except ValueError:
            pass
    
    scanner = VibeShieldScanner(entropy_threshold=entropy_threshold)
    results = scanner.scan_file(file_path)
    
    # Output JSON to stdout
    print(json.dumps(results, indent=2), flush=True)


if __name__ == "__main__":
    main()