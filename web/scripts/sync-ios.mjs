import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'ios'], { stdio: 'inherit' });
const file = new URL('../../ios/App/CapApp-SPM/Package.swift', import.meta.url);
let text = readFileSync(file, 'utf8');
text = text.replace('dependencies: [', 'dependencies: [\n        .package(name: "MundaNative", path: "../../MundaNative"),');
text = text.replace('name: "CapApp-SPM",\n            dependencies: [', 'name: "CapApp-SPM",\n            dependencies: [\n                .product(name: "MundaNative", package: "MundaNative"),');
writeFileSync(file, text);
