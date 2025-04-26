"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const unzipper = __importStar(require("unzipper"));
function activate(context) {
    let disposable = vscode.commands.registerCommand('jartojava.convert', async () => {
        //.jarファイルを選択
        const jarUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { '.jar Files': ['jar'] },
            openLabel: '.jarファイルを選択'
        });
        if (!jarUri || jarUri.length === 0) {
            vscode.window.showWarningMessage('.jarファイルが選択されませんでした。');
            return;
        }
        const jarPath = jarUri[0].fsPath;
        //保存先フォルダ選択
        const saveUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            openLabel: 'プロジェクトの保存先を選択'
        });
        if (!saveUri || saveUri.length === 0) {
            vscode.window.showWarningMessage('保存先フォルダが選択されませんでした。');
            return;
        }
        //プロジェクト名入力
        const projectName = await vscode.window.showInputBox({
            prompt: 'プロジェクト名を入力してください',
            value: path.basename(jarPath, '.jar'),
            ignoreFocusOut: true
        });
        if (!projectName) {
            vscode.window.showWarningMessage('プロジェクト名が入力されませんでした。');
            return;
        }
        //プロジェクトの保存先
        const projectRoot = path.join(saveUri[0].fsPath, projectName);
        await fs.ensureDir(projectRoot);
        //src,bin,libフォルダ作成
        await fs.ensureDir(path.join(projectRoot, 'src'));
        await fs.ensureDir(path.join(projectRoot, 'bin'));
        await fs.ensureDir(path.join(projectRoot, 'lib'));
        //JARを解凍してsrc,bin,libに振り分け
        await fs.createReadStream(jarPath)
            .pipe(unzipper.Parse())
            .on('entry', async (entry) => {
            const fileName = entry.path;
            const type = entry.type;
            if (type === 'File') {
                if (fileName.endsWith('.java')) {
                    //.javaをsrcに
                    const destPath = path.join(projectRoot, 'src', fileName);
                    await fs.ensureDir(path.dirname(destPath));
                    entry.pipe(fs.createWriteStream(destPath));
                }
                else if (fileName.endsWith('.class')) {
                    //.classをbinに
                    const destPath = path.join(projectRoot, 'bin', fileName);
                    await fs.ensureDir(path.dirname(destPath));
                    entry.pipe(fs.createWriteStream(destPath));
                }
                else if (fileName.endsWith('.jar')) {
                    //.jarをlibに
                    const destPath = path.join(projectRoot, 'lib', fileName);
                    await fs.ensureDir(path.dirname(destPath));
                    entry.pipe(fs.createWriteStream(destPath));
                }
                else {
                    entry.autodrain();
                }
            }
            else {
                entry.autodrain();
            }
        })
            .promise();
        // .vscode/settings.json を生成
        const vscodeDir = path.join(projectRoot, '.vscode');
        await fs.ensureDir(vscodeDir);
        await fs.writeJSON(path.join(vscodeDir, 'settings.json'), {
            "java.project.sourcePaths": ["src"],
            "java.project.outputPath": "bin",
            "java.project.referencedLibraries": [
                "lib/**/*.jar"
            ]
        }, { spaces: 2 });
        vscode.window.showInformationMessage(`プロジェクトが作成されました: ${projectRoot}`);
        //プロジェクトを開く
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectRoot), true);
    });
    context.subscriptions.push(disposable);
}
//# sourceMappingURL=extension.js.map