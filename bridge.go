package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// Finding represents a single API key finding
type Finding struct {
	Type         string  `json:"type"`
	Secret       string  `json:"secret"`
	Line         int     `json:"line"`
	LineContent  string  `json:"line_content"`
	VariableName string  `json:"variable_name"`
	Entropy      float64 `json:"entropy"`
	Confidence   string  `json:"confidence"`
	StartPos     int     `json:"start_pos"`
	EndPos       int     `json:"end_pos"`
}

// ScanResult represents the complete scan output
type ScanResult struct {
	Success       bool      `json:"success"`
	File          string    `json:"file"`
	Language      string    `json:"language"`
	Findings      []Finding `json:"findings"`
	TotalFindings int       `json:"total_findings"`
	Error         string    `json:"error,omitempty"`
}

// Config holds scanner configuration
type Config struct {
	EntropyThreshold float64
	PythonPath       string
	ScriptPath       string
}

// Scanner wraps the Python engine
type Scanner struct {
	config Config
}

// NewScanner creates a new scanner with default config
func NewScanner() *Scanner {
	// Get the directory of the current executable
	execPath, err := os.Executable()
	if err != nil {
		execPath = "."
	}
	baseDir := filepath.Dir(execPath)

	// Default Python paths (try multiple common names)
	pythonPath := "python3"
	if runtime.GOOS == "windows" {
		pythonPath = "python" // Windows typically uses 'python'
	}

	return &Scanner{
		config: Config{
			EntropyThreshold: 3.5,
			PythonPath:       pythonPath,
			ScriptPath:       filepath.Join(baseDir, "..", "scripts", "shield.py"),
		},
	}
}

// NewScannerWithConfig creates a scanner with custom config
func NewScannerWithConfig(config Config) *Scanner {
	return &Scanner{config: config}
}

// findPython tries to find a working Python 3 installation
func (s *Scanner) findPython() (string, error) {
	pythonCandidates := []string{"python3", "python", "python3.11", "python3.10", "python3.9"}

	for _, candidate := range pythonCandidates {
		cmd := exec.Command(candidate, "--version")
		output, err := cmd.CombinedOutput()
		if err == nil && strings.Contains(string(output), "Python 3") {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not find Python 3 installation")
}

// ScanFile scans a file for API keys
func (s *Scanner) ScanFile(filePath string) (*ScanResult, error) {
	// Ensure script exists
	if _, err := os.Stat(s.config.ScriptPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("scanner script not found: %s", s.config.ScriptPath)
	}

	// Try to find Python if default doesn't work
	pythonCmd := s.config.PythonPath
	if _, err := exec.LookPath(pythonCmd); err != nil {
		foundPython, findErr := s.findPython()
		if findErr != nil {
			return nil, fmt.Errorf("Python not found: %w", findErr)
		}
		pythonCmd = foundPython
	}

	// Build command
	args := []string{
		s.config.ScriptPath,
		filePath,
	}

	// Add entropy threshold if not default
	if s.config.EntropyThreshold != 3.5 {
		args = append(args, fmt.Sprintf("%.1f", s.config.EntropyThreshold))
	}

	// Execute Python script
	cmd := exec.Command(pythonCmd, args...)
	output, err := cmd.CombinedOutput()

	if err != nil {
		return nil, fmt.Errorf("failed to execute scanner: %w\nOutput: %s", err, string(output))
	}

	// Parse JSON output
	var result ScanResult
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse scanner output: %w\nOutput: %s", err, string(output))
	}

	return &result, nil
}

// ScanFileSimple is a convenience function that scans with default config
func ScanFileSimple(filePath string) (*ScanResult, error) {
	scanner := NewScanner()
	return scanner.ScanFile(filePath)
}

// PrintResult prints a scan result in a human-readable format
func PrintResult(result *ScanResult) {
	if !result.Success {
		fmt.Printf("❌ Scan failed: %s\n", result.Error)
		return
	}

	fmt.Printf("📁 File: %s\n", result.File)
	fmt.Printf("🔤 Language: %s\n", result.Language)
	fmt.Printf("🔍 Findings: %d\n\n", result.TotalFindings)

	if result.TotalFindings == 0 {
		fmt.Println("✅ No secrets found!")
		return
	}

	for i, finding := range result.Findings {
		fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
		fmt.Printf("Finding #%d\n", i+1)
		fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
		fmt.Printf("🔑 Type:       %s\n", strings.ToUpper(finding.Type))
		fmt.Printf("📍 Line:       %d\n", finding.Line)
		if finding.VariableName != "" {
			fmt.Printf("📛 Variable:   %s\n", finding.VariableName)
		}
		fmt.Printf("🎲 Entropy:    %.3f\n", finding.Entropy)
		fmt.Printf("✨ Confidence: %s\n", finding.Confidence)
		fmt.Printf("🔒 Secret:     %s...\n", truncate(finding.Secret, 40))
		fmt.Printf("📝 Code:       %s\n", truncate(finding.LineContent, 60))
		fmt.Println()
	}
}

// truncate truncates a string to a maximum length
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// main demonstrates the bridge usage
func main() {
	if len(os.Args) < 2 {
		fmt.Println("VibeShield Go Bridge")
		fmt.Println("Usage: bridge <file_path> [entropy_threshold] [--json]")
		fmt.Println()
		fmt.Println("Examples:")
		fmt.Println("  bridge app.js")
		fmt.Println("  bridge app.js 4.0")
		fmt.Println("  bridge app.js 3.5 --json  # Output JSON only")
		os.Exit(1)
	}

	filePath := os.Args[1]
	jsonOutput := false

	// Create scanner
	scanner := NewScanner()

	// Parse arguments
	for i := 2; i < len(os.Args); i++ {
		arg := os.Args[i]
		if arg == "--json" {
			jsonOutput = true
		} else {
			// Try to parse as entropy threshold
			fmt.Sscanf(arg, "%f", &scanner.config.EntropyThreshold)
		}
	}

	// Scan the file
	result, err := scanner.ScanFile(filePath)
	if err != nil {
		if jsonOutput {
			// Output error as JSON
			errorResult := map[string]interface{}{
				"success": false,
				"error":   err.Error(),
				"findings": []interface{}{},
			}
			jsonBytes, _ := json.MarshalIndent(errorResult, "", "  ")
			fmt.Println(string(jsonBytes))
		} else {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		}
		os.Exit(1)
	}

	// Output results
	if jsonOutput {
		// JSON output for programmatic use
		jsonBytes, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(jsonBytes))
	} else {
		// Pretty output for human
		fmt.Printf("🛡️  VibeShield - Scanning %s...\n\n", filePath)
		PrintResult(result)
	}

	// Exit with error code if secrets found (useful for CI/CD)
	if result.TotalFindings > 0 {
		os.Exit(1)
	}
}
