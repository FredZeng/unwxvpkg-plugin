import * as vscode from 'vscode';
import { basename, extname } from 'path';
// @ts-ignore
import * as Wxvpkg from 'unwxvpkg';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('unwxvpkg.unpack', async (uri: vscode.Uri) => {
		const wxvpkgName = basename(uri.fsPath);
		const dirName = basename(uri.fsPath, extname(uri.fsPath)) + '.unpack';
		const outputUri = vscode.Uri.joinPath(uri, `../${dirName}`);

		try {
			const stats = await vscode.workspace.fs.stat(outputUri);
			if (stats.type === vscode.FileType.Directory) {
				const res = await vscode.window.showWarningMessage(`Directory ${dirName} already exists in this workspace. Do you want to remove the directory?`, 'Cancel', 'Remove');
				if (res === 'Cancel') {
					return;
				} else {
					await vscode.workspace.fs.delete(outputUri, { recursive: true, useTrash: true });
					unpackFile();
				}
			}
		} catch (err) {
			if (err) {
				if (err.name === 'EntryNotFound (FileSystemError)') {
					unpackFile();
				} else {
					console.warn(err);
					vscode.window.showErrorMessage(err.message);
				}
				return;
			}
		}

		async function unpackFile() {
			vscode.window
				.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Unwxvpkg',
						cancellable: false,
					},
					async progress => {
						try {
							progress.report({ increment: 0, message: `analyzing ${wxvpkgName}` });

							const file = await vscode.workspace.fs.readFile(uri);
							const wxvpkg = new Wxvpkg(file);
							const files = wxvpkg.decode();

							for (let i = 0, len = files.length; i < len; i++) {
								const it = files[i];
								const filePath = vscode.Uri.joinPath(outputUri, it.name);
								await vscode.workspace.fs.writeFile(filePath, it.chunk);
								progress.report({ increment: 100 / len, message: `unpacked ${i + 1}/${len} files` });
							}
						} catch (err) {
							if (err) {
								console.warn(err);
								return Promise.reject(err.message);
							}
						}
					}
				)
				.then(
					() => {
						vscode.window.showInformationMessage(`Unpack ${wxvpkgName} successfully.`);
					},
					err => {
						vscode.window.showErrorMessage(err?.message || err);
					}
				);
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
