# Contributing to VibeShield

Thank you for your interest in contributing to VibeShield! 🛡️

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/srijroy/vibe-shield/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (OS, Go version, Python version)

### Suggesting Features

1. Open an issue with the label `enhancement`
2. Describe the feature and its use case
3. Explain why it would be valuable

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly:
   ```bash
   # Test Python scanner
   python scripts/shield.py test_file.js
   
   # Test Go bridge
   go build -o bin/bridge bridge.go
   ./bin/bridge test_file.js
   
   # Test VS Code extension
   cd vscode && npm run compile
   ```
5. Commit with clear messages: `git commit -m "Add amazing feature"`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

**Python:**
- Follow PEP 8
- Use docstrings for functions
- Type hints where applicable

**Go:**
- Run `go fmt` before committing
- Follow Go best practices
- Comment exported functions

**TypeScript:**
- Use 2-space indentation
- Follow VS Code extension patterns
- Document public APIs

### Adding New API Key Patterns

To add support for a new API key type:

1. Edit `scripts/shield.py`
2. Add pattern to `PATTERNS` dictionary:
   ```python
   'service_name': {
       'regex': r'pattern_here',
       'description': 'Service Name API Key',
       'example': 'example_key_format'
   }
   ```
3. Add test case in `test_file.js`
4. Update README.md with new key type

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/vibe-shield.git
cd vibe-shield

# Install Python dependencies (if any)
pip install -r requirements.txt

# Build Go bridge
go build -o bin/bridge bridge.go

# Set up VS Code extension
cd vscode
npm install
npm run compile
```

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Keep discussions professional

## Questions?

Feel free to open an issue for any questions about contributing!

---

**Thank you for making VibeShield better!** 🎉
