import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const VERSION_PATTERN = /^\s*\*\s*Version:\s*([0-9]+(?:\.[0-9]+){2}(?:-[0-9A-Za-z.-]+)?)\s*$/m;

export function readWordPressPluginVersion(root=process.cwd()) {
  const file=resolve(root,'wordpress/orthocal/orthocal.php');
  const source=readFileSync(file,'utf8');
  const match=source.match(VERSION_PATTERN);
  if (!match) throw new Error(`WordPress plugin version is missing from ${file}`);
  return match[1];
}
