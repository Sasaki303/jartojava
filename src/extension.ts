import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as unzipper from 'unzipper';

export function activate(context: vscode.ExtensionContext) {
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
          } else if (fileName.endsWith('.class')) {
            //.classをbinに
            const destPath = path.join(projectRoot, 'bin', fileName);
            await fs.ensureDir(path.dirname(destPath));
            entry.pipe(fs.createWriteStream(destPath));
          } else if (fileName.endsWith('.jar')) {
            //.jarをlibに
            const destPath = path.join(projectRoot, 'lib', fileName);
            await fs.ensureDir(path.dirname(destPath));
            entry.pipe(fs.createWriteStream(destPath));
          } else {
            entry.autodrain();
          }
        } else {
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
