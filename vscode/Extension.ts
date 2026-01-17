import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';

// Types matching the Go bridge output
interface Finding {
  type: string;
  secret: string;
  line: number;
  line_content: string;
  variable_name: string;
  entropy: number;
  confidence: string;
  start_pos: number;
  end_pos: number;
}

interface ScanResult {
  success: boolean;
  file: string;
  language: string;
  findings: Finding[];
  total_findings: number;
  error?: string;
}

// Extension state
let diagnosticCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;

/**
 * Activates the VibeShield extension
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('VibeShield is now active!');

  // Create diagnostic collection for showing warnings
  diagnosticCollection = vscode.languages.createDiagnosticCollection('vibeshield');
  context.subscriptions.push(diagnosticCollection);

  // Create output channel
  outputChannel = vscode.window.createOutputChannel('VibeShield');
  context.subscriptions.push(outputChannel);

  // Register command to manually scan current file
  const scanCommand = vscode.commands.registerCommand('vibeshield.scanFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active file to scan');
      return;
    }
    await scanFile(editor.document, context);
  });
  context.subscriptions.push(scanCommand);

  // Register command to fix all secrets in current file
  const fixCommand = vscode.commands.registerCommand('vibeshield.fixSecrets', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active file to fix');
      return;
    }
    await fixSecrets(editor.document, context);
  });
  context.subscriptions.push(fixCommand);

  // Auto-scan on save
  const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
    const config = vscode.workspace.getConfiguration('vibeshield');
    const scanOnSave = config.get<boolean>('scanOnSave', true);

    if (scanOnSave && shouldScanFile(document)) {
      await scanFile(document, context);
    }
  });
  context.subscriptions.push(onSaveListener);

  // Scan open files on activation
  if (vscode.window.activeTextEditor) {
    scanFile(vscode.window.activeTextEditor.document, context);
  }

  vscode.window.showInformationMessage('🛡️ VibeShield is protecting your code!');
}

/**
 * Determines if a file should be scanned
 */
function shouldScanFile(document: vscode.TextDocument): boolean {
  const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
  const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.dart'];

  const isSupported = supportedLanguages.includes(document.languageId) ||
    supportedExtensions.some(ext => document.fileName.endsWith(ext));

  const isNotOutput = !document.fileName.includes('node_modules') &&
    !document.fileName.includes('.git') &&
    !document.fileName.includes('dist') &&
    !document.fileName.includes('build');

  return isSupported && isNotOutput;
}

/**
 * Scans a file using the Go bridge
 */
async function scanFile(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<ScanResult | null> {
  if (!shouldScanFile(document)) {
    return null;
  }

  try {
    outputChannel.appendLine(`\n🔍 Scanning: ${document.fileName}`);

    const result = await callGoBridge(document.fileName, context);

    if (!result.success) {
      outputChannel.appendLine(`❌ Scan failed: ${result.error}`);
      return result;
    }

    // Update diagnostics
    updateDiagnostics(document, result);

    if (result.total_findings > 0) {
      outputChannel.appendLine(`⚠️  Found ${result.total_findings} potential secret(s)`);
      vscode.window.showWarningMessage(
        `VibeShield found ${result.total_findings} potential secret(s) in ${path.basename(document.fileName)}`,
        'View Details',
        'Fix All'
      ).then(selection => {
        if (selection === 'View Details') {
          outputChannel.show();
        } else if (selection === 'Fix All') {
          fixSecrets(document, context);
        }
      });
    } else {
      outputChannel.appendLine('✅ No secrets found');
      diagnosticCollection.delete(document.uri);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`❌ Error: ${errorMessage}`);
    vscode.window.showErrorMessage(`VibeShield error: ${errorMessage}`);
    return null;
  }
}

/**
 * Calls the Go bridge binary
 */
function callGoBridge(filePath: string, context: vscode.ExtensionContext): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    // Determine bridge binary path - GO UP ONE LEVEL to project root
    const bridgeName = os.platform() === 'win32' ? 'bridge.exe' : 'bridge';
    const bridgePath = path.join(context.extensionPath, '..', 'bin', bridgeName);

    // Get configuration
    const config = vscode.workspace.getConfiguration('vibeshield');
    const entropyThreshold = config.get<number>('entropyThreshold', 3.5);

    // Build args
    const args = [filePath];
    if (entropyThreshold !== 3.5) {
      args.push(entropyThreshold.toString());
    }
    args.push('--json'); // Request JSON output

    // Spawn the Go process
    const child = spawn(bridgePath, args);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (stderr && code !== 0 && code !== 1) {
        reject(new Error(stderr));
        return;
      }

      try {
        // Extract JSON from output (bridge might print header text)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          reject(new Error('No JSON output from scanner'));
          return;
        }

        const result: ScanResult = JSON.parse(jsonMatch[0]);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse scanner output: ${error}\nOutput: ${stdout}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn bridge: ${error.message}`));
    });
  });
}

/**
 * Updates VS Code diagnostics with findings
 */
function updateDiagnostics(document: vscode.TextDocument, result: ScanResult) {
  const diagnostics: vscode.Diagnostic[] = result.findings.map(finding => {
    const line = Math.max(0, finding.line - 1); // Convert to 0-indexed
    const range = new vscode.Range(line, 0, line, 1000);

    const diagnostic = new vscode.Diagnostic(
      range,
      `Potential ${finding.type} API key detected (entropy: ${finding.entropy.toFixed(2)}, confidence: ${finding.confidence})`,
      vscode.DiagnosticSeverity.Warning
    );

    diagnostic.source = 'VibeShield';
    diagnostic.code = finding.type;

    return diagnostic;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Fixes all secrets in the document
 */
async function fixSecrets(document: vscode.TextDocument, context: vscode.ExtensionContext) {
  const result = await scanFile(document, context);

  if (!result || result.total_findings === 0) {
    vscode.window.showInformationMessage('No secrets found to fix');
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    `This will move ${result.total_findings} secret(s) to .env and update your code. Continue?`,
    'Yes',
    'No'
  );

  if (answer !== 'Yes') {
    return;
  }

  // TODO: Call Python env_manager.py to perform remediation
  // For now, just show a message
  vscode.window.showInformationMessage(
    '🚧 Auto-fix coming soon! For now, manually move secrets to .env file.'
  );

  outputChannel.appendLine('\n📝 Secrets found:');
  result.findings.forEach((finding, i) => {
    outputChannel.appendLine(`  ${i + 1}. ${finding.type} on line ${finding.line}`);
    outputChannel.appendLine(`     Variable: ${finding.variable_name || '(none)'}`);
    outputChannel.appendLine(`     Suggested: ${generateEnvVarName(finding.type)}`);
  });
  outputChannel.show();
}

/**
 * Generates environment variable name from key type
 */
function generateEnvVarName(type: string): string {
  const mapping: { [key: string]: string } = {
    'openai': 'OPENAI_API_KEY',
    'openai_project': 'OPENAI_API_KEY',
    'brevo': 'BREVO_API_KEY',
    'github_pat': 'GITHUB_TOKEN',
    'google': 'GOOGLE_API_KEY',
    'aws_access_key': 'AWS_ACCESS_KEY_ID',
  };

  return mapping[type] || 'API_KEY';
}

/**
 * Deactivates the extension
 */
export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
  if (outputChannel) {
    outputChannel.dispose();
  }
}
