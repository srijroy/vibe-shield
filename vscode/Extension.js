"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
var vscode = require("vscode");
var child_process_1 = require("child_process");
var path = require("path");
var os = require("os");
// Extension state
var diagnosticCollection;
var outputChannel;
/**
 * Activates the VibeShield extension
 */
function activate(context) {
    var _this = this;
    console.log('VibeShield is now active!');
    // Create diagnostic collection for showing warnings
    diagnosticCollection = vscode.languages.createDiagnosticCollection('vibeshield');
    context.subscriptions.push(diagnosticCollection);
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('VibeShield');
    context.subscriptions.push(outputChannel);
    // Register command to manually scan current file
    var scanCommand = vscode.commands.registerCommand('vibeshield.scanFile', function () { return __awaiter(_this, void 0, void 0, function () {
        var editor;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showErrorMessage('No active file to scan');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, scanFile(editor.document, context)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    context.subscriptions.push(scanCommand);
    // Register command to fix all secrets in current file
    var fixCommand = vscode.commands.registerCommand('vibeshield.fixSecrets', function () { return __awaiter(_this, void 0, void 0, function () {
        var editor;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showErrorMessage('No active file to fix');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, fixSecrets(editor.document, context)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    context.subscriptions.push(fixCommand);
    // Auto-scan on save
    var onSaveListener = vscode.workspace.onDidSaveTextDocument(function (document) { return __awaiter(_this, void 0, void 0, function () {
        var config, scanOnSave;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = vscode.workspace.getConfiguration('vibeshield');
                    scanOnSave = config.get('scanOnSave', true);
                    if (!(scanOnSave && shouldScanFile(document))) return [3 /*break*/, 2];
                    return [4 /*yield*/, scanFile(document, context)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
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
function shouldScanFile(document) {
    var supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
    var supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.dart'];
    var isSupported = supportedLanguages.includes(document.languageId) ||
        supportedExtensions.some(function (ext) { return document.fileName.endsWith(ext); });
    var isNotOutput = !document.fileName.includes('node_modules') &&
        !document.fileName.includes('.git') &&
        !document.fileName.includes('dist') &&
        !document.fileName.includes('build');
    return isSupported && isNotOutput;
}
/**
 * Scans a file using the Go bridge
 */
function scanFile(document, context) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_1, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!shouldScanFile(document)) {
                        return [2 /*return*/, null];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    outputChannel.appendLine("\n\uD83D\uDD0D Scanning: ".concat(document.fileName));
                    return [4 /*yield*/, callGoBridge(document.fileName, context)];
                case 2:
                    result = _a.sent();
                    if (!result.success) {
                        outputChannel.appendLine("\u274C Scan failed: ".concat(result.error));
                        return [2 /*return*/, result];
                    }
                    // Update diagnostics
                    updateDiagnostics(document, result);
                    if (result.total_findings > 0) {
                        outputChannel.appendLine("\u26A0\uFE0F  Found ".concat(result.total_findings, " potential secret(s)"));
                        vscode.window.showWarningMessage("VibeShield found ".concat(result.total_findings, " potential secret(s) in ").concat(path.basename(document.fileName)), 'View Details', 'Fix All').then(function (selection) {
                            if (selection === 'View Details') {
                                outputChannel.show();
                            }
                            else if (selection === 'Fix All') {
                                fixSecrets(document, context);
                            }
                        });
                    }
                    else {
                        outputChannel.appendLine('✅ No secrets found');
                        diagnosticCollection.delete(document.uri);
                    }
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _a.sent();
                    errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                    outputChannel.appendLine("\u274C Error: ".concat(errorMessage));
                    vscode.window.showErrorMessage("VibeShield error: ".concat(errorMessage));
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Calls the Go bridge binary
 */
function callGoBridge(filePath, context) {
    return new Promise(function (resolve, reject) {
        // Determine bridge binary path
        var bridgeName = os.platform() === 'win32' ? 'bridge.exe' : 'bridge';
        var bridgePath = path.join(context.extensionPath, 'bin', bridgeName);
        // Get configuration
        var config = vscode.workspace.getConfiguration('vibeshield');
        var entropyThreshold = config.get('entropyThreshold', 3.5);
        // Build args
        var args = [filePath];
        if (entropyThreshold !== 3.5) {
            args.push(entropyThreshold.toString());
        }
        // Spawn the Go process
        var child = (0, child_process_1.spawn)(bridgePath, args);
        var stdout = '';
        var stderr = '';
        child.stdout.on('data', function (data) {
            stdout += data.toString();
        });
        child.stderr.on('data', function (data) {
            stderr += data.toString();
        });
        child.on('close', function (code) {
            if (stderr && code !== 0 && code !== 1) {
                reject(new Error(stderr));
                return;
            }
            try {
                // Extract JSON from output (bridge might print header text)
                var jsonMatch = stdout.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    reject(new Error('No JSON output from scanner'));
                    return;
                }
                var result = JSON.parse(jsonMatch[0]);
                resolve(result);
            }
            catch (error) {
                reject(new Error("Failed to parse scanner output: ".concat(error, "\nOutput: ").concat(stdout)));
            }
        });
        child.on('error', function (error) {
            reject(new Error("Failed to spawn bridge: ".concat(error.message)));
        });
    });
}
/**
 * Updates VS Code diagnostics with findings
 */
function updateDiagnostics(document, result) {
    var diagnostics = result.findings.map(function (finding) {
        var line = Math.max(0, finding.line - 1); // Convert to 0-indexed
        var range = new vscode.Range(line, 0, line, 1000);
        var diagnostic = new vscode.Diagnostic(range, "Potential ".concat(finding.type, " API key detected (entropy: ").concat(finding.entropy.toFixed(2), ", confidence: ").concat(finding.confidence, ")"), vscode.DiagnosticSeverity.Warning);
        diagnostic.source = 'VibeShield';
        diagnostic.code = finding.type;
        return diagnostic;
    });
    diagnosticCollection.set(document.uri, diagnostics);
}
/**
 * Fixes all secrets in the document
 */
function fixSecrets(document, context) {
    return __awaiter(this, void 0, void 0, function () {
        var result, answer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scanFile(document, context)];
                case 1:
                    result = _a.sent();
                    if (!result || result.total_findings === 0) {
                        vscode.window.showInformationMessage('No secrets found to fix');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, vscode.window.showWarningMessage("This will move ".concat(result.total_findings, " secret(s) to .env and update your code. Continue?"), 'Yes', 'No')];
                case 2:
                    answer = _a.sent();
                    if (answer !== 'Yes') {
                        return [2 /*return*/];
                    }
                    // TODO: Call Python env_manager.py to perform remediation
                    // For now, just show a message
                    vscode.window.showInformationMessage('🚧 Auto-fix coming soon! For now, manually move secrets to .env file.');
                    outputChannel.appendLine('\n📝 Secrets found:');
                    result.findings.forEach(function (finding, i) {
                        outputChannel.appendLine("  ".concat(i + 1, ". ").concat(finding.type, " on line ").concat(finding.line));
                        outputChannel.appendLine("     Variable: ".concat(finding.variable_name || '(none)'));
                        outputChannel.appendLine("     Suggested: ".concat(generateEnvVarName(finding.type)));
                    });
                    outputChannel.show();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Generates environment variable name from key type
 */
function generateEnvVarName(type) {
    var mapping = {
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
function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}
