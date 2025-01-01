import { parseArgs } from 'jsr:@std/cli@1.0.9/parse-args';
import { globToRegExp, isGlob, join } from 'jsr:@std/path@1.0.8';
import { exists, expandGlob } from 'jsr:@std/fs@1.0.8';
import DenoJSON from './deno.json' with { type: 'json' };

async function exec(command: string, args: string[]) {
  const { stdout } = await new Deno.Command(command, { args }).output();
  return new TextDecoder().decode(stdout);
}

async function getAllPackages() {
  const list = [];
  for (const pattern of DenoJSON.workspace) {
    const entries = await Array.fromAsync(expandGlob(pattern));
    for (const { path } of entries.filter(entry => entry.isDirectory)) {
      const denoJSONPath = join(path, 'deno.json');
      if (await exists(denoJSONPath)) {
        const denoJSON = JSON.parse(await Deno.readTextFile(denoJSONPath));
        list.push({
          name: denoJSON.name,
          version: denoJSON.version,
          path
        });
      }
    }
  }

  return list;
}

async function getChangedPackages(lastCommitHash: string) {
  const output = await exec('git', ['diff', '--name-only', lastCommitHash]);
  const changedFiles = output.trim().split('\n');
  const projects = new Array<string>();

  for (const pattern of DenoJSON.workspace) {
    if (isGlob(pattern)) {
      const regex = new RegExp(globToRegExp(pattern).source.replace(/\$$/, ''));
      for (const path of changedFiles) {
        const [match] = regex.exec(path) ?? [];
        if (match) {
          projects.push(match);
          break;
        }
      }
    } else if (changedFiles.some(path => path.startsWith(pattern))) {
      projects.push(pattern);
    }
  }

  const list = [];
  for (const project of projects) {
    const denoJSONPath = join(project, 'deno.json');
    if (await exists(denoJSONPath)) {
      const denoJSON = JSON.parse(await Deno.readTextFile(denoJSONPath));
      list.push({
        name: denoJSON.name,
        version: denoJSON.version,
        path: join(Deno.cwd(), project)
      });
    }
  }

  return list;
}

async function main() {
  const args = parseArgs(Deno.args, {
    default: {
      since: undefined,
    },
    alias: {
      since: 's',
    },
  });
  
  const packages = args.since ? await getChangedPackages(args.since) : await getAllPackages();
  Deno.stdout.write(
    new TextEncoder().encode(
      JSON.stringify(packages, null, 2)
    )
  );
}

if (import.meta.main) {
  await main();

}
